# Flow Project Backend

Node.js + TypeScript + Express + MongoDB backend for dynamic forms, flows, conditional branching, and analytics.

## Quick Start

1. Copy `.env.example` to `.env` and set `MONGODB_URI`.
2. Install deps: `npm install`
3. Run dev: `npm run dev`

Endpoints:
- `GET /api/health`
- Forms CRUD: `/api/forms`
- Flows CRUD: `/api/flows`
- Runner: `POST /api/runner/start`, `POST /api/runner/:sessionId/submit`, `GET /api/runner/:sessionId/state`
- Submissions: `/api/submissions`
- Analytics: `/api/analytics/flows/:flowId`

## Data model
- Form: flexible fields
- Flow: nodes + conditional edges
- Submission: answers per session, path, completion flag

## Notes
- Versioning is naive bump on publish; adjust to copy-on-write if needed.
- Add auth/RBAC later.
