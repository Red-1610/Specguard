# SpecGuard Backend Dockerfile (Podman & Docker compatible)
# AWS Fargate, App Runner & local container ready
FROM python:3.11-alpine

# System dependencies: git for repository cloning, curl for health checks, gcc/musl-dev for native packages
RUN apk add --no-cache git curl gcc musl-dev libffi-dev

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY . .

# Run as non-root user for Podman/Docker security
RUN adduser -D -u 1000 specguard && \
    chown -R specguard:specguard /app
USER specguard

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
