# PDF Knowledge Pipeline — Manual QA Checklist

Use this document to **verify every section** of `PDF_KNOWLEDGE_ARCHITECTURE.md` against the running app.  
Check boxes as you go. Log bugs in the **Bug log** section at the end.

**Related docs:** architecture spec (`PDF_KNOWLEDGE_ARCHITECTURE.md`), API Swagger (`http://localhost:3001/api/docs`).

---

## 1. Before you start (environment)

### 1.1 Services that must be running

#### Stack in Docker (recommended for PDF pipeline)

From repo root:

```powershell
docker compose up -d postgres redis qdrant backend frontend
```

Ollama stays on the **host** (Docker backend uses `OLLAMA_BASE_URL=http://host.docker.internal:11434`).

| Service | Container | Health check |
|--------|-----------|--------------|
| **PostgreSQL** | `smartmaint-postgres` | `docker ps` → host port (often `5432` or `5433`) |
| **Redis** | `smartmaint-redis` | 13 queues health |
| **Qdrant** | `smartmaint-qdrant` | `http://localhost:6333/collections` |
| **Ollama** | Host machine | `http://localhost:11434/api/tags` |
| **Backend** | `smartmaint-backend` | `http://localhost:3001/api/health` |
| **Frontend** | `smartmaint-frontend` | `http://localhost:3000` |

**Inside Docker the backend already uses:**

| Variable | Value in container | Do not use on host for in-container DB |
|----------|-------------------|--------------------------------------|
| `DATABASE_HOST` | `postgres` | `localhost` only when running CLI on your PC |
| `DATABASE_PORT` | `5432` | Host-mapped port when running CLI on your PC |
| `REDIS_HOST` | `redis` | |
| `QDRANT_URL` | `http://qdrant:6333` | |

`docker-compose.yml` sets **`DATABASE_SYNCHRONIZE=false`** so TypeORM does not `DROP CONSTRAINT` on every boot.

**Run migrations (pick one):**

```powershell
# A) Inside the backend container (uses postgres:5432 — preferred)
docker compose exec backend npm run migration:run

# B) From your PC (use host port from `docker ps`, e.g. 5432)
cd backend
# backend/.env: DATABASE_HOST=localhost  DATABASE_PORT=5432
npm run migration:run
```

**Optional seed:**

```powershell
docker compose exec backend npm run db:seed
```

**After code changes** (e.g. synchronize fix): rebuild/restart backend:

```powershell
docker compose up -d --build backend
```

#### Backend on host (not Docker)

| Service | How to start | Health check |
|--------|--------------|--------------|
| **PostgreSQL** | `docker compose up -d postgres` | Host port from `docker ps` |
| **Backend** | `cd backend && npm run start:dev` | `GET http://localhost:3001/api/health` |
| **Frontend** | `cd frontend && npm run dev` | `http://localhost:3000` |

Point `backend/.env` at `DATABASE_HOST=localhost` and the **published** Postgres port. Run `npm run migration:run` from `backend/`.

**Important:** Never set **`DATABASE_SYNCHRONIZE=true`**. If the API logs many `DROP CONSTRAINT` / `ALTER TABLE` lines on startup, restart with synchronize off and run migrations again.

Optional seed users:

```powershell
cd backend
npm run db:seed
```

### 1.2 Ollama models to pull (15)

```bash
ollama pull llama3.1:8b
ollama pull nomic-embed-text
ollama pull llava:latest
```

Match `OLLAMA_MODEL`, `OLLAMA_EMBED_MODEL`, `OLLAMA_VISION_MODEL` in `.env` / `backend/.env`.

### 1.3 Test accounts (after seed)

| Role | Email | Password | Use for |
|------|-------|----------|---------|
| Superadmin | `superadmin@smartmaint.com` | `superadmin123` | Full admin + pipeline |
| Admin | `admin@smartmaint.com` | `admin123` | PDF upload, review, fix queue |
| Technician | `tech@smartmaint.com` | `tech123` | Experience, PDF read-only, chat |

Login: `http://localhost:3000/login`

### 1.4 Test files to prepare (keep in a `qa-fixtures/` folder)

| File | Purpose | Sections |
|------|---------|----------|
| **Valid machine manual** (20+ pages, text layer, “troubleshooting”, fault tables) | Happy path extraction + gate accept | 1–8, 22 |
| **Same manual re-uploaded** | Fingerprint duplicate block | 1, 11 |
| **Tiny / blank-page scan** | `unreadable` pages → page-fix queue | 5, 17.3 |
| **Non-work PDF** (recipe, game rules) | Gate reject | 2 |
| **Borderline PDF** (catalog, mixed content) | Gate `needs_review` or Tier 2/3 | 2 |
| **Second revision** of manual | Supersede chain | 11 |
| **JPEG/PNG** (not PDF) | Upload rejection | 1 |
| **Oversized PDF** (> `KNOWLEDGE_PDF_MAX_BYTES`) | Size rejection | 1, 16 |

### 1.5 Where to look when something fails

| Symptom | Check |
|---------|--------|
| Upload stuck / no progress | Backend logs, Redis, `GET /api/knowledge-documents/queues/health` |
| Gate / extraction errors | Backend console, document `error` field on detail page |
| Chat has no manual answers | Qdrant up, Ollama embed model, document `status` = `done`, approved candidates |
| OCR/vision does nothing | `ENABLE_PDF_OCR`, `ENABLE_PDF_VISION`, `paddle-ocr` service healthy, Poppler in backend image |
| WebSocket progress | Browser devtools → Network → WS; technician PDF detail page |

### 1.6 Admin navigation map (Pipeline hub)

Open **`/dashboard/admin/manual-pipeline`** — cards link to most 17 surfaces.  
Sidebar: PDF Library, Knowledge base, Page fix queue, Pipeline env, DB inventory, QA 20, 22 Extraction, 23 Export, Swagger.

---

## 2. Section-by-section tests

Legend: **UI** = click path · **API** = Swagger or curl · **DB** = optional SQL/pgAdmin · **Pass criteria** = expected outcome.

---

### 1 — Ingestion & validation

| # | Step | Pass criteria |
|---|------|----------------|
| 1.1 | **UI:** Admin → **PDF Library** (`/dashboard/admin/knowledge-docs`) → Upload valid manual | **202** behavior: row appears; status moves from `uploaded` → processing stages; no long browser hang |
| 1.2 | Upload same file again (no supersede) | Rejected as duplicate / fingerprint; temp file not left orphan (no duplicate row or clear error) |
| 1.3 | Upload `.jpg` renamed to `.pdf` or corrupt bytes | Clear error; no document row |
| 1.4 | Upload file > 30 MiB (if default env) | Rejected with size message |
| 1.5 | **API:** `POST /api/knowledge-documents/upload` (multipart `file`) with JWT | Same as UI; response includes `documentId` |
| 1.6 | **DB:** `knowledge_documents` | `filePath`, `fingerprint`, `totalPages`, `uploadedById` populated |

**Bugs to watch:** progress 0% forever; upload succeeds but no gate job (Redis down).

---

### 2 — Upload gate (work-related)

| # | Step | Pass criteria |
|---|------|----------------|
| 2.1 | Upload **non-work** PDF | Status `rejected`; pipeline stops; no extraction candidates |
| 2.2 | Upload **clear manual** | Passes gate; `docType` set; `isWorkRelated` true; continues to extraction queue |
| 2.3 | Upload **borderline** PDF | `needs_review` or `gated` — open detail; use **Approve gate** / **Reject gate** if shown |
| 2.4 | **API:** After upload, `GET /api/knowledge-documents/:id` | `gateConfidence`, `docType`, `needsReview` sensible |
| 2.5 | **UI:** Gate reject — document list | Rejected docs visible; do not pollute candidates |
| 2.6 | Tune env `GATE_TIER1_REJECT_BELOW` high temporarily, restart backend, re-test | More aggressive reject (optional stress) |

**Bugs to watch:** irrelevant PDFs reach extraction; good manuals rejected without review path.

---

### 3 — Machine profile auto-detection

| # | Step | Pass criteria |
|---|------|----------------|
| 3.1 | After gate on manual with cover title/model | `machineName` on document and/or `machineProfileId` set |
| 3.2 | **UI:** **Machine profiles** (`/dashboard/admin/machine-profiles`) | New or matched profile row |
| 3.3 | **UI:** Profile → **Manage** (`/dashboard/admin/machine-profiles/:id`) | Summary counts: PDF count, approx knowledge counts |
| 3.4 | **API:** `GET /api/machine-profiles`, `GET /api/machine-profiles/:id/summary` | JSON matches UI |
| 3.5 | **UI:** PDF detail → edit official machine name; technician **suggest** name | Suggestion pending; admin approve/reject suggestion |
| 3.6 | Manual with no machine on cover | `machineUnknown` or empty name; admin can PATCH machine name |

**Bugs to watch:** profile not linked; duplicate profiles for same machine/manufacturer.

---

### 4 — Doc-type routing

| # | Step | Pass criteria |
|---|------|----------------|
| 4.1 | Upload manuals of different types (safety vs electrical if you have samples) | `docType` on document differs appropriately |
| 4.2 | **UI:** PDF detail → **Page analysis** table | `sectionType` column: `fault_table`, `wiring`, `procedure_steps`, etc. |
| 4.3 | Extraction candidates | `sectionType` / `entryType` on candidates reflect tables vs procedures |
| 4.4 | **API:** `GET /api/knowledge-documents/:id/page-analysis` | Paginated rows with `quality`, `sectionType` |

**Bugs to watch:** all pages `general`; wrong `docType` for obvious safety manual.

---

### 5 — Page quality scoring

| # | Step | Pass criteria |
|---|------|----------------|
| 5.1 | Upload scan with many blank pages | Some pages `unreadable` in page analysis |
| 5.2 | **UI:** **Page fix queue** (`/dashboard/admin/page-fix-queue`) | Open items for unreadable pages; link to document |
| 5.3 | **Fix text:** paste OCR text for a page → submit | Queue item fixed; page analysis `ocrText` updated |
| 5.4 | **Upload image** on fix item (JPEG/PNG/WebP) | Vision runs if enabled; thumbnail/preview if replacement set |
| 5.5 | **Dismiss** queue item | Status dismissed; pipeline not blocked |
| 5.6 | **API:** `GET /api/knowledge-documents/page-fix-queue` | Lists open items |

**Bugs to watch:** `poor` pages not in queue (by design only `unreadable` auto-enqueue); fix does not update RAG until reindex (see 12).

---

### 6 — Content extraction (text / OCR / vision)

| # | Step | Pass criteria |
|---|------|----------------|
| 6.1 | **UI:** Pipeline env (`/dashboard/admin/pipeline-config`) | `ENABLE_PDF_OCR`, `ENABLE_PDF_VISION`, effective vision toggle visible |
| 6.2 | Process manual with low-quality pages | OCR jobs run (logs or page rows get `extractionMode` `ocr`) |
| 6.3 | **UI:** PDF detail → **Run OCR** | Completes without 500; page `ocrText` fills |
| 6.4 | **UI:** PDF detail → **Run vision** (requires vision on) | `visionUsed` true on pages; `ocrText` improved or warning stored |
| 6.5 | **API:** `POST .../:id/run-ocr`, `POST .../:id/run-vision` | Same as UI |
| 6.6 | Disable OCR in env, restart, upload scan | Vision-only path on low-quality pages (bounded) |

**Bugs to watch:** `paddle-ocr` not running or unhealthy; Poppler missing in backend image; Ollama vision model missing → warnings only.

---

### 7 — Structured knowledge extraction

| # | Step | Pass criteria |
|---|------|----------------|
| 7.1 | Wait for extraction job on uploaded manual | **Extraction candidates** appear on PDF detail |
| 7.2 | Progress bar / stage on PDF list | `currentStage`, `progressPercent`, pages processed update (poll or WS on tech detail) |
| 7.3 | **API:** `GET /api/knowledge-documents/:id/extractions` | Array of candidates `status: candidate` |
| 7.4 | Document reaches `done` or `processing` → `done` | `chunksIndexed` > 0 when extraction indexed manual chunks |
| 7.5 | **UI:** 22 reference (`/dashboard/admin/troubleshooting-extraction`) | Page loads; lists queues, env keys, schema |

**Bugs to watch:** zero candidates on large manual (check `DOC_EXTRACTION_MAX_CHUNKS`); JSON parse failures in logs.

---

### 8 — Admin review loop

| # | Step | Pass criteria |
|---|------|----------------|
| 8.1 | **Approve** candidate (no edits) | Candidate `approved`; row in **Knowledge base**; sidebar PDF badge decreases |
| 8.2 | **Approve with edits** (change title/problem/solution) | Knowledge entry reflects edits |
| 8.3 | **Reject** candidate with reason | Candidate `rejected`; no knowledge entry |
| 8.4 | **UI:** **Extraction feedback** (`/dashboard/admin/extraction-feedback`) | New row: `approve`, `approve_edit`, or `reject` |
| 8.5 | **API:** `POST .../extractions/:id/approve`, `.../reject` | Same as UI |

**Bugs to watch:** approved entry not in RAG; `knowledgeDocumentId` null on old approvals (re-approve after migration).

---

### 9 — Technician experience entries

| # | Step | Pass criteria |
|---|------|----------------|
| 9.1 | Login as **technician** → **Knowledge** (`/dashboard/technician/knowledge`) | Can create experience (pending review) |
| 9.2 | **Admin:** **Knowledge base** (`/dashboard/admin/knowledge`) | Pending count badge; approve/reject |
| 9.3 | Approve technician entry | `reviewStatus` approved; appears in Techo answers |
| 9.4 | Reject with reason | Stays rejected; not in chat RAG |
| 9.5 | **API:** `GET /api/knowledge/pending-review`, `POST .../approve` | Matches UI |

**Bugs to watch:** technician sees other users’ drafts; approved entry not searchable in chat.

---

### 10 — Field photo knowledge & Techo chat

| # | Step | Pass criteria |
|---|------|----------------|
| 10.1 | Technician: attach **photo** to knowledge entry | Upload succeeds; pending if required |
| 10.2 | Open **Techo** (floating button, any dashboard page) | Send text question about approved knowledge / manual |
| 10.3 | Attach **image** in Techo (if `ENABLE_CHAT_IMAGE_VISION`) | Reply references image or degrades gracefully |
| 10.4 | Ask about approved fault/candidate topic | **Sources used** section on reply (document/page/title) |
| 10.5 | **API:** `POST /api/chat/message` with `history`, optional `imageBase64` | `reply` + `sources` array |

**Bugs to watch:** empty sources; chat 401; vision timeout.

---

### 11 — Cross-document dedup & supersede

| # | Step | Pass criteria |
|---|------|----------------|
| 11.1 | Re-upload **identical** manual | Blocked by fingerprint |
| 11.2 | Upload **new version** with `supersedesDocumentId` (UI banner/link on PDF library when replacing) | Old doc `superseded`; new doc active |
| 11.3 | **Show superseded** checkbox on PDF list | Superseded rows visible |
| 11.4 | Chat/manual retrieval | Prefer current revision (vectors purged on predecessor — best effort) |
| 11.5 | Delete superseded or active doc | Manual chunks removed from Qdrant (check logs if Qdrant down) |

**Bugs to watch:** both revisions answer in chat; supersede UI missing.

---

### 12 — Embedding & Qdrant indexing

| # | Step | Pass criteria |
|---|------|----------------|
| 12.1 | After extraction completes | `chunksIndexed` on document |
| 12.2 | **UI:** PDF detail → **Reindex manual chunks** | Success toast; count returned |
| 12.3 | After **page fix text/image** | RAG should reflect fix (auto reindex best-effort) |
| 12.4 | Techo question on specific manual content | Answer cites manual; sources list chunk metadata |
| 12.5 | **Qdrant:** `http://localhost:6333/collections/manual_chunks` | Points exist for `documentId` |

**Bugs to watch:** Postgres updated but Qdrant empty (embedding failures logged only).

---

### 13 — Bull queues & job tracking

| # | Step | Pass criteria |
|---|------|----------------|
| 13.1 | **API:** `GET /api/knowledge-documents/queues/health` (admin JWT) | Redis PING ok; counts per queue: gate, extraction, ocr, vision, indexing |
| 13.2 | Upload PDF | Rows in `knowledge_document_jobs` (optional DB check) |
| 13.3 | Stop Redis, upload PDF | Graceful failure or logged errors; no silent success |

**Bugs to watch:** jobs stuck in `queued` forever; duplicate jobs on retry.

---

### 14 — Extraction feedback (analytics)

| # | Step | Pass criteria |
|---|------|----------------|
| 14.1 | Approve/reject several candidates | **Extraction feedback** table grows |
| 14.2 | Filter/limit on admin page | Respects `?limit=` |
| 14.3 | **API:** `GET /api/knowledge-documents/extraction-feedback/recent?limit=50` | JSON rows with `signal`, `docType`, `sectionType` |

**Note:** No automatic prompt tuning yet — analytics only.

---

### 15 — Model strategy

| # | Step | Pass criteria |
|---|------|----------------|
| 15.1 | Wrong/missing `OLLAMA_MODEL` | Gate/extraction errors logged; document `error` may set |
| 15.2 | Missing `nomic-embed-text` | Tier 2 / indexing fails gracefully |
| 15.3 | Missing vision model with vision ON | Page warnings `vision_model_failed`; pipeline continues |
| 15.4 | **UI:** Pipeline env → Ollama section | Shows configured URLs/models |

---

### 16 — Performance knobs & pipeline config

| # | Step | Pass criteria |
|---|------|----------------|
| 16.1 | **UI:** `/dashboard/admin/pipeline-config` | Shows gate, OCR, vision, extraction caps, Qdrant, Bull |
| 16.2 | Compare with `.env.example` | Values match what backend actually uses |
| 16.3 | Change `DOC_EXTRACTION_MAX_CHUNKS=5`, restart backend, re-upload large manual | Fewer LLM calls / fewer candidates (bounded) |
| 16.4 | Toggle **PDF vision** in UI (admin preference) | `PATCH pipeline-preferences/pdf-vision`; effective only if env `ENABLE_PDF_VISION=true` |

---

### 17 — Admin dashboards (consolidated)

| Surface | Route | Quick smoke test |
|---------|-------|------------------|
| PDF list | `/dashboard/admin/knowledge-docs` | Upload, progress, superseded toggle, delete |
| PDF detail | `/dashboard/admin/knowledge-docs/:id` | Page analysis, candidates, OCR/vision/reindex, gate actions |
| Page fix queue | `/dashboard/admin/page-fix-queue` | Fix text, image, dismiss |
| Machine profiles | `/dashboard/admin/machine-profiles` | Create, manage, PATCH |
| Knowledge (admin) | `/dashboard/admin/knowledge` | Pending approve, export csv/xlsx |
| Extraction feedback | `/dashboard/admin/extraction-feedback` | Rows after 8 actions |
| Pipeline env | `/dashboard/admin/pipeline-config` | Read-only snapshot |
| DB inventory | `/dashboard/admin/database-inventory` | Table list loads |
| QA 20 | `/dashboard/admin/success-criteria` | Matrix matches doc |
| 22 reference | `/dashboard/admin/troubleshooting-extraction` | Reference JSON |
| 23 export | `/dashboard/admin/problems-solutions-export` | Download xlsx/csv with filters |
| Pipeline hub | `/dashboard/admin/manual-pipeline` | All cards link correctly |
| Technician PDFs | `/dashboard/technician/knowledge-pdfs` | List + detail + WS progress |
| Sidebar badges | Any admin page | PDF candidates, page fix, knowledge pending counts |

---

### 18 — API reference (Swagger sweep)

| # | Step | Pass criteria |
|---|------|----------------|
| 18.1 | Open `http://localhost:3001/api/docs` | Swagger loads |
| 18.2 | **Authorize** with JWT from `POST /api/auth/login` | Locked endpoints work |
| 18.3 | Smoke-test one endpoint per group: auth, knowledge-documents, knowledge, chat, export, machine-profiles | 200/201/202 as documented in architecture 18 |
| 18.4 | Technician JWT on admin-only routes | **403** |

Use architecture doc 18 as the checklist of routes; mark any 404 or wrong role.

---

### 19 — Database tables

| # | Step | Pass criteria |
|---|------|----------------|
| 19.1 | **UI:** `/dashboard/admin/database-inventory` | Curated table list renders |
| 19.2 | **API:** `GET /api/knowledge-documents/database-inventory` | Same data |
| 19.3 | After full pipeline run, spot-check tables | Rows in: `knowledge_documents`, `knowledge_document_page_analysis`, `knowledge_extraction_candidates`, `knowledge_entries`, `vector_chunk_hashes` (if indexing ran) |

---

### 20 — Success criteria / QA matrix

| # | Step | Pass criteria |
|---|------|----------------|
| 20.1 | **UI:** `/dashboard/admin/success-criteria` | Table: shipped / partial / gap / aspirational |
| 20.2 | **API:** `GET /api/knowledge-documents/qa-success-criteria` | Same rows as UI |
| 20.3 | Manually verify 2–3 “gap” items from matrix | Document whether still true (e.g. chat latency SLA, crash resume) |

---

### 21 — Implementation order

No separate feature — use 21 as **recommended test order** for a full regression:

1. 1 upload → 2 gate → 3 profile → 4–6 page pipeline → 7 extraction → 8 approve → 12 chat  
2. 9 technician path in parallel  
3. 11 supersede + 23 export  
4. 13–20 ops surfaces  

---

### 22 — Troubleshooting / P→S extraction

| # | Step | Pass criteria |
|---|------|----------------|
| 22.1 | Manual with “Troubleshooting” section | Extraction prefers text after that heading (more fault-like candidates) |
| 22.2 | Candidates include problem/solution fields | `problemDescription`, `solution`, optional `symptom`, `rootCause` |
| 22.3 | **UI:** 22 reference page | Documents `processDocumentExtraction`, Bull queue names |
| 22.4 | Approve fault candidate | Becomes knowledge entry; Techo can answer from it |

---

### 23 — Export problems & solutions

| # | Step | Pass criteria |
|---|------|----------------|
| 23.1 | Approve several PDF + technician entries | Approved rows exist |
| 23.2 | **UI:** `/dashboard/admin/problems-solutions-export` | Download **xlsx** and **csv** |
| 23.3 | Filter by **machine** substring | Fewer rows |
| 23.4 | Filter by **documentId** (PDF promoted after migration) | Only rows linked to that PDF |
| 23.5 | Filter **from** / **to** dates | Subset by `createdAt` |
| 23.6 | Open xlsx | Sheet “Problems & Solutions”; header row styled; manufacturer/PDF title when linked |
| 23.7 | **API:** `GET /api/export/problems-solutions-reference` | Params documented |
| 23.8 | Technician: `GET /api/knowledge/export/csv` | Own rows only (raw columns, different from 23) |

---

## 3. WebSocket progress (technician)

| # | Step | Pass criteria |
|---|------|----------------|
| WS.1 | Technician → PDF detail (`/dashboard/technician/knowledge-pdfs/:id`) | DevTools → WS to `/documents` namespace |
| WS.2 | While processing | `document:progress` events update UI |
| WS.3 | Leave page | Unsubscribe / no leak errors in console |

**Note:** `document:complete` / `failed` are **not** separate events — use REST `GET .../status` if needed.

---

## 4. End-to-end “golden path” (30–60 min)

Do once after environment is green:

1. Login **admin** → upload **machine manual** → wait until candidates appear.  
2. **Approve** 3 candidates → confirm **Knowledge base** entries.  
3. Login **technician** → submit **experience** → admin **approve**.  
4. Open **Techo** → ask question matching manual + experience → confirm **sources**.  
5. Upload **replacement** PDF with supersede → confirm old doc superseded.  
6. **Export** 23 xlsx with machine filter.  
7. Open **success criteria** + **queues health** — no Redis/Qdrant errors.

---

## 5. Bug log template

Copy rows as needed:

| ID |  | Steps | Expected | Actual | Severity | Screenshot/log |
|----|---|-------|----------|--------|----------|----------------|
| BUG-001 | 2 | Upload recipe PDF | rejected | processing | high | |
| BUG-002 | 12 | Techo after approve | sources shown | empty | medium | |

**Severity:** `blocker` | `high` | `medium` | `low`

---

## 6. Known gaps (do not file as bugs without product decision)

From architecture doc — expected limitations:

- No SLA timer on candidate review (8).  
- No Excel export summary block (23).  
- `document:complete` WebSocket not implemented.  
- Technician export on `/export/problems-solutions` same as admin (not scoped to own rows).  
- French-only “Dépannage” manuals may not slice at troubleshooting (22 English substring).  
- Qdrant write failure = log-only; Postgres still commits (11/12).  
- Page-fix queue only auto-opens for `unreadable`, not all `poor` pages (5).

---

## 7. Quick API commands (PowerShell)

Replace `$TOKEN` after login.

```powershell
# Health
Invoke-RestMethod http://localhost:3001/api/health

# Login
$body = @{ email = "admin@smartmaint.com"; password = "admin123" } | ConvertTo-Json
$auth = Invoke-RestMethod -Method Post -Uri http://localhost:3001/api/auth/login -Body $body -ContentType "application/json"
$TOKEN = $auth.access_token

# Queue health
Invoke-RestMethod -Uri http://localhost:3001/api/knowledge-documents/queues/health -Headers @{ Authorization = "Bearer $TOKEN" }

# List documents
Invoke-RestMethod -Uri http://localhost:3001/api/knowledge-documents -Headers @{ Authorization = "Bearer $TOKEN" }
```

---

*Last aligned with `PDF_KNOWLEDGE_ARCHITECTURE.md` sections 1–23 and admin/technician routes in the Next.js app.*
