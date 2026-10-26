# SafeSight AI Backend

FastAPI backend for workplace-safety image and video detection. The separate React application is not included or modified here.

## Current status and required inputs

- The API is implemented, but this project does not include `models/best.pt`, a dataset YAML, or a sample inspection image. The local server therefore starts in a **degraded** state and returns an actionable `503` for inference until real trained weights are provided.
- Class names come from the names embedded in the trained checkpoint. If `DATASET_YAML` is supplied, its class IDs and names are checked against the checkpoint at startup. No missing-helmet or missing-vest class is assumed.
- Safety assessments are deliberately limited: only explicit missing-PPE labels can create a potential violation. A helmet/vest detection is not treated as proof that any worker is wearing PPE. Predictions always require human review.
- Video uses in-process asynchronous jobs, with in-memory status/progress and temporary local result files. This works for a single development instance, but is **not a durable distributed production queue**. Before production video use, replace this job manager with a shared queue/worker and shared private result storage.
- Rate limiting is per process/IP, so production deployments with multiple workers should use a shared rate-limit store or gateway policy.
- Production history requires MongoDB, and production requests require an OIDC bearer token with a verified workplace claim. Login/signup is owned by the separate frontend identity provider; this API verifies tokens rather than minting them.
- The Replit Python package resolver in this workspace could not resolve `ultralytics`. It is listed in `requirements.txt`; install it in a normal Python environment or use the Docker build. Inference also requires the user's actual checkpoint.

## API

All routes use the `/api` prefix:

- `GET /api/health` — model/database readiness and model load error.
- `POST /api/detect/image` — multipart `file`; accepts JPEG, PNG, and WebP; optional `confidence` query (0.05–0.95) and `store_history` query.
- `POST /api/detect/video` — multipart MP4 upload; returns a job ID immediately.
- `GET /api/jobs/{job_id}` — job status and sampled-frame progress.
- `GET /api/jobs/{job_id}/result` — playable annotated MP4 after completion.
- `GET /api/detections` — authenticated, user-and-workplace-scoped history.
- `GET /api/detections/{inspection_id}` — authenticated, user-and-workplace-scoped inspection.
- `GET /api/docs` — interactive OpenAPI documentation.

Errors use a consistent JSON shape:

```json
{
  "error": {
    "code": "service_unavailable",
    "message": "Trained model weights were not found ...",
    "request_id": "..."
  }
}
```

The legacy `/api/healthz` route remains available for the Replit service health check.

### Image response

The response includes `inspection_id`, `detections` (`class_id`, `class_name`, `confidence`, and pixel `box`), `total_objects`, `safety_assessment`, a JPEG base64 data URL, model version, history status, and UTC creation time. Set `store_history=false` for webcam frames that should not create inspection history.

### Video processing mode

Video uploads are validated as MP4 by both MIME declaration and container signature, then decoded with OpenCV. This implementation accepts decodable H.264/avc1 and MPEG-4/mp4v inputs, enforces upload/duration/resolution/frame limits, and runs inference on every `VIDEO_FRAME_STRIDE`-th frame. Other frames are passed through unchanged; this service does not track workers between frames. Output is MP4 using the `mp4v` writer codec. The worker releases OpenCV resources and removes input/output temporary files when jobs fail or the service shuts down. Completed local results expire after `JOB_RETENTION_SECONDS`.

## Local setup

### Windows PowerShell

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
Copy-Item .env.example .env
# Put the supplied fine-tuned checkpoint at models\best.pt.
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080
```

If PowerShell blocks activation, run `Set-ExecutionPolicy -Scope Process Bypass` in that terminal, then activate the environment again.

### Replit workspace

The API uses the registered API service workflow. The workspace has Python 3.12 and the API dependencies installed; install the `ultralytics` package and add the real model weights before expecting detections. Run checks with:

```bash
python3.12 -m pytest
python3.12 -m uvicorn app.main:app --host 0.0.0.0 --port 8080
```

## Environment configuration

Copy `.env.example` to `.env` for local development. Important variables:

| Variable | Purpose |
| --- | --- |
| `MODEL_PATH` | Fine-tuned YOLO checkpoint; defaults to `models/best.pt`. |
| `DATASET_YAML` | Optional dataset YAML used to validate real class IDs/names. |
| `MODEL_DEVICE` / `MODEL_IMGSZ` | Inference device and image size. |
| `CONFIDENCE_THRESHOLD` | Default confidence, bounded to 0.05–0.95. |
| `MONGODB_URI` / `MONGODB_DATABASE` | Optional local MongoDB Atlas connection; production requires a reachable database. |
| `AUTH_MODE` | `disabled` only for local development; production requires `required`. |
| `AUTH_ISSUER` / `AUTH_JWKS_URL` | OIDC issuer and trusted JWKS endpoint used to verify RS256 bearer tokens. |
| `AUTH_WORKPLACE_CLAIM` | Signed token claim used to scope records; defaults to `workplace_id`. |
| `CORS_ORIGINS` | Comma-separated exact origins for the separate frontend. Empty means no browser origins are allowed. |
| `S3_BUCKET` | Optional private S3-compatible evidence bucket; credentials use the AWS SDK credential chain. |

Set secrets through the Replit Secrets tool or the hosting provider's secret manager. Do not commit `.env` or credentials. Production (`APP_ENV=production`) requires the model, MongoDB, and auth configuration.

For production auth, configure the separate frontend identity provider to issue a signed token containing a `workplace_id` claim. The API checks the signature against `AUTH_JWKS_URL`, checks the issuer and optional audience, and scopes every history query by both `sub` and workplace ID. The default local identity is fixed and must never be enabled in production.

## Example API calls

```powershell
# Health
curl.exe http://localhost:8080/api/health

# Image detection; store_history=false is useful for webcam frames
curl.exe -X POST "http://localhost:8080/api/detect/image?store_history=false" `
  -F "file=@.\sample.jpg;type=image/jpeg"

# Submit an MP4, then poll the returned status URL
curl.exe -X POST http://localhost:8080/api/detect/video `
  -F "file=@.\sample.mp4;type=video/mp4"
curl.exe http://localhost:8080/api/jobs/<job_id>
curl.exe -o .\annotated.mp4 http://localhost:8080/api/jobs/<job_id>/result
```

The local development identity is accepted without a bearer token only while `AUTH_MODE=disabled`. Production history and detection routes require a verified bearer token.

## Testing

```powershell
python -m pytest
```

Unit tests mock model inference and cover health, image validation, response schema, upload limits, safety rules, database-not-configured behavior, model load errors, and video temporary-file cleanup. The real-model integration test is skipped unless both `models/best.pt` and `tests/assets/safety-sample.jpg` exist. Add a representative image only if you have rights to use it and it contains no unnecessary personal data.

## Training/model integration and attribution

Train with the dataset's actual YAML and labels; do not rename or infer violation classes from ordinary PPE detections. For example, after installing Ultralytics and preparing a dataset YAML:

```powershell
yolo detect train model=yolo11n.pt data=.\dataset\data.yaml epochs=100 imgsz=640
Copy-Item .\runs\detect\train\weights\best.pt .\models\best.pt
```

Set `DATASET_YAML=dataset/data.yaml` to check the class IDs/names against the checkpoint. Before use, document the base model license, the fine-tuned weights' provenance, dataset name/version/license, and any restrictions on workplace imagery. Do not claim that a model is compliant with a safety standard without qualified review.

## Docker

```powershell
docker build -t safesight-api .
docker run --rm -p 8080:8080 `
  -e APP_ENV=production `
  --env-file .env `
  -v "${PWD}\models:/app/models:ro" `
  safesight-api
```

Set production MongoDB and auth settings in the secret manager before starting the production container; it fails closed if these or the model are missing. Use a private model/evidence storage mechanism and an appropriate runtime mount for production. Keep uploaded images/videos out of MongoDB; only metadata and private object-storage references are stored there.

## Project layout

```text
app/
  main.py                 FastAPI app, routes, error responses and lifecycle
  config.py               Environment-backed settings and production requirements
  detector.py             One-time YOLO loading and inference
  safety_rules.py         Versioned conservative rule assessment
  auth.py                 OIDC bearer-token verification and principal scoping
  database.py             Optional MongoDB inspection store and indexes
  storage.py              Private S3-compatible evidence adapter
  schemas.py              API request/response schemas
  services/uploads.py     Image/video validation and bounded uploads
  services/video_jobs.py  Local asynchronous video job processor
tests/                    Mocked unit tests and optional real-model integration
models/                   Place the licensed fine-tuned checkpoint here
```
