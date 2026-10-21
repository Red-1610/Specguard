# SpecGuard

## AI-assisted code change impact analysis

### One-line pitch

SpecGuard shows developers what may break before they change code by turning repository relationships into an interactive blast-radius map.

### Core Goal & North Star

> **"The ultimate goal of SpecGuard is to eliminate unexpected production regressions by giving developers complete, fearless visibility into the downstream blast radius of every code change."**

#### The 3 Core Pillars:
1. **Shift Impact Analysis Left:** Catch downstream breakages during local development and PR reviews—*before* staging, deployment, or customer impact.
2. **Visual Evidence Over Blind Text Search:** Replace hundreds of noisy, unstructured `grep` matches with a connected, interactive bubble graph showing exact line numbers and syntax reference types.
3. **Automated AI Remediation:** Leverage Amazon Bedrock (Amazon Nova Pro) to convert dry AST evidence into actionable breaking-change predictions and ready-to-run regression test suites.

## The problem

Developers often change a function, class, configuration value, or service without knowing every part of the codebase that depends on it.

The result can be:

- Unexpected regressions
- Missed tests
- Broken API or service flows
- Unclear code ownership
- Slow and risky code reviews

Existing code search can find text matches, but it does not clearly communicate the impact path or risk of a change.

## The solution

SpecGuard lets a developer provide a public GitHub repository and a target symbol. It then:

1. Clones the repository safely.
2. Indexes Python source files with AST parsing.
3. Finds references to the selected symbol.
4. Calculates a blast-radius score and risk level.
5. Displays affected files as connected interactive bubbles.
6. Shows source evidence when a bubble is selected.

The goal is to turn a difficult repository investigation into a visual, evidence-based workflow.

## Product demo flow

```text
Sign in with Supabase
        ↓
Enter a GitHub repository
        ↓
Enter a Python symbol
        ↓
Run the audit
        ↓
View risk, score, affected files, and reference sites
        ↓
Explore the interactive bubble graph
```

### Example

```text
Repository:
https://github.com/encode/uvicorn

Symbol:
Config

Origin file:
config.py
```

The central bubble represents the selected symbol. Connected bubbles represent files containing downstream references. Selecting a bubble displays the matching lines, line numbers, and reference types.

## Why the bubble graph matters

The graph makes the blast radius understandable at a glance:

- Red center bubble: selected root symbol
- Connected bubbles: affected files
- Lines: relationship between the root and affected files
- Bubble details: exact source evidence
- Risk score: quick prioritization for review

The visualization is not just decorative. It gives the developer a way to move from a high-level impact view to the exact code locations that need attention.

## Current prototype capabilities

- Supabase email authentication
- Google and GitHub OAuth support
- Email verification flow
- FastAPI backend
- Supabase JWT verification through JWKS
- Public GitHub repository cloning
- Python AST indexing
- Symbol reference matching
- Blast-radius scoring
- Interactive bubble graph
- Mermaid dependency visualization replaced by the bubble graph
- Source reference table with file, line, type, and code snippet
- Temporary repository cleanup after each scan
- AWS-ready frontend/backend separation

## Technical architecture

```text
Browser
  ↓
Next.js frontend
  ↓ Supabase session token
FastAPI API
  ↓
Temporary repository workspace
  ↓
Python AST tracer
  ↓
Blast-radius report
  ↓
Interactive bubble graph
```

### AWS deployment direction

For the AWS hackathon, the prototype can be deployed as:

```text
Next.js frontend     → AWS Amplify
FastAPI backend      → ECS Fargate
Container image      → Amazon ECR
Public API           → Application Load Balancer
Secrets              → AWS Secrets Manager
Logs                 → Amazon CloudWatch
Authentication       → Supabase Auth
```

The current prototype does not require a custom application database. Supabase manages authentication persistence, while repository scan workspaces are temporary.

## Why AWS is useful here

Repository analysis is a resource-intensive workload. AWS provides a path from prototype to production:

- Fargate runs the analysis service without server management.
- An Application Load Balancer provides a stable API endpoint.
- ECR stores versioned container images.
- Secrets Manager protects authentication configuration.
- CloudWatch provides operational visibility.
- The architecture can later scale scans into isolated workers.

## Differentiation

SpecGuard is focused on explaining change impact, not just searching code.

Its value comes from combining:

1. Repository-aware analysis
2. Evidence-based impact results
3. Risk scoring
4. Interactive visual exploration
5. A path toward ownership and review guidance

Future graph nodes can include:

- Functions
- Classes
- API endpoints
- Tests
- Email notifications
- Configuration values
- Likely maintainers

## Roadmap

### Near term

- Add repository URL validation
- Add repository size and scan-time limits
- Add backend and AST tests
- Improve empty-result messaging
- Improve symbol and import resolution
- Add scan duration and structured logging

### Next analysis modes

- Multi-language AST support via Tree-sitter (`.ts`, `.tsx`, `.js`, `.go`, `.java`)
- File-level blast radius (trace downstream dependencies for any selected file type)
- Email blast-radius analysis
- API endpoint impact analysis
- Git diff impact analysis
- Test coverage and affected-test mapping
- `CODEOWNERS` and Git history-based ownership

### Production scale

- Persist scan history
- Add usage limits
- Move long scans to a queue
- Run isolated scan workers
- Support private repositories with explicit GitHub permissions
- Add team and project workspaces

## Responsible scope

The current prototype performs Python AST reference analysis. It should not claim to understand every runtime dependency or guarantee that all possible breakages are detected.

Results are intended to help developers investigate and prioritize review, not to replace testing or human judgment.

---

## 🎙️ Presentation & Pitch Guide

### 1. 60-Second Elevator Pitch (Opening Hook)

> "Judges, every developer has experienced this nightmare: you refactor a function or update a class in one file, push to staging, and unknowingly break three downstream services in production.
>
> Code reviews are stressful and blind because existing tools only give you flat keyword search results. They don't show you the **blast radius**.
>
> We built **SpecGuard**—an AI-assisted impact analysis engine that shows developers what will break **before** they push code.
>
> SpecGuard clones a repository, parses syntax trees, computes a deterministic blast score, and renders the impact as an interactive bubble map with line-by-line evidence."

---

### 2. 90-Second Live Demo Walkthrough Script

1. **Targeting the Codebase:**
   > *"Here on our dashboard, we enter a real public repository—for example, `encode/uvicorn`—and a core identifier symbol like `Config`."*

2. **Triggering the Real AST Engine:**
   > *"When I click 'Analyze Real Codebase', our FastAPI backend performs an ephemeral shallow git clone and executes our AST tracer across the codebase in milliseconds."*

3. **Explaining the Visual Results:**
   > *"Immediately, SpecGuard calculates:*
   > - *An **Assessed Risk Level** (CRITICAL / MEDIUM / LOW)*
   > - *A **Blast Score** based on reference depth*
   > - *An **Interactive Bubble Graph**: The red center bubble is our modified symbol. Surrounding bubbles are the affected files. Notice how clicking any bubble slides open exact line numbers, reference types (import, attribute access, function call), and syntax snippets."*

4. **The Amazon Bedrock AI Agent:**
   > *"To go a step further, we feed this AST evidence into our AI Impact Agent powered by Amazon Bedrock (Amazon Nova Pro). It synthesizes the graph into breaking-change predictions and generates ready-to-run regression test suites."*

---

### 3. Demo Closing Statement

> "SpecGuard turns blind code reviews and risky refactoring into a clear, visual, evidence-based workflow. It answers the most critical question in software engineering before merging code:
> **'If I change this, what else will break?'**"

---

## 🛡️ Judge Q&A: Handling "Why only `.py` files? Shouldn't it work for any selected file?"

**If a judge asks:**
> *"Why does SpecGuard currently only analyze `.py` files? Can it calculate blast radius for any selected file or language?"*

**The Winning Answer:**
> "That’s a great question, and it speaks directly to our architectural philosophy:
>
> 1. **Accuracy over simple text-matching:** Anyone can run `grep` across all files, but string searches produce high false positives—matching variable names inside strings, comments, or unrelated files. To provide true, reliable blast-radius calculation, we use deep Abstract Syntax Tree (AST) parsing, resolving exact class definitions, function calls, imports, and aliases.
>
> 2. **Our focused MVP:** For this hackathon, we built our deep AST tracer using Python's native AST engine to prove end-to-end depth: live shallow cloning, static syntax-tree traversal, risk scoring, and interactive bubble visualization.
>
> 3. **Roadmap for Any File & Multi-Language:** In our next milestone, we are extending the engine in two ways:
>    - **File-Level Blast Radius:** Tracing import and export dependency graphs across **any file extension** (`.ts`, `.tsx`, `.js`, `.json`, etc.).
>    - **Tree-sitter Integration:** Replacing language-specific parsers with **Tree-sitter**, bringing AST-level precision to TypeScript, JavaScript, Go, and Java.
>
> Our goal was depth first to avoid false alarms, followed by universal language coverage."

---

### Quick Cheat Sheet for Judges' Q&A

| Potential Question | Your Key Talking Point |
| :--- | :--- |
| **"How is this different from GitHub Search or grep?"** | *"Grep matches text strings blindly without context. SpecGuard inspects AST syntax trees, distinguishing between an actual import/call vs. an unrelated string or comment."* |
| **"Is this scalable to huge codebases?"** | *"Yes. We do shallow depth-1 clones, intelligently prune virtual environments (`.venv`, `node_modules`, `.git`), and AST indexing runs in memory in under a second."* |
| **"What AWS services are used?"** | *"Backend containerized on **ECS Fargate**, container images in **Amazon ECR**, AI reasoning powered by **Amazon Bedrock (Amazon Nova Pro)**, secrets in **Secrets Manager**, and metrics on **CloudWatch**."* |
| **"How does the risk score work?"** | *"It's deterministic: calculated from the number of downstream impacted files and symbol reference count across imports, function calls, and attribute accesses."* |


