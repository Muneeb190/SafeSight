# SafeSight AI

SafeSight AI is a responsive React/Next.js frontend for workplace safety detection. It connects to a separately running FastAPI service.

## Local development

1. Copy `.env.example` to `.env.local` and set `VITE_API_URL` (the frontend also accepts `NEXT_PUBLIC_API_URL`).
2. Start the FastAPI backend at `http://localhost:8000`.
3. Install dependencies with `pnpm install`.
4. Run `pnpm dev`, then open the displayed local URL.

## Production build

Run `pnpm build` and `pnpm start`.

## Backend contract

The UI calls `GET /api/health`, `GET /api/detections`, `POST /api/detect/image`, and `POST /api/detect/video`. File uploads use `FormData` without manually setting the multipart content type. Image detection expects an annotated image data URL and detection metadata; video detection expects an annotated video blob.

## Structure

- `app/page.tsx` — dashboard shell, detection workflows, webcam, charts, and history.
- `src/api.ts` — typed REST client and response normalization boundary.
- `app/globals.css` — dark industrial design system and responsive styles.
