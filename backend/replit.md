# SafeSight AI Backend

FastAPI backend for workplace-safety image and video detection using the user's fine-tuned YOLO model; the separate React frontend is out of scope.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the SafeSight API (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `python3.12 -m pytest` — Python backend tests
- `MODEL_PATH=models/best.pt` — trained checkpoint; not included in this project
- `MONGODB_URI` — optional in local development; required in production

## Stack

- pnpm monorepo and existing TypeScript shared libraries
- API service: Python 3.12, FastAPI, Uvicorn, Ultralytics YOLO, OpenCV, Pillow
- Optional data/evidence services: MongoDB Atlas and private S3-compatible storage
- OIDC bearer-token verification for production history access

## Where things live

- `app/` — SafeSight FastAPI backend and detection services
- `tests/` — API and safety-rule tests; real-model integration requires model weights and a sample image
- `models/` — checkpoint location; large model files are ignored by Git
- `README.md` — setup, endpoints, configuration, testing, video mode, and known limitations

## Architecture decisions

- Detection class names come from the trained model; a configured dataset YAML is checked against the checkpoint.
- Equipment-presence detections never prove PPE compliance; only explicit missing-PPE labels can raise a potential violation.
- Local video jobs are in-process and ephemeral; use a durable queue and shared result storage before production video use.

## Product

The API validates image/video uploads, returns YOLO detections and annotated evidence, and can store user/workplace-scoped inspection history.

## User preferences

- Do not build or modify the separate React frontend.

## Gotchas

- This project does not include trained weights, dataset YAML, or a sample image; health reports degraded until weights are supplied.
- The Replit Python resolver did not resolve Ultralytics in this environment; the dependency remains in `requirements.txt`, and Docker/local Python setup is documented.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
