---
name: Agents Router
description: Route to appropriate specialized agent based on task
type: skill
---

# /agents — Agents Router

Tu es un dispatcher d'agents. Quand invoqué, tu:

1. **Analyse la demande** — Quel problème a l'utilisateur?
2. **Propose des agents** — Lesquels correspondent le mieux?
3. **Lance l'agent** — Invoque Agent({subagent_type: "..."})
4. **Suit jusqu'au bout** — Assure-toi que l'agent complète la tâche

## Mapping des Agents

**Testing & Quality**
- testing-patterns → Test design, coverage strategy
- python-testing-patterns → Python tests
- e2e-testing-patterns → End-to-end testing
- code-review-excellence → Deep code review

**Frontend & React**
- react-modernization → React refactoring
- react-state-management → State management
- responsive-design → Mobile/responsive UI
- tailwind-design-system → Tailwind styling

**Backend & APIs**
- nodejs-backend-patterns → Node.js architecture
- fastapi-templates → FastAPI design
- api-design-principles → REST/GraphQL design
- microservices-patterns → Microservices

**Python & ML**
- python-ml-data-pipeline → ML data pipeline
- python-ml-bootstrap → ML project setup
- python-performance-optimization → Speed optimization
- async-python-patterns → Async/await patterns

**DevOps & Infrastructure**
- deployment-pipeline-design → CI/CD
- github-actions-templates → GitHub Actions
- terraform-module-library → Infrastructure as Code
- kubernetes-patterns → K8s deployment

**Database**
- postgresql-table-design → Schema design
- sql-optimization-patterns → Query optimization
- database-migration → Migration strategy

**Security**
- security-requirement-extraction → Security spec
- secrets-management → Secrets handling
- pci-compliance → Compliance audit

**Architecture**
- architecture-patterns → System design
- architecture-decision-records → ADR writing

## Usage

```
/agents
→ "I need to optimize database queries"
→ Proposes: sql-optimization-patterns
→ Launches Agent with that subagent_type
```

## Auto-Invocation

- When user mentions a specific domain → Auto suggest agent
- When task requires specialized knowledge → Auto propose agents
