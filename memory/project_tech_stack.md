---
name: Tech Stack Overview
description: Full-stack architecture, key directories, dependencies
type: project
---

**Frontend**
- Framework: React 18 (TypeScript)
- Build: Vite (fast HMR)
- State: Custom hooks + context
- Testing: Vitest + React Testing Library
- Key dirs: `src/pages/`, `src/components/`, `src/api/`

**Backend**
- Runtime: Node.js (TypeScript)
- Framework: Express.js
- Database: PostgreSQL (Prisma ORM)
- Auth: JWT-based
- Key dirs: `server/src/services/`, `server/src/routes/`, `server/src/lib/`

**ML Pipeline** (Python)
- Framework: scikit-learn, pandas, numpy
- Training: Custom pipeline
- Inference: FastAPI service
- Key dirs: `ml/features/`, `ml/models/`, `ml/inference/`, `ml/training/`

**Testing Setup**
- Unit Tests: Vitest (TypeScript), Pytest (Python)
- E2E: (if any, not mentioned in coverage audit)
- Coverage Reporter: Istanbul (TS), Coverage.py (Python)
- CI/CD: GitHub Actions + SonarQube Scanner

**Key Scripts**
```bash
npm run build        # Compile TypeScript
npm run lint         # ESLint + Prettier
npm run test         # Run all tests
npm run test:coverage # Generate coverage report
npm run dev          # Dev server
npm run preview      # Preview build
```

**Current Test Files**
- 33 test files
- 146 passing tests
- Coverage: 39.4% overall
