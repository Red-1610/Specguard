# SpecGuard AWS Cloud Deployment Friction Log 🛡️

> **Project**: SpecGuard — AI-Assisted Code Change Impact Analysis & Blast-Radius Engine  
> **Team**: SpecGuard Engineering  
> **Target Cloud**: Amazon Web Services (AWS) — ECS Fargate, Amplify Hosting, API Gateway, Bedrock, ECR  
> **Submission Document**: Technical Friction Log for Hackathon Judging Evaluation  

---

## 📊 Summary Matrix

| # | Task Attempted | Core Friction Encountered | Severity | Workaround Applied |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Reverse-proxying HTTPS Amplify to HTTP container | Amplify blocks HTTP targets in custom rules (`BadRequestException`) | **HIGH** | Deployed AWS API Gateway HTTP API for TLS termination |
| **2** | Next.js 14 App Router monorepo hosting | Amplify defaulted to static S3 hosting, returning 404 on `.next` | **HIGH** | Configured `output: 'export'` with `trailingSlash` & `out/` artifacts |
| **3** | Cross-Origin API requests from Amplify domain | FastAPI/Starlette CORS rejects wildcard `*` with `allow_credentials=True` | **HIGH** | Implemented regex-based dynamic origin matching (`^https?://.*`) |
| **4** | ECS Fargate CloudWatch log initialization | ECS tasks crashed with `ResourceNotFoundException` for log group | **MEDIUM** | Added `"awslogs-create-group": "true"` to task definition options |

---

## 🔍 Detailed Friction Entries

### 1. AWS Amplify Reverse Proxy HTTP Target Restriction
* **Specific Task Attempted**: Connecting an HTTPS-hosted frontend on AWS Amplify (`https://main.d3oetpwmbld139.amplifyapp.com`) to the backend container running on AWS ECS Fargate over HTTP (`http://<ECS_PUBLIC_IP>:8000`) without exposing users to browser "Mixed Content" security blocks.
* **Steps Taken**: Added a custom reverse-proxy rewrite rule in AWS Amplify Console under *Rewrites and redirects*:
  ```json
  {
    "source": "/api/<*>",
    "target": "http://<ECS_PUBLIC_IP>:8000/api/<*>",
    "status": "200"
  }
  ```
* **Expected Result**: Amplify's edge reverse proxy would forward `/api/*` HTTPS requests downstream to the ECS HTTP container endpoint behind the scenes.
* **Actual Result**: Amplify Console threw a validation error:
  ```text
  Update rewrites and redirects failed: BadRequestException: HTTP URLs cannot be used in custom rules. Use HTTPS instead.
  ```
* **Severity Rating**: **High** (Blocked communication between the public HTTPS frontend and the serverless container backend).
* **Workaround Used**: Provisioned **AWS API Gateway (HTTP API)** as an HTTPS TLS termination proxy in front of the ECS container, which generated an official Amazon SSL endpoint (`https://a9b3a4n6ri.execute-api.us-east-1.amazonaws.com`) to satisfy the HTTPS requirement.
* **Actionable Suggestion**: AWS Amplify Hosting should permit internal HTTP target endpoints for backend reverse-proxying (similar to Vercel and Netlify rewrites) or offer native 1-click integration with Amazon ECS/App Runner backends.

---

### 2. Next.js 14 App Router Subfolder Monorepo 404 in AWS Amplify
* **Specific Task Attempted**: Deploying a Next.js 14 App Router application located in a subfolder (`frontend/frontend/`) to AWS Amplify Hosting.
* **Steps Taken**: Set `baseDirectory: frontend/frontend/.next` in `amplify.yml` and ran `npm run build` with `output: 'standalone'` in `next.config.js`.
* **Expected Result**: AWS Amplify would detect the Next.js SSR App Router runtime and serve the application on the provided domain.
* **Actual Result**: Deployment completed with green status, but visiting the root URL and subpaths returned `HTTP ERROR 404 No webpage was found`. Amplify defaulted to static S3 hosting, where no `index.html` exists at the root of `.next`.
* **Severity Rating**: **High** (Application was completely unreachable after successful build).
* **Workaround Used**: Updated `next.config.js` to use `output: 'export'` with `trailingSlash: true` and pointed the Amplify build artifact base directory to `frontend/frontend/out`. This generated pre-rendered static HTML routes that Amplify CDN served instantly without compute cold starts.
* **Actionable Suggestion**: Amplify Console should detect subfolder monorepo structures automatically and either prompt to switch to the Web Compute runtime or warn the developer when `.next` does not contain an `index.html` file in static hosting mode.

---

### 3. FastAPI / Starlette CORS `allow_credentials=True` Incompatibility with Wildcard
* **Specific Task Attempted**: Permitting cross-origin API requests from the dynamic AWS Amplify domain to the FastAPI ECS backend.
* **Steps Taken**: Configured `CORSMiddleware` in FastAPI with `allow_origins=["*"]` and `allow_credentials=True`.
* **Expected Result**: The backend would accept preflight `OPTIONS` requests from `https://main.d3oetpwmbld139.amplifyapp.com`.
* **Actual Result**: Browser blocked the request with `Response to preflight request doesn't pass access control check: It does not have HTTP ok status`. FastAPI returned `HTTP 400 Bad Request: Disallowed CORS origin` because Starlette's CORS specification strictly forbids `allow_origins=["*"]` when `allow_credentials=True`.
* **Severity Rating**: **High** (Completely blocked all frontend-to-backend API communication in production).
* **Workaround Used**: Configured `allow_origin_regex=r"^https?://.*"` in FastAPI's `CORSMiddleware`. This dynamically reflects any incoming HTTP/HTTPS origin in `Access-Control-Allow-Origin` while remaining 100% compliant with credentialed requests:
  ```python
  app.add_middleware(
      CORSMiddleware,
      allow_origins=allowed_origins if ("*" not in allowed_origins and allowed_origins) else [],
      allow_origin_regex=r"^https?://.*",
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```
* **Actionable Suggestion**: FastAPI / Starlette should output an explicit console warning or error message clarifying that `allow_origins=["*"]` is disabled due to `allow_credentials=True`, rather than silently rejecting preflights with a generic `400 Disallowed CORS origin`.

---

### 4. ECS Fargate CloudWatch Log Group Initialization
* **Specific Task Attempted**: Registering an ECS Fargate task definition with container logging directed to Amazon CloudWatch.
* **Steps Taken**: Added `"logConfiguration"` with `"logDriver": "awslogs"` pointing to log group `/ecs/specguard-backend`.
* **Expected Result**: ECS would create the container runtime and automatically initialize the log group in CloudWatch.
* **Actual Result**: Initial task placement failed with:
  ```text
  ResourceInitializationError: failed to initialize logging: ResourceNotFoundException: The specified log group does not exist
  ```
* **Severity Rating**: **Medium** (Prevented task launch until CloudWatch log group existed).
* **Workaround Used**: Added `"awslogs-create-group": "true"` into the `logConfiguration.options` object in the ECS task definition JSON.
* **Actionable Suggestion**: AWS ECS should default `"awslogs-create-group"` to `"true"` when generating new task definitions via the console or CLI, preventing unnecessary task crash loops for new services.
