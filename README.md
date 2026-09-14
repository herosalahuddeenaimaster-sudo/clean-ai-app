# Clean AI — Backend

Secure backend for the Clean AI Android app. The app never talks to an AI
vendor directly — it only talks to this service over HTTPS, and this
service talks to a swappable AI provider.

```
Android App → HTTPS → This Backend → AI Provider (mock or real) → Temp storage → Backend → Android App
```

## Run locally

```bash
cd backend
cp .env.example .env      # already done if you're using the checked-in .env
npm install
npm start                 # or: npm run dev  (auto-restarts on file changes)
```

Server starts on `http://localhost:8080` by default. `AI_PROVIDER=mock`
out of the box, so nothing here ever calls a paid API until you change it.

> This project was scaffolded in a sandboxed environment without npm
> registry access, so `npm install` hasn't been run or verified end-to-end
> here. The code is written and reviewed carefully, but run it locally and
> watch the console for any dependency hiccups before shipping.

## API

| Method | Path                     | Purpose                                             |
|--------|--------------------------|------------------------------------------------------|
| GET    | `/api/health`            | Liveness check                                       |
| POST   | `/api/upload`             | Upload a media file or mask (`multipart/form-data`, field `file`) |
| POST   | `/api/jobs`               | Create a processing job from two uploaded file ids    |
| GET    | `/api/jobs/:jobId`        | Poll job status/progress                              |
| GET    | `/api/jobs/:jobId/result` | Download the finished file once `status = completed`  |
| DELETE | `/api/jobs/:jobId`        | Cancel a queued/processing job                        |

### Typical flow

```bash
# 1. Upload the source image
curl -F "file=@photo.jpg" http://localhost:8080/api/upload
# -> { "fileId": "abc-123", "kind": "image", ... }

# 2. Upload the mask (white = remove, black = keep, same dimensions as source)
curl -F "file=@mask.png" http://localhost:8080/api/upload
# -> { "fileId": "def-456", "kind": "mask", ... }

# 3. Create the job
curl -X POST http://localhost:8080/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"mediaFileId":"abc-123","maskFileId":"def-456","mediaType":"image"}'
# -> { "jobId": "job-789", "status": "queued", ... }

# 4. Poll until status is "completed" or "failed"
curl http://localhost:8080/api/jobs/job-789

# 5. Download the result
curl http://localhost:8080/api/jobs/job-789/result -o cleaned.jpg
```

## Project layout

```
src/
  index.js              Express app entry point
  config.js             Reads all config from env vars (see .env.example)
  logger.js              Tiny structured console logger
  errors/ApiError.js     Typed error -> consistent JSON error responses
  middleware/            errorHandler, notFound
  routes/                upload, jobs, health — thin, validate + delegate
  services/
    fileStore.js          In-memory registry of uploaded files
    jobStore.js            In-memory registry of processing jobs
    jobQueue.js             Sequential worker loop that calls the provider
    cleanupService.js       Periodic deletion of expired temp files
    fileValidation.js       Mime-type / size-limit rules
    storage.js               Local-disk storage bootstrap
  providers/
    AIProvider.js            Interface every provider implements
    MockProvider.js           Local simulation (sharp-based clone-stamp for images)
    RealProviderTemplate.js   Documented stub — fill in your vendor's real calls
    index.js                   Factory: picks provider from AI_PROVIDER env var
```

## Swapping in a real AI provider

1. Pick a vendor for image/video inpainting and read their actual API docs.
2. Implement `RealProviderTemplate.process()` against their real endpoints
   (nothing here invents endpoints for you — the TODOs are deliberately
   left blank).
3. Set `AI_PROVIDER=real` and `AI_API_KEY` / `AI_API_BASE_URL` in `.env`.
4. Nothing else changes — routes, the queue, and the Android app are all
   already written against the provider-agnostic job API above.

## Notes on the in-memory stores

`fileStore` and `jobStore` are `Map`s in process memory — intentional for
an MVP/mock deployment. For production:
- Swap them for a real database (Postgres/Redis) so multiple backend
  instances can share state.
- Swap `services/storage.js`'s local-disk reads/writes for S3/GCS calls.
- Swap `jobQueue.js`'s internals for BullMQ + Redis (or SQS/Cloud Tasks)
  for real concurrency and durability across restarts.

None of those changes touch `routes/` or `providers/` — that separation
is the point.

## Security notes

- API keys are only ever read from environment variables, never
  hard-coded, and never sent to the Android app.
- Uploaded/result files are deleted automatically after
  `FILE_RETENTION_MINUTES` (default 60).
- Upload size and mime type are validated server-side, not just trusted
  from the client.
