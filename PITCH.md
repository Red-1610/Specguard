# SpecGuard

## AI-assisted code change impact analysis

### One-line pitch

SpecGuard shows developers what may break before they change code by turning repository relationships into an interactive blast-radius map.

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

## Suggested pitch

> Every code change has a blast radius, but most developers discover it only after something breaks. SpecGuard analyzes a real GitHub repository, traces the impact of a selected Python symbol, and visualizes affected files as an interactive map. Instead of giving developers another search result, SpecGuard explains what is connected, where the evidence is, and how much risk the change may carry. The prototype uses Next.js, FastAPI, Supabase Auth, and Python AST analysis, with an AWS deployment path using ECS Fargate, ECR, an Application Load Balancer, Secrets Manager, and CloudWatch.

## Demo closing statement

> SpecGuard helps teams answer one practical question before merging a change: “What else could this affect?”

