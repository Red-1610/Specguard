import os
import logging
import shutil
import tempfile
import subprocess
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, Header, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import jwt
from dotenv import load_dotenv

if __package__:
    from .engine.ast_tracer import ASTTracer
else:
    from engine.ast_tracer import ASTTracer

load_dotenv()
logger = logging.getLogger("specguard.auth")

app = FastAPI(title="SpecGuard Production Engine", version="2.0.0")

frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_JWKS_URL = os.getenv("SUPABASE_JWKS_URL")
SUPABASE_ISSUER = os.getenv("SUPABASE_ISSUER")
supabase_jwks_client = jwt.PyJWKClient(SUPABASE_JWKS_URL) if SUPABASE_JWKS_URL else None
scan_history: List[Dict[str, Any]] = []

# --- Models ---
class RepoAuditRequest(BaseModel):
    repo_url: str  # e.g. "https://github.com/encode/uvicorn" or "username/repo"
    symbol: str    # Identifier to trace
    origin_file: Optional[str] = ""

def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid token")
    if supabase_jwks_client is None:
        raise HTTPException(status_code=500, detail="Supabase authentication is not configured")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid token")

    try:
        signing_key = supabase_jwks_client.get_signing_key_from_jwt(token)
        decode_options = {"algorithms": ["ES256", "RS256"], "audience": "authenticated"}
        if SUPABASE_ISSUER:
            decode_options["issuer"] = SUPABASE_ISSUER
        payload = jwt.decode(token, signing_key.key, **decode_options)
        user_id = payload.get("sub")
        if not isinstance(user_id, str) or not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user identity")
        return user_id
    except HTTPException:
        raise
    except (jwt.PyJWKError, jwt.PyJWTError, ValueError) as error:
        logger.warning("Supabase token verification failed: %s", error)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

@app.get("/api/auth/me")
def get_me(current_user: str = Depends(get_current_user)):
    return {"user_id": current_user}

# --- Dynamic Real-Repository AST Audit Endpoint ---
@app.post("/api/audit/real-repo")
def audit_real_repo(req: RepoAuditRequest, current_user: str = Depends(get_current_user)):
    """
    Dynamically clones the target GitHub repo (shallow clone --depth 1)
    and traverses its actual Python AST files.
    """
    repo_url = req.repo_url.strip()
    if not repo_url.startswith("http://") and not repo_url.startswith("https://"):
        # Format if user just entered "owner/repo"
        repo_url = f"https://github.com/{repo_url}"
    if not repo_url.endswith(".git"):
        repo_url = f"{repo_url}.git"

    temp_dir = tempfile.mkdtemp(prefix="specguard_repo_")

    try:
        # Perform shallow git clone
        cmd = ["git", "clone", "--depth", "1", repo_url, temp_dir]
        process = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=45)
        
        if process.returncode != 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Failed to clone repository: {process.stderr.strip() or 'Repository not found or private.'}"
            )

        # Run real AST parsing on the cloned workspace
        tracer = ASTTracer(temp_dir)
        report = tracer.trace_symbol(req.symbol, origin_file=req.origin_file)
        
        result = report.to_dict()
        result["repository"] = req.repo_url
        result["scanned_by"] = current_user
        result["total_python_files_indexed"] = len(tracer.file_index)

        scan_history.insert(0, result)
        return result

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=408, detail="Cloning timed out. Please check repository size or URL.")
    finally:
        # Clean up temporary directory from disk
        shutil.rmtree(temp_dir, ignore_errors=True)

@app.get("/health")
def health():
    return {"status": "ok"}