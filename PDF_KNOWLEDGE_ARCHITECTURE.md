# PDF Knowledge Architecture — SmartMaint
# Complete Reference Document (Implementation Guide)

This document is the single source of truth for the PDF Knowledge pipeline in SmartMaint.
Any developer or AI model implementing this system must follow this document exactly.
No feature should be built outside this plan without updating this document first.

---

## Product vision (what we are building)

SmartMaint should behave like giving a **PDF or a field photo** to ChatGPT/Claude/Gemini: the system **reads** it, **explains** it in clear technician language, and **stores** that understanding so **Techo** can answer later from **Qdrant** (the “Wikipedia” layer for RAG).

| Input | What happens | Where it lives for search |
|--------|----------------|---------------------------|
| **PDF manual** | Poppler draft → PaddleOCR-VL on hard pages → vision “page explanation” on menus/diagrams/LCD pages → chunk + embed | **`knowledge_document_page_analysis.ocrText`** → routed chunks → **Qdrant `manual_chunks`** |
| **Field photo** (technician experience) | Vision describes the photo on upload | **`knowledge_entries.photoVisionDescription`** → **`buildIndexText`** → **Qdrant** (knowledge entry points) |
| **Structured faults/procedures** | LLM extracts candidates (separate from page text) | PostgreSQL **`knowledge_extraction_candidates`** → approved → **`knowledge_entries`** |

**Three employees (pipeline roles):**

1. **Poppler** — fast text-layer draft; **not trusted alone** when glyph corruption is detected (custom/LCD fonts).
2. **PaddleOCR-VL** — page-as-image OCR (tables, scans, display fonts).
3. **Vision** — explains the page like a human expert; result is stored in **`ocrText`** (same column OCR uses) so **`buildRoutedChunks`** and Qdrant see clean text.

**Before first Qdrant index (default):** inline OCR (`PDF_OCR_INLINE_BEFORE_INDEX`) then inline page explanation (`PDF_PAGE_EXPLAIN_BEFORE_INDEX`). After async OCR/vision jobs finish, **`PDF_OCR_AUTO_REINDEX`** refreshes Qdrant without a manual button.

**Ops:** Ollama must run for embeddings (`nomic-embed-text` at `OLLAMA_BASE_URL`). Re-upload or re-index old PDFs after pipeline changes — stale Qdrant rows keep bad Poppler-only text.

---

## Purpose

SmartMaint is a maintenance management system used in industrial environments.
The PDF Knowledge pipeline allows the system to:

- Ingest technical PDF documents (machine manuals, circuit guides, safety documents)
- Extract structured knowledge from them automatically
- Combine that knowledge with field experience added by technicians
- Make all of it searchable via an AI chatbot
- Handle documents of any size without blocking the system
- Track processing progress from 0% to 100% in real time
- Never block on bad quality pages — route them to admin for manual fix

### Implementation log & backlog (living)

This block records **what shipped**, **what was suggested in audits**, and **what we tackle next** so the PDF stays aligned with the repo.

#### Doc update changelog (append-only)

| Date | Area | Notes |
|------|------|--------|
| 2026-05-26 | **Product vision + page explanation + field photos** | Doc **Product vision** block. **`PDF_PAGE_EXPLAIN_BEFORE_INDEX`** runs **`runPageExplanationPassBeforeIndex`** (ChatGPT-style prompt via **`buildPageExplanationVisionPrompt`**) after inline OCR and **before** **`buildRoutedChunks`**. **`PDF_VISION_MAX_PAGES`** cap raised (default **180**, max **500**). **`knowledge_entries.photoVisionDescription`** + **`ENABLE_FIELD_PHOTO_VISION`** on **`POST /knowledge/:id/photo`**. |
| 2026-05-21 | **§6 Glyph-corruption vision fallback** | `KnowledgeDocumentsService.detectGlyphCorruption` flags pages whose extracted text contains custom-font / LCD-segment glyph corruption (clusters like `,4#9':+$#':`). Flagged pages get `glyph_corruption_likely(<n>)` in `qualityWarnings`, are downgraded from `good` to `degraded`, and — when PDF vision is effective and **`ENABLE_GLYPH_CORRUPTION_VISION=true`** (default) — are enqueued directly into the vision queue, bounded by **`PDF_VISION_MAX_PAGES`**. `maybeEnqueueVisionPagesAfterOcr` also routes them. Vision runs through **`AiService.describeImageBase64ForPdf`** (OpenRouter Gemini Flash with Ollama llava fallback). |
| 2026-05-21 | **§7 Near-duplicate chunk suppression** | `filterNearDuplicateChunks` skips chunks whose token Jaccard similarity ≥ **`DOC_CHUNK_NEAR_DUPLICATE_JACCARD`** (default **0.92**) against an already-kept chunk; combined with bumping the default **`DOC_EXTRACTION_MAX_CHUNKS`** to **50** and a mojibake repair pass on `pdf-parse` / OCR output. |
| 2026-05-19 | **Page split robustness** | Fixed no-form-feed PDFs: `derivePageTexts` now falls back to length-based slicing unless multiple `\f` splits exist; `buildRoutedChunks` now uses the same fallback so all pages participate in routing/extraction (not page 1 only). |
| 2026-05-11 | **§13 Bull** | PDF aligned with real queue names, processors, `knowledge_document_jobs`, `removeOnComplete`/`removeOnFail`; documented **`GET /knowledge-documents/queues/health`**. |
| 2026-05-11 | **§14 Feedback** | PDF aligned with **`extraction_feedback_events`**; admin **`/dashboard/admin/extraction-feedback`**; **`?limit=`** on recent API. |
| 2026-05-11 | **§16 Env knobs** | PDF tables match code + `.env.example`; **`GET /knowledge-documents/pipeline-config`** + **`/dashboard/admin/pipeline-config`**. |
| 2026-05-11 | **§17 Admin dashboards** | Page-fix **inline replacement image** preview (`GET …/page-fix-queue/:itemId/replacement-image`); PDF list **progress bar** + stage/pages; machine profile **Manage** + **`/machine-profiles/:id/summary`** + **`PATCH`** detail UI. |
| 2026-05-11 | **§18 API reference** | Full route sweep vs Nest controllers; Swagger; export query notes. |
| 2026-05-11 | **§19 Database** | §19 tables + migration index + **`GET /knowledge-documents/database-inventory`**; admin **`/dashboard/admin/database-inventory`**; **`getOllamaVisionModel()`**; **`ollama pull llava`**. |
| 2026-05-11 | **Vision default tag** | `.env.example` **`OLLAMA_VISION_MODEL=llava:latest`**; **`getOllamaVisionModel()`** fallback **`llava:latest`**. |
| 2026-05-11 | **§20 Success criteria** | QA matrix (**`GET …/qa-success-criteria`**); admin **`/dashboard/admin/success-criteria`**; §20 doc = shipped/partial/gap/aspirational table + maintenance note. |
| 2026-05-11 | **§23 Export** | **`knowledgeDocumentId`** on **`knowledge_entries`** + migration **`1700000000020`**; **`documentId`** + date split filters in **`KnowledgeExportService`**; Excel header style + filenames; **`GET /export/problems-solutions-reference`**; admin **`/dashboard/admin/problems-solutions-export`**. |

#### A. Recently shipped (code + doc sync)

| Topic | What changed |
|--------|----------------|
| **§11 Supersede / RAG** | FK chain, `superseded` status, `purgeManualIndexForDocument` (Qdrant delete by `documentId` + `vector_chunk_hashes` cleanup); `GET …?includeSuperseded=`; UI `?supersedes=` + version chain. **Ops note:** Qdrant failure = log-only; Postgres still commits. |
| **§12 Embedding / chat** | Richer Qdrant payloads (`sectionType`, `sourcePages`, `title`, `confidence`, `entryType` per chunk where extraction ran); `POST /chat/message` returns **`sources`**; Techo widget “Sources used”; `reindex-manual-chunks` + **auto re-index after page fix-text / successful fix-image** so RAG matches admin-corrected `ocrText`. |
| **§5 / §10 admin image** | `POST …/page-fix-queue/:itemId/fix-image` (multipart); `replacementImagePath`; vision prefers replacement image over `pdftoppm` for that page; orphan file **deleted** if upload handler throws. |
| **§17 nav** | `GET /knowledge-documents/admin-pipeline-counts`; sidebar badges (knowledge pending, PDF candidates, page-fix open). |
| **§3 Machine profiles** | **`POST /machine-profiles`**, **`PATCH /machine-profiles/:id`**, **`GET …/:id/summary`** (admin); UI list + **Manage** → detail with counts + edit. |
| **§1 OCR / Arabic** | **`PADDLE_OCR_LANG`** (`latin`, `french`, `arabic`, etc.) on the **`paddle-ocr`** sidecar. |
| **§18 / §19 / WebSocket** | API tables corrected (`/knowledge/…`, `/knowledge-documents/…`, `/export/…`); DB names (`vector_chunk_hashes`, `extraction_feedback_events`, `knowledge_entries.photoPath`); WebSocket subsection: only **`document:progress`** is implemented today. |
| **§13 Bull** | Doc aligned with code (`queues.constants`, processors, `knowledge_document_jobs`, `removeOnComplete`/`removeOnFail`); **`GET /knowledge-documents/queues/health`** (admin/superadmin) for Redis PING + per-queue job counts. |
| **§17 Admin UI** | §17 doc + page-fix image preview + PDF list progress + machine profile detail/summary/PATCH. |
| **§18 API** | Canonical §18 tables + Swagger discovery; admin **API (Swagger)** nav + pipeline hub §18 card → `{API_URL}/api/docs`. |
| **§19 DB** | §19 narrative + migration map; **`database-inventory`** API + **DB inventory** admin UI; Ollama vision **`getOllamaVisionModel()`** (default **`llava:latest`**). |
| **§20 QA** | **`GET …/qa-success-criteria`** + **`/dashboard/admin/success-criteria`** + Pipeline hub card; matrix lives in **`getQaSuccessCriteria()`**. |
| **§23 Export** | **`knowledgeDocumentId`** FK + **`GET /export/problems-solutions-reference`**; curated export filters (**`documentId`**, split **`from`/`to`**); manufacturer + PDF title enrichment; admin **`/dashboard/admin/problems-solutions-export`** + hub card; §18/§23 doc sync. |
| **PDF vision toggle** | **`pipeline_preferences`** + Pipeline env / PDF Library checkboxes; **`PATCH …/pipeline-preferences/pdf-vision`**. |
| **Page split fallback** | No-form-feed manuals now process all pages: `derivePageTexts` requires >1 form-feed segment before trusting split; `buildRoutedChunks` uses a shared fallback slicer keyed to page-analysis row count. |

#### B. Audit suggestions — status

| Suggestion | Status |
|------------|--------|
| Align **§13** text with real Bull (`removeOnComplete`/`removeOnFail`, no `resuming`/ETA DB fields, single Nest process concurrency) | **Done** (see §13 + queues health endpoint). |
| **§14** Use `extraction_feedback_events` for dashboards / future prompt tuning (not auto-mutation yet) | **Done** (admin log UI + doc; prompt tuning still future). |
| **§16** Wire or remove undocumented env knobs; document actual vars only | **Done** (§16 + pipeline-config API/UI; `.env.example` sync). |
| **§18** Sweep §18 vs live routes (machine profiles **`PATCH`**, missing doc routes) | **Done** (§18 + Swagger UI entry points). |
| **§19** Map §19 tables vs migrations / entities; optional admin “schema” view | **Done** (§19 + inventory API/UI). |
| **§20** Turn “success criteria” list into an honest shipped vs gaps checklist | **Done** (§20 + QA API + admin UI). |
| **§23** Wire **`documentId`** on **`GET /export/problems-solutions`** + align doc vs code | **Done** (FK + service + §23 admin UI + reference endpoint). |

#### C. Next: which section we finish first?

**§13–§23** in this document are aligned with shipped admin surfaces and the export path described above.

**Next (product / ops backlog, not a missing §):** optional **technician-only** restriction on **`GET /export/problems-solutions`**; Excel **summary** block + row banding; multilingual **troubleshooting** slice (§22); RAG / prompt tuning from **`extraction_feedback_events`**.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Backend framework | NestJS (Node.js) |
| Database | PostgreSQL |
| Queue system | Bull (backed by Redis) |
| Cache / Queue broker | Redis |
| Vector database | Qdrant |
| OCR engine | PaddleOCR (HTTP sidecar via Poppler pdftoppm) |
| Vision model | **LLaVA** via Ollama (default **`OLLAMA_VISION_MODEL=llava:latest`**; override e.g. **`llava:13b`**, **`llama3.2-vision`**) |
| LLM for extraction | qwen2.5:32b (Ollama; configurable via `OLLAMA_MODEL`) |
| Embedding model | nomic-embed-text (Ollama) |
| PDF rendering | Poppler (pdftoppm) |
| Frontend | Next.js |
| Real-time updates | WebSocket (Socket.io) |

---

## System Overview

The pipeline has the following major stages in order:

```
PDF Uploaded by Admin
        ↓
1. Ingestion & Validation
        ↓
2. Upload Gate (is this work-related?)
        ↓
3. Machine Profile Auto-Detection
        ↓
4. Doc-Type Routing
        ↓
5. Page Quality Scoring
        ↓
6. Content Extraction (Text → OCR → Vision per page)
        ↓
7. Structured Knowledge Extraction
        ↓
8. Admin Review Loop
        ↓
9. Embedding + Qdrant Indexing
        ↓
10. Document Ready — Chatbot Can Use It
```

All stages after step 1 run in the background via Bull queues.
The HTTP upload request returns immediately after step 1.
Progress is tracked in real time from 0% to 100%.

---

## 1. Ingestion & Validation [Status: Implemented]

### Responsibility

`KnowledgeDocumentsService.ingestAndQueue` (+ upload route in `KnowledgeDocumentsController`)

### What Happens

1. Admin uploads a PDF file via the API.
2. System validates:
   - File is a valid PDF (not corrupted): **magic header `%PDF-`**, then **pdf-parse** parse attempt
   - File size within allowed limit: **multer** limit and server-side check use **`KNOWLEDGE_PDF_MAX_BYTES`** (default 30 MiB)
   - File is not a duplicate (**SHA-256 fingerprint** of first five page-equivalent text slices — see **Cross-Document Deduplication** later in this document)
3. File saved to disk under **`KNOWLEDGE_PDF_UPLOAD_DIR`** (default `uploads/knowledge-documents`, relative to backend cwd)
4. Document record created in PostgreSQL with status `uploaded`
5. Basic metadata extracted: filename, file size, page count
6. Job pushed to the **gate** Bull queue (`knowledge-documents-gate` / job `gate` — see `queues.constants.ts`)
7. API returns **`202 Accepted`** with **`{ documentId, jobId, document, resume }`** (extra fields preserved for the UI; **`documentId`** matches the architecture contract)

**Failure cleanup:** rejected MIME type, invalid PDF, parse failure, or duplicate fingerprint → uploaded temp file is **deleted** from disk so orphans do not accumulate.

### Document Record Created

```json
{
  "id": "doc_123",
  "filename": "danao_maintenance_manual_v2.pdf",
  "filePath": "uploads/knowledge-documents/<uuid>.pdf",
  "fileSize": 45000000,
  "totalPages": 2000,
  "status": "uploaded",
  "fingerprint": "sha256_of_first_5_pages",
  "uploadedBy": "admin_user_id",
  "createdAt": "2024-03-15T10:00:00Z"
}
```

---

## 2. Upload Gate — Work-Related Classification [Status: Implemented]

### Responsibility

`KnowledgeDocumentsService.runGateStage` (Bull job on `GATE_QUEUE` / `GATE_JOB` — see `queues.constants.ts`). Private classifier: `classifyUploadGateThreeTier`. Embeddings: `RagService.embedText` (model `OLLAMA_EMBED_MODEL`). Tier 3 chat: `AiService.chat` (optional `OLLAMA_GATE_MODEL`, else `OLLAMA_MODEL`).

### Objective

Prevent non-work PDFs (recipes, games, personal documents) from entering
the heavy processing pipeline. Decision must be fast.

### 3-Tier Decision System

The gate uses 3 tiers in order. Next tier only called if previous is uncertain.

Env tuning (defaults in parentheses): `GATE_TIER1_ACCEPT_ABOVE` (0.75), `GATE_TIER1_REJECT_BELOW` (0.25), `GATE_TIER2_WORK_SIM_MIN` / `GATE_TIER2_NONWORK_SIM_MIN` (0.8), `GATE_TIER2_PAGE_COUNT` (3), `GATE_HEURISTIC_PAGE_COUNT` (10), `GATE_LLM_CHAR_LIMIT` (9000). See `.env.example`.

```
Tier 1: Keyword / Heuristic Scoring
  ├── Score industrial terms: motor, fault, wiring, maintenance, alarm,
  │   circuit, relay, PLC, inverter, bearing, torque, sensor, actuator...
  ├── Score irrelevant terms: recipe, game, song, movie, sport...
  ├── Text sample: first GATE_HEURISTIC_PAGE_COUNT pages joined (capped)
  ├── Score > GATE_TIER1_ACCEPT_ABOVE → accept immediately (no embedding/LLM)
  ├── Score < GATE_TIER1_REJECT_BELOW → reject immediately
  └── Between thresholds → uncertain → move to Tier 2

Tier 2: Embedding Similarity
  ├── Embed first GATE_TIER2_PAGE_COUNT pages only (joined text, capped)
  ├── Compare against cached reference embeddings:
  │     work_profile + nonwork_profile (cosine similarity)
  ├── work sim > GATE_TIER2_WORK_SIM_MIN → accept
  ├── non-work sim > GATE_TIER2_NONWORK_SIM_MIN → reject
  └── Still uncertain → move to Tier 3

Tier 3: LLM Classifier (only uncertain uploads reach here)
  ├── Send first GATE_HEURISTIC_PAGE_COUNT pages, truncated to GATE_LLM_CHAR_LIMIT
  ├── Model: OLLAMA_GATE_MODEL if set, else OLLAMA_MODEL
  ├── Prompt: classify work-related, doc type, JSON per contract below
  └── Final decision: accept / needs_review / reject (blended score vs heuristics)
```

### Gate Decision Outputs

- `accepted` — work-related, continue to next stage
- `needs_review` — uncertain, admin must manually review before continuing
- `rejected` — irrelevant, pipeline stops here; document status is `rejected` in the app (no automatic email unless you add notifications)

### Classifier JSON Contract

The LLM must return exactly this structure:

```json
{
  "isWorkRelated": true,
  "docType": "machine_manual",
  "confidence": 0.91,
  "reason": "Document contains fault tables, machine specs, and maintenance procedures",
  "language": "fr",
  "detectedMachineName": "Danao",
  "detectedManufacturer": "Delice"
}
```

### Document Status After Gate

- Accepted → status: `gated` → job pushed to `extraction-queue`
- Needs review → status: `needs_review` → wait for admin action
- Rejected → status: `rejected` → pipeline ends

---

## 3. Machine Profile Auto-Detection [Status: Implemented]

### Responsibility

- **`KnowledgeDocumentsService.detectMachineProfile`** (private): builds the LLM prompt, parses JSON, returns structured fields.
- **`MachineProfilesService.findOrCreate`**: upserts **`machine_profiles`** by normalized **`machineName` + `manufacturer`** (case-insensitive trim); merges non-null **`family`**, **`modelNumber`**, **`components`** onto an existing row when found.
- **`KnowledgeDocumentsService.runGateStage`**: after the upload gate classifier runs, takes the same leading-page text sample as the gate heuristics (first **`GATE_HEURISTIC_PAGE_COUNT`** pages joined, capped), calls **`detectMachineProfile`**, then **`findOrCreate`** when a usable machine name exists; sets **`knowledge_documents.machineProfileId`** and **`machineUnknown`**.

### Objective

Automatically detect the machine name, manufacturer, and key components
from the PDF and create or link a Machine Profile.
This groups knowledge that references the same physical machine (PDFs today; technician experience / photos as those features link profiles).

### When It Runs

During **`runGateStage`** (same Bull gate job as §2), after gate classification, using the leading-page text sample (page count from **`GATE_HEURISTIC_PAGE_COUNT`**, not a second PDF parse). One extra **`AiService.chat`** call for profile extraction (uses default **`OLLAMA_MODEL`**, not **`OLLAMA_GATE_MODEL`**). User text sent to the model is truncated to **`GATE_LLM_CHAR_LIMIT`** for consistency with the gate Tier 3 window.

### What Gets Detected

```
First GATE_HEURISTIC_PAGE_COUNT pages (joined) → detectMachineProfile → LLM JSON
        ↓
Parsed fields:
  ├── machineName
  ├── manufacturer
  ├── family
  ├── modelNumber
  └── components (string array in JSON; stored as comma-separated text in DB)
```

The gate Tier 3 classifier (§2) may also return **`detectedMachineName`** / **`detectedManufacturer`**; **`runGateStage`** merges those with detection output when resolving **`profileMachineName`** / **`profileManufacturer`** before **`findOrCreate`**.

### Machine Profile Schema (PostgreSQL)

Table **`machine_profiles`** (see `machine-profile.entity.ts`):

| Column | Notes |
|--------|--------|
| `id` | UUID primary key |
| `machineName` | Required display key |
| `manufacturer` | Nullable; part of uniqueness when matching |
| `family` | Nullable |
| `modelNumber` | Nullable |
| `components` | Nullable **text**; API/pipeline stores a comma-separated string merged from LLM array input |
| `createdAt` / `updatedAt` | TypeORM timestamps |

PDFs (and other assets) **do not** store foreign keys on the profile row. Each **`knowledge_documents`** row holds **`machineProfileId`** (nullable) pointing at **`machine_profiles`**.

### Logic

- **`findOrCreate`**: match **`LOWER(TRIM(machineName))`** and either same manufacturer (trimmed, case-insensitive) or both sides manufacturer null; on match, optionally refresh **`family`**, **`modelNumber`**, **`components`** if the new extraction fills them in.
- No row and detection yields a non-empty **`machineName`** → insert new profile, set **`machineProfileId`** on the document.
- No usable machine name after merge → **`machineUnknown: true`**, **`machineProfileId`** null; admin can assign or create profiles via existing APIs/UI.

### Why This Matters

When retrieval or UI scopes by machine profile, all **`knowledge_documents`** sharing **`machineProfileId`** move together (manuals, guides for the same line). Broader “everything about Danao” across technician entries and photos depends on those entities also linking to profiles when you add or align those FKs.

---

## 4. Doc-Type Routing [Status: Implemented]

### Responsibility

All routing lives in **`KnowledgeDocumentsService`** (no `PdfRoutingService`):

- **Document `docType`**: set during **`classifyUploadGateThreeTier`** (Tier 1 **`heuristicDocType`** from filename + text, Tier 3 LLM JSON). Persisted on **`knowledge_documents.docType`**.
- **Per-page `sectionType`**: **`savePageAnalysis`** → **`detectSectionType(pageText)`** when page rows are first created; stored on **`knowledge_document_page_analysis.sectionType`** (and can be refined later when OCR/vision fills **`ocrText`** — **`buildRoutedChunks`** prefers **`row.sectionType`**, else re-runs **`detectSectionType`** on the active page text).
- **Chunk shaping**: **`buildRoutedChunks`** — uses page analysis when present (line-based mini-chunks for fault/alarm pages, larger slices for warnings/procedures/wiring/spec, else sliding windows). If no page rows exist yet, falls back to plain sliding windows over the full text.
- **Chunk priority + extraction hint**: **`prioritizeChunksForExtraction`** scores chunks (TOC boost, then section-derived scores). **`classifyChunkSection(chunk, docType)`** adds a **section type hint** string into the single shared extraction LLM user message (not separate prompt files per section).

### Document-Level Types

Allowed values match the gate / extraction contract:

```
machine_manual           → full machine documentation
electrical_circuit_guide → wiring, circuits, schematics
hmi_software_guide       → operator interface, software screens
safety_document          → warnings, procedures, regulations
operations_procedure     → step-by-step operating instructions
general_reference        → specs, datasheets, catalogs
irrelevant               → passed gate but low utility
```

Extraction defaults to **`general_reference`** when **`docType`** is null.

### Section-Level Labels (Per Page / Chunk)

Primary labels from **`detectSectionType`** / **`classifyChunkSection`** (chunk classifier may return **`general_text`** when no pattern matches):

```
fault_table       → fault / troubleshooting tables and narratives
alarm_list        → alarm codes and descriptions
wiring            → schematics, circuits, terminals
procedure_steps   → procedures, setup, calibration
warning_notice    → safety / hazards / PPE
specification     → ratings, technical data
general           → page-level default when nothing matches (page analysis)
general_text      → chunk-level fallback from classifyChunkSection
```

### Routing Rules (Actual)

1. **Document type** is decided at the **gate** (heuristic + optional LLM), not a second routing service.
2. **Page section** is heuristically labeled once per page when analysis rows are saved; **`buildRoutedChunks`** chooses how to split text for that page.
3. **Extraction** uses one structured-extraction prompt; the **section type hint** and **`docType`** steer the model and **`defaultEntryTypeFromSection`** when the model omits **`entryType`**.

### Extractor “Templates”

There are **no** separate TypeScript prompts named `FaultTableExtractorPrompt`, etc. Behavior is:

| Section hint | Effect |
|---|---|
| `fault_table` / `alarm_list` | Higher chunk priority; line-based chunking when page `sectionType` is fault/alarm |
| `procedure_steps` / `warning_notice` / `wiring` / `specification` | Priority + chunk size behavior in **`buildRoutedChunks`**; hint line in LLM **`userContent`** |
| `general_text` / other | Lower priority; generic sliding-window chunks |

---

## 5. Page Quality Scoring [Status: Implemented]

### Responsibility

**`KnowledgeDocumentsService`** — private **`scorePageQuality(pageText)`** plus **`savePageAnalysis`** (creates **`knowledge_document_page_analysis`** rows and enqueues unreadable pages). There is no separate **`PdfQualityService`**.

### Objective

Give each page a **quality label** and a **heuristic confidence** from the **PDF text layer** (per-page string from **`derivePageTexts`**) so obviously empty or noisy pages are flagged. **Unreadable** pages also get an **`admin_page_fix_queue`** row so an admin can correct text later; the rest of the document pipeline is not blocked.

### What Is Actually Measured (text-layer heuristics)

Per-page scoring uses **only** the extracted text for that page (no rendered-page image analysis, no DPI/blur/skew metrics):

| Signal | Effect |
|--------|--------|
| **Character length** | Under **30** characters (trimmed) → **`unreadable`** immediately (`very_low_text_density`). Under **300** → warning `low_text_density` and a large confidence penalty. Under **1200** → `medium_text_density` and a smaller penalty. |
| **Symbol ratio** | Share of non-alphanumeric/non-whitespace characters; above **0.35** adds `high_symbol_noise` and reduces confidence. |
| **Derived `ocrConfidence`** | Starts at **0.9**, adjusted by the rules above, clamped to **[0, 1]**. Until OCR runs, this is a **synthetic** score from the text layer, not PaddleOCR. |

After those adjustments (and only when length ≥ 30): confidence **below 0.2** → **`poor`**; **0.2–0.6** → **`degraded`**; **≥ 0.6** → **`good`**. So **`poor`** can occur on longer pages if density/noise is bad; only **`unreadable`** is reserved for the shortest pages.

**Admin queue:** **`savePageAnalysis`** enqueues **`admin_page_fix_queue`** only when **`quality === 'unreadable'`** (today, that means the under-30-character path only). **`poor`** / **`degraded`** pages are not auto-enqueued.

### Quality labels

- **`good`** — normalized heuristic confidence ≥ **0.6** (and length ≥ 30)
- **`degraded`** — confidence in **[0.2, 0.6)**
- **`poor`** — confidence **below 0.2** (page still has at least 30 characters)
- **`unreadable`** — fewer than **30** characters after trim on that page’s text slice (blank or missing text layer for that page)

### When rows are written

**`savePageAnalysis`** runs during document processing (e.g. structured extraction path after the PDF is parsed) for each derived page: stores **`quality`**, **`ocrConfidence`** (heuristic), **`qualityWarnings`**, **`sectionType`**, initial **`processingMode`: `raw`**, **`extractionMode`: `text`**, **`ocrText`**: null until OCR fills it.

### Image-based OCR path (separate from per-page text heuristics above)

When **`ocrPagesFromPdf`** runs (Poppler **`pdftoppm`** at **200 DPI**, then **PaddleOCR**), the service **always** runs a **Sharp** preprocessing pass (grayscale, normalize, median, sharpen, threshold) on the rendered PNG, runs PaddleOCR again, and **keeps whichever run** (raw vs preprocessed) has **higher mean confidence**. The winning mode is stored as **`processingMode`** `raw` or `preprocessed` on the page row. There is **no** separate deskew step in code today.

### Admin fix queue (unreadable only)

- Table: **`admin_page_fix_queue`** (`AdminPageFixQueueItem`).
- Enqueued when **`savePageAnalysis`** creates a page with **`quality === 'unreadable'`** (deduped for open items per document/page).
- **HTTP**: `GET .../knowledge-documents/page-fix-queue`, `POST .../page-fix-queue/:itemId/fix-text`, `POST .../page-fix-queue/:itemId/dismiss`.
- **`fixPageWithText`**: writes **`ocrText`** on **`knowledge_document_page_analysis`**, sets **`extractionMode`** `ocr`, **`quality`** `degraded`, warning `admin_fixed_text`, marks queue item **`fixed`** and stores **`adminFixedText`**.
- **`replacementImagePath`** exists on the entity for a possible future “upload replacement scan” flow; there is **no** public fix-by-image endpoint wired in the controller yet.

### Page row schema (PostgreSQL: `knowledge_document_page_analysis`)

Columns include: **`documentId`**, **`pageNumber`**, **`quality`**, **`ocrConfidence`**, **`ocrText`**, **`visionUsed`**, **`processingMode`** (`raw` | `preprocessed` | `region`), **`qualityWarnings`** (JSON array), **`sectionType`**, **`extractionMode`** (`text` | `ocr` | `vision`). There is **no** `adminFixed` column on this table; admin corrections are reflected via **`ocrText`** / **`qualityWarnings`** and the queue item.

### Document-level scaffold (optional note)

**`getOcrScaffoldMetadata(fullText)`** (used during extraction) is a **whole-document** text-length heuristic (`good` / `degraded` / `poor`) for logging/warnings — not the same as per-page **`scorePageQuality`**.

---

## 6. Content Extraction — 3-Employee Model [Status: Implemented]

### Responsibility

**`KnowledgeDocumentsService.processDocumentExtraction`** (Bull **`EXTRACTION_JOB`**), **`ocrPagesFromPdf`**, **`runVisionForDocumentPages`**, queue processors in **`knowledge-documents.queue.processor.ts`**. Vision uses **`AiService.describeImageBase64`** → Ollama **`/api/chat`** with **`messages[].images`** (no separate `PdfVisionService` class). Config: **`pdf-vision.config.ts`**.

### Core concept (as implemented)

Text is taken from **`parsePdfWithPoppler`** first. When **`PDF_OCR_INLINE_BEFORE_INDEX=true`** (default), OCR runs **before** the first Qdrant index. When **`PDF_PAGE_EXPLAIN_BEFORE_INDEX=true`** (default), **`runPageExplanationPassBeforeIndex`** runs vision with a **page-explanation** prompt on glyph/LCD/menu/diagram/low-text pages (cap **`PDF_PAGE_EXPLAIN_MAX_PAGES`**, default **150**) **before** **`buildRoutedChunks`**. Additional OCR/vision still runs on Bull for enrichment; **`PDF_OCR_AUTO_REINDEX=true`** re-embeds after jobs complete. **`buildRoutedChunks`** skips Poppler-only glyph-corrupted pages that still lack **`ocrText`**.

**Employee 1 — PDF text layer (`parsePdfWithPoppler`)**  
Whole-document parse; **`derivePageTexts`** + **`savePageAnalysis`** for per-page quality and **`sectionType`**. Poppler is the fast draft; glyph-corrupted pages must not reach Qdrant without OCR/vision text.

**Employee 2 — PaddleOCR-VL (`ocrPagesFromPdf`)**  
**`renderPdfPageToPng`** (DPI from **`PDF_OCR_RENDER_DPI`**, higher for VL), PaddleOCR-VL or classic PaddleOCR sidecar; updates **`knowledge_document_page_analysis.ocrText`**.

- **Inline (default):** **`PDF_OCR_INLINE_BEFORE_INDEX`** — synchronous OCR on selected pages before indexing.
- **Async:** **`OCR_JOB`** when inline is off or for manual **`POST .../run-ocr`**.
- **Manual:** **`runOcrForDocument`** (broader page selection, **`PDF_OCR_MANUAL_MAX_PAGES`**).

**Employee 3 — Vision (page explanation)**  
**`runVisionForDocumentPages`** with **`promptMode: 'page_explanation'`** uses **`buildPageExplanationVisionPrompt`** (menus, tables, wiring, LCD digits). OpenRouter **`OPENROUTER_VISION_MODEL`** (e.g. Gemini Flash) with Ollama **`OLLAMA_VISION_MODEL`** fallback.

- **Before index:** **`runPageExplanationPassBeforeIndex`** when **`PDF_PAGE_EXPLAIN_BEFORE_INDEX=true`** (replaces the older bounded inline-critical vision block when this flag is on).
- **After OCR (async):** **`maybeEnqueueVisionPagesAfterOcr`**, glyph/display routing, figure vision — bounded by **`PDF_VISION_MAX_PAGES`** / **`PDF_VISION_MAX_PAGES_PER_BATCH`**.
- **Manual:** **`POST .../run-vision`**.

**Field photos (technician knowledge, not PDF):** **`POST /knowledge/:id/photo`** → **`KnowledgeService.describeFieldPhotoForEntry`** → **`photoVisionDescription`**; **`buildIndexText`** includes **`Field photo description:`** for Qdrant when the entry is approved. Toggle: **`ENABLE_FIELD_PHOTO_VISION`**.

There is **no** GPU detection gate in code; failures add **`vision_model_failed`** / **`vision_render_failed`** and processing continues.

### Queues

| Constant | Bull queue name |
|----------|-----------------|
| `EXTRACTION_QUEUE` | `knowledge-documents-extraction` |
| `OCR_QUEUE` | `knowledge-documents-ocr` |
| `VISION_QUEUE` | `knowledge-documents-vision` |

### Stored artifacts per page (actual table)

**`knowledge_document_page_analysis`**: e.g. **`pageNumber`**, **`quality`**, **`ocrConfidence`**, **`ocrText`**, **`extractionMode`** (enum-style values `text`, `ocr`, `vision`), **`processingMode`**, **`visionUsed`**, **`sectionType`**, **`qualityWarnings`**. There is no **`rawText`**, **`visionFindings`**, or **`processingTimeMs`** column.

---

## 7. Structured Knowledge Extraction [Status: Implemented]

### Responsibility

**`KnowledgeDocumentsService.processDocumentExtraction`** (same Bull **`EXTRACTION_JOB`** as §6). There is no **`PdfExtractionService`**.

### Objective

Turn manual text into **`knowledge_extraction_candidates`** rows (status **`candidate`**) via **`AiService.chat`**, then **embed the prioritized raw text chunks** into Qdrant through **`RagService.indexDocumentChunks`**. Admin approval of a candidate creates a **`knowledge_entries`** row and a separate **indexing** job for that entry (see **Admin Review Loop** below).

### Text window and chunking

1. **`fullText`** from **`parsePdfWithPoppler`**; extraction uses the **whole document text** (no keyword slicing by `troubleshooting`).
2. **`buildRoutedChunks`** (page-aware when **`knowledge_document_page_analysis`** exists) produces chunks; sizes/overlap from env (**`DOC_EXTRACTION_CHUNK_SIZE`**, **`DOC_EXTRACTION_CHUNK_OVERLAP`**, defaults **12000** / **1500**).
3. **`prioritizeChunksForExtraction`** sorts chunks: TOC-like snippets first, then higher scores for fault/alarm/procedure/warning/spec/wiring (see §4). **Not** wall-clock “30 seconds / 2 minutes” phases.
4. Hard caps: **`DOC_EXTRACTION_MAX_CHUNKS`** (default **50**) LLM calls per run, **`DOC_EXTRACTION_MAX_CANDIDATES`** (**200**) total saved candidates, **`DOC_EXTRACTION_MAX_CANDIDATES_PER_CHUNK`** (**10**) per chunk.

### Prompts

- **System:** loaded from **`backend/src/ai/prompts/techo-pdf-extractor-system.prompt.md`** (path fallbacks in code under `dist`). Base file documents a minimal `{ "candidates": [ { title, problemDescription, solution, tags } ] }` shape.
- **Runtime user message** (appended in code) requires **`candidates`** array entries with **`entryType`**, **`title`**, **`problemDescription`**, **`solution`**, **`symptom`**, **`rootCause`**, **`tags`**, **`sourcePages`**, **`confidence`**, with **`entryType`** one of **`fault`**, **`procedure`**, **`safety`**, **`wiring`**, **`spec`**, plus a **`Section type hint:`** from **`classifyChunkSection`** and **`Chunk index`**.

Gate-detected **language** / **machine name** are **not** injected into this user message today (they live on the document / profile elsewhere).

### Candidate persistence (PostgreSQL)

**`KnowledgeExtractionCandidate`** stores: **`documentId`**, **`title`**, **`problemDescription`**, **`solution`**, optional **`tags`** (comma-separated string), **`entryType`**, **`symptom`**, **`rootCause`**, **`sourcePages`** (string; array from model is joined), **`confidence`**, **`sectionType`** (hint path), **`status`** (`candidate`, `approved`, or `rejected`), **`createdById`**, **`reviewedById`**. There are **no** columns for **`machineName`**, **`manufacturer`**, **`docType`**, **`language`**, **`severity`** on the candidate row.

Rows without **`title`**, **`problemDescription`**, and **`solution`** are skipped. **In-run deduplication** uses a normalized fingerprint **`title|problemDescription|solution`** (not SHA-256, not `vector_chunk_hashes`).

### Entry types (LLM contract)

**`fault`**, **`procedure`**, **`safety`**, **`wiring`**, **`spec`**. If the model omits **`entryType`**, **`defaultEntryTypeFromSection`** maps from **`sectionType`**. Technician **experience** entries are a different feature (knowledge module), not emitted by this PDF extractor.

### RAG indexing of manual chunks

After candidates are saved, **`ragService.indexDocumentChunks(documentId, chunksToIndex, meta)`** embeds a larger retrieval-focused slice (default **`DOC_INDEX_MAX_CHUNKS=2000`**) that is decoupled from the expensive LLM extraction cap. Qdrant point IDs are **deterministic UUIDv5** from **`documentId` + chunk index** so re-runs overwrite the same points. **`vector_chunk_hashes`** is consulted: normalized chunk text that was **already embedded for another document** skips a second embed (same document may still repeat identical text at different indices). Optional **`meta`** adds **`machineProfileId`**, **`machineName`**, **`manufacturer`**, **`docType`**, **`chunkHash`**, and **`source: 'pdf_extraction'`** to each point payload.

### Document outcome

- **`done`** if indexing succeeds; **`chunksIndexed`** set to chunk count.
- **`partially_indexed`** if Qdrant upsert throws (candidates still saved).
- **`getOcrScaffoldMetadata`** may set a non-blocking **`doc.error`** warning when the whole-document text looks scan-poor.

---

## 8. Admin Review Loop [Status: Implemented]

### Responsibility

**`KnowledgeDocumentsService.approveExtractionCandidate`** and **`rejectExtractionCandidate`**. HTTP surface: **`KnowledgeDocumentsController`** (admin/superadmin). There is no **`PdfReviewService`**.

### Flow

1. Extraction saves rows in **`knowledge_extraction_candidates`** with **`status: 'candidate'`** (see §7).
2. Admin calls **`POST /knowledge-documents/extractions/:candidateId/approve`** with optional body fields **`title`**, **`problemDescription`**, **`solution`**, **`tags`** (strings). Omitted fields default to the candidate’s stored values.
3. **Approve:** **`KnowledgeService.create`** inserts a **`knowledge_entries`** row ( **`createdById`** = approving admin), with **`knowledgeDocumentId`** = the candidate’s **`documentId`** so **§23** export can filter by PDF. The candidate is updated to **`status: 'approved'`**, **`reviewedById`** set, then **`enqueueIndexingJob`** runs **`INDEXING_JOB`** on **`knowledge-documents-indexing`**. The processor loads the entry, builds a single text block, and calls **`RagService.indexKnowledgeEntry`** (Qdrant payload **`kind: 'knowledge_entry'`**). Indexing is best-effort: if the queue fails to enqueue, the knowledge entry still exists.
4. **Reject:** **`POST /knowledge-documents/extractions/:candidateId/reject`** with optional **`reason`**. Candidate **`status: 'rejected'`**, **`reviewedById`** set. No knowledge entry, no indexing job.

Manual chunks from §7 are already in Qdrant under the document id; **approved candidates** add **separate** vectors keyed by **`knowledgeEntryId`**, so retrieval can surface both raw manual chunks and curated entries.

### What is not implemented

- **No SLA timers:** no 3-day reminders, no 7-day auto-approve by confidence, no “stale pending” dashboards driven by the backend in this path.

**Implemented alongside audit logs:** **`extraction_feedback_events`** rows are written on candidate **approve** / **approve_edit** / **reject** (`KnowledgeDocumentsService`). Admins can list recent rows via **`GET /knowledge-documents/extraction-feedback/recent?limit=`** (see §14) or the **Extraction feedback** admin page. There is still **no** automated prompt tuning from these events.

### Audit logging

Approve and reject both write **`audit_logs`** via **`AuditLog`** / **`ActionType`**: **`APPROVE`** or **`REJECT`**, **`entityType: 'knowledge_extraction_candidate'`**, **`entityId`** = candidate id, **`userId`** = admin, **`changes`** JSON (e.g. **`extraction_candidate_approved`** with **`knowledgeEntryId`**, or **`extraction_candidate_rejected`**), optional **`reason`** on reject. That is the durable record today—not the illustrative JSON block that previously implied a dedicated `candidate_feedback` API.

---

## 9. Technician Experience Entries [Status: Implemented]

### Responsibility

**`KnowledgeService`** + **`KnowledgeController`** (**`/knowledge`**). Richer fields live on **`knowledge_entries`**.

### API and UI

- **DTOs:** **`CreateKnowledgeEntryDto`** / **`UpdateKnowledgeEntryDto`** accept **`machineName`**, **`symptom`**, **`rootCause`**, **`severity`**, **`entryType`**, **`source`** in addition to core text fields.
- **Technicians:** new rows use **`reviewStatus: 'pending_review'`**, default **`entryType`** / **`source`** oriented to field experience. **`GET /knowledge/pending-review`** (admin), **`POST /knowledge/:id/approve`** / **`reject`**, **`GET /knowledge/pending-review/count`**.
- **Indexing:** admin-created rows are **`RagService.indexKnowledgeEntry`** on create/update when approved; technician rows are embedded after **approve** (and on admin direct create when approved). **`KnowledgeService.searchRelevantEntries`** only returns **`reviewStatus === 'approved'`** (Postgres fallback search).
- **`CreateTechnicianExperienceDto`** remains an unused alternate shape; the main **`/knowledge`** API covers the workflow.

### How sources combine in chat

**`ChatController`** pulls RAG chunks (with **`sourceCaption`** from Qdrant payload) plus approved SQL-backed entries (including a **photo path** hint line when **`photoPath`** is set). Responses do not attach binary images to the LLM. The JSON body also returns **`sources`** (see §12) so the client can show the same attribution list without re-querying Qdrant.

---

## 10. Field Photo Knowledge [Status: Implemented]

### Type 1 — Photo attached to a field experience entry

**Implemented:** **`POST /knowledge/:id/photo`** (Multer, JPEG/PNG/WebP, size limit) stores under **`KNOWLEDGE_PHOTO_UPLOAD_DIR`** and sets **`photoPath`**. **`GET /knowledge/:id/photo-file`** serves the file (path traversal guarded). Technician UI can upload after create; chat context includes a **text** reference to the photo path. **`RagService.indexKnowledgeEntry`** payload may include **`photoPath`** for curated vectors.

### Type 2 — Photo sent to the chat as a question

**Implemented:** **`POST /chat/message`** accepts optional **`imageBase64`** (raw base64 or **`data:image/(jpeg|png|webp);base64,...`**). When **`ENABLE_CHAT_IMAGE_VISION`** is not **`false`**, **`ChatController`** calls **`AiService.describeImageBase64`** (same Ollama vision model as §6) and prepends the description to the user turn sent to the text LLM. Decoded image is capped (~4.5 MiB) and restricted to JPEG/PNG/WebP magic bytes. The floating **`TechoChatWidget`** lets users attach one photo per send. The same endpoint returns **`sources`** (§12) for retrieval attribution in the UI.

### Related: PDF admin replacement image

**Implemented:** **`POST /knowledge-documents/page-fix-queue/:itemId/fix-image`** (multipart **`file`**, JPEG/PNG/WebP, size limit **`KNOWLEDGE_PAGE_FIX_IMAGE_MAX_BYTES`**) stores under **`KNOWLEDGE_PAGE_FIX_IMAGE_UPLOAD_DIR`** (default **`uploads/knowledge-documents/page-fix-images`**) and sets **`admin_page_fix_queue.replacementImagePath`**. **`runVisionForDocumentPages`** prefers this image over a **`pdftoppm`** render when present for that document/page. **`fixPageWithReplacementImage`** runs vision immediately and marks the queue item **`fixed`** when at least one page is updated. Requires **`ENABLE_PDF_VISION`**.

---

## 11. Cross-Document Deduplication [Status: Implemented]

### Responsibility

**`KnowledgeDocumentsService.ingestAndQueue`** (document fingerprint + duplicate rejection + optional supersession). **`RagService.indexDocumentChunks`** performs **cross-document chunk-hash dedup** via **`vector_chunk_hashes`** (skip embed when another document already owns the hash; same-document repeats still allowed). When a document is **superseded**, **`RagService.purgeManualIndexForDocument`** removes its **Qdrant** manual-chunk points (payload filter on **`documentId`**) and deletes **`vector_chunk_hashes`** rows for that document so the successor can re-embed overlapping text.

### Document-level fingerprint (implemented)

On ingest, after **`pdf-parse`**:

1. **`derivePageTexts(parsed, fullText)`** splits the PDF into page-equivalent strings. It uses form-feed boundaries only when multiple segments are present; otherwise it falls back to length-based slicing by `numpages` so monolithic text outputs still map across all pages.
2. The fingerprint input is the first **five** page strings joined with **newline + form-feed + newline** between slices (matches how page boundaries are concatenated in code). If that string is empty, the code falls back to **`fullText.slice(0, 10000)`**.
3. **`fingerprint`** = **SHA-256** hex of that UTF-8 buffer.
4. If any **`knowledge_documents`** row already has the same **`fingerprint`**, the new upload is **rejected** (**`BadRequestException`**: duplicate document, includes existing id), the temp file is **removed**, and no new document row is kept — **unless** the client passes **`supersedesDocumentId`** matching that duplicate row (see **Version handling**).

This is **text-derived**, not “render five pages to images and hash pixels.”

### Version handling (implemented)

- **`knowledge_documents.supersedesDocumentId`** / **`supersededByDocumentId`** (self-referential FKs) and **`status: 'superseded'`** on the predecessor (migration **`1700000000018-AddKnowledgeDocumentSupersession`**).
- **Replace same fingerprint:** `POST /knowledge-documents/upload?supersedesDocumentId=<predecessor id>` (or alias route with the same query). Ingest clears the predecessor’s **`fingerprint`** so only the successor row holds the hash; predecessor is marked **`superseded`** and **`findAll`** hides superseded rows by default.
- **Replace revised PDF (different fingerprint):** same query param links the chain; duplicate fingerprint check does not apply; predecessor is still marked **`superseded`** and **RAG purge** runs for the predecessor so chat does not retrieve stale manual chunks.
- **Admin library:** **`GET /knowledge-documents?includeSuperseded=true`** (admin/superadmin only) lists superseded rows for audit/history. Technician listing ignores this flag.
- **UI:** PDF Library supports **`?supersedes=<id>`** for replacement uploads; document detail shows the version chain and links.

### Candidate deduplication (same extraction run)

During structured extraction, **`processDocumentExtraction`** keeps an in-memory **`Set`** of normalized **`title|problemDescription|solution`** keys so the LLM cannot flood duplicates **within one job**. That does **not** dedupe across documents or across separate extraction runs.

### Manual chunk vectors (Qdrant)

**`indexDocumentChunks`** assigns point IDs as **UUIDv5** from **`documentId` + chunk index**, so re-indexing the **same** document overwrites the same Qdrant points. Cross-document duplicate **text** skips embedding as described above.

### `vector_chunk_hashes` table

Migration **`1700000000015-AddVectorChunkHashes`**. **`RagService`** inserts and checks hashes during **`indexDocumentChunks`**. **`indexKnowledgeEntry`** does **not** use this table (knowledge vectors use their own point id scheme).

> **Note (operations — §11 RAG purge):** **`purgeManualIndexForDocument`** runs after a successful **supersede** and from **`DELETE /knowledge-documents/:id`**. It calls Qdrant **`POST …/points/delete`** (filter on payload **`documentId`**) and deletes **`vector_chunk_hashes`** rows for that id. If **Qdrant is down or returns an error**, ingest/delete still **commit in Postgres** and failures are **logged** only — vectors for that document may remain until Qdrant is healthy again (then delete the document again, supersede with a replacement, or add a maintenance repair if you introduce one).

---

## 12. Embedding + Qdrant Indexing [Status: Implemented]

### Responsibility

**`RagService`** (Ollama **`/api/embed`** + Qdrant REST: ensure collection, upsert/search/delete points). There is no separate **`PdfIndexingService`** class.

### Embedding model

**`OLLAMA_EMBED_MODEL`** (default **`nomic-embed-text`**) via **`OLLAMA_BASE_URL`**.

### Qdrant collection

**`QDRANT_COLLECTION`** (default **`manual_chunks`**). **`ensureCollection`** creates the collection on first embed if it does not exist (cosine distance, vector size from the first embedding).

### PDF manual chunk payloads

Core fields: **`documentId`**, **`chunkIndex`**, **`text`**, **`source: "pdf_extraction"`**, **`chunkHash`**, **`machineProfileId`**, **`machineName`**, **`manufacturer`**, **`docType`**, **`language`**.

Per-chunk enrichment (written at **`indexDocumentChunks`** time from **`processDocumentExtraction`**): **`sectionType`** (same heuristic as extraction), **`sourcePages`**, **`title`**, **`confidence`**, **`entryType`** — taken from the **highest-confidence** structured candidate produced for that text chunk (chunk-level vectors; not one point per candidate row).

> **Note:** PDFs whose chunks were indexed **before** this enrichment may still have **`null`** section/title/pages fields in Qdrant until that document is extracted and indexed again.

### Knowledge entry payloads

**`kind: "knowledge_entry"`**, **`knowledgeEntryId`**, **`text`**, **`source`**, **`chunkHash`**, **`title`**, **`machineName`**, **`entryType`**, optional **`photoPath`**.

### Source field values (`source` / provenance)

- **`pdf_extraction`** — manual PDF chunks and curated entries approved from extraction
- **`field_experience`** — technician-written knowledge
- **`field_photo`** — technician-uploaded photo description context

### Search and chat

**`searchRelevantChunks`** embeds the user query, runs Qdrant vector search, and maps payloads to **`SearchResult`** including **`sourceCaption`** (machine, doc type, optional section/pages/title, excerpt index). **`ChatController.sendMessage`** injects those captions into the transient retrieval system message.

**HTTP response (§12):** **`POST /chat/message`** returns **`{ reply, ticketId, sources }`**. **`sources`** is an array of **`{ kind: 'pdf_chunk' | 'knowledge_entry', caption, score?, documentId?, chunkIndex?, knowledgeEntryId? }`** for UI attribution. The **`TechoChatWidget`** shows a collapsible **“Sources used”** list on each assistant reply.

### Point IDs and deduplication

**`indexDocumentChunks`**: point id = **UUIDv5** from **`documentId` + chunk index** (stable re-upsert). Cross-document text dedup via **`vector_chunk_hashes`** (§11). **`purgeManualIndexForDocument`** removes manual PDF points and hash claims for a **`documentId`**.

---

## 13. Bull Queue + Job Tracking System [Status: Implemented]

### Responsibility

- **`@nestjs/bull`** registers **five queues** on **`KnowledgeDocumentsModule`** (`backend/src/knowledge-documents/queues.constants.ts`). There is **no** separate `BullQueueService` / `ProgressTrackingService` class.
- **Processors:** `backend/src/knowledge-documents/knowledge-documents.queue.processor.ts` — one Nest `@Processor` class per queue; each handler is `@Process(<jobName>)` with **default concurrency 1** (work runs in the **same Node process** as the API, not as separately scaled “N worker” pools).
- **Document progress:** columns on **`knowledge_documents`** (`status`, `currentStage`, `progressPercent`, `pagesProcessed`, `lastProcessedPage`, `totalPages`, `chunksIndexed`, `error`, …). **`currentStage`** is a **string label** updated by **`updateProgress`** (not a 1:1 enum of Bull queue names).
- **Per enqueue audit:** **`knowledge_document_jobs`** tracks `queueName`, `jobType`, `status` (`queued` \| `active` \| `completed` \| `failed`), `bullJobId`, `error`. Each Bull job payload includes **`trackingJobId`** (the row id) so processors can call **`markTrackingJobActive` / `Completed` / `Failed`**.
- **Live UI:** **`DocumentProgressGateway`** (Socket.IO namespace **`/documents`**, JWT in **`handshake.auth.token`**), event **`document:progress`** after **`updateProgress`**. **`GET /knowledge-documents/:id/status`** returns the same progress fields plus **`qualitySnapshot`** (page-quality counts), **`chunksIndexed`**, **`error`**.

### Why Bull (async offload)

Long-running PDF work must not block the HTTP thread. **`ingestAndQueue`** persists the row, enqueues the **gate** job, updates progress to **`queued`**, and returns immediately (today: **200** JSON with **`documentId`** + **`jobId`**, not a strict **202** — see backlog in Purpose §B).

### Queue names and job names (as implemented)

| Bull queue name | Job name | Processor handler |
|-----------------|----------|-------------------|
| **`knowledge-documents-gate`** | **`gate`** | `runGateStage` → may **`enqueueExtractionJob`** |
| **`knowledge-documents-extraction`** | **`extraction`** | **`processDocumentExtraction`** (full pipeline step in one job) |
| **`knowledge-documents-ocr`** | **`ocr`** | **`runOcrForDocumentPages`** (bounded page list in payload) |
| **`knowledge-documents-vision`** | **`vision`** | **`runVisionForDocumentPages`** (Ollama vision; gated by **`ENABLE_PDF_VISION`** / caps in **`pdf-vision.config`**) |
| **`knowledge-documents-indexing`** | **`indexing`** | **`RagService.indexKnowledgeEntry`** — **approved knowledge entry** vectors only |

### What each stage actually does (code truth)

- **Gate:** payload **`{ documentId, trackingJobId? }`**. Updates **`knowledge_documents.status`** to **`gated`**, **`needs_review`**, or **`rejected`**; on accept, queues **extraction**.
- **Extraction:** payload **`{ documentId, trackingJobId? }`**. Rebuilds **`knowledge_document_page_analysis`**, may enqueue **OCR** for a **bounded** set of low-quality pages when **`ENABLE_PDF_OCR=true`** (see **`PDF_OCR_MAX_PAGES`**, default **10**), or enqueue **vision-only** for a bounded set when OCR is off but vision is enabled. Runs **LLM structured extraction** into **`knowledge_extraction_candidates`**. Then calls **`RagService.indexDocumentChunks`** for **manual PDF chunks** **inside this same job** (not via **`indexing-queue`**). Sets **`status`** to **`done`** or **`partially_indexed`** if chunk indexing throws.
- **OCR:** payload **`{ documentId, trackingJobId?, pageNumbers: number[] }`**. PaddleOCR + **`pdftoppm`**; may enqueue **vision** afterward via **`maybeEnqueueVisionPagesAfterOcr`** when vision is enabled and OCR text/confidence is still poor.
- **Vision:** payload **`{ documentId, trackingJobId?, pageNumbers: number[] }`**. Merges model output into **`ocrText`** on page rows; failures add **quality warnings** rather than hard-stopping the whole library.
- **Indexing queue:** payload **`{ documentId, trackingJobId?, knowledgeEntryId, candidateId? }`**. Used when an **extraction candidate is approved** into a **`knowledge_entries`** row — embeds that entry for chat RAG. **Not** used for bulk PDF manual chunk upserts (those run in the **extraction** job).

### Job payload rule

Payloads are **small**: ids, optional **`trackingJobId`**, and **`pageNumbers`** / **`knowledgeEntryId`** only. **Never** put PDF bytes, full extracted text, or large blobs in Redis.

### `queue.add` options (Redis footprint)

All **`queue.add`** calls in **`KnowledgeDocumentsService`** use **`{ removeOnComplete: 100, removeOnFail: 100 }`**. Bull trims completed/failed job artifacts in Redis by **count**, not via **`BULL_JOB_*_TTL`** env vars (those are **not** read by the current code — see §16).

### Redis connection

The repo registers queues with **`BullModule.registerQueue`** only (no **`BullModule.forRoot`** in **`AppModule`**). Bull/ioredis therefore uses **library defaults** (typically **`127.0.0.1:6379`**) unless you add explicit Redis configuration in a future change.

### Progress and status (no ETA columns)

**`knowledge_documents`** does **not** store **`startedAt`**, **`estimatedCompletionAt`**, or a **`resuming`** status. **`GET /knowledge-documents/:id/status`** returns fields from the row plus **`qualitySnapshot`** derived from **`knowledge_document_page_analysis`**.

Example **REST-shaped** view (logical; **`qualitySnapshot`** is computed):

```json
{
  "documentId": "uuid",
  "status": "processing",
  "currentStage": "structured_extraction",
  "progressPercent": 42,
  "totalPages": 2000,
  "pagesProcessed": 120,
  "lastProcessedPage": 120,
  "chunksIndexed": 0,
  "qualitySnapshot": { "good": 650, "degraded": 180, "poor": 12, "unreadable": 5 }
}
```

**`currentStage`** values observed in code include: **`uploaded`**, **`queued`**, **`gate_processing`**, **`rejected`**, **`needs_review`**, **`gated`**, **`extraction_start`**, **`page_quality_scoring`**, **`structured_extraction`**, **`indexing`**, **`done`**, **`partially_indexed`**, **`failed`**.

### WebSocket + REST fallback

Same as earlier MVP description: **`document:progress`** on **`/documents`**; poll **`GET /knowledge-documents/:id/status`** when disconnected.

### Concurrency, retries, and “resume”

Multiple PDFs can be in flight because **gate / extraction / OCR / vision / indexing** jobs are independent. **Per-queue** handlers default to **one concurrent job** each unless you change **`@Process`** options.

**Important:** **`processDocumentExtraction`** is **not** written as a page-level resumable checkpoint. If Bull **retries** a failed extraction job, work **starts again** from the beginning of that function. **`lastProcessedPage`** reflects **UI progress** during extraction; it is **not** a durable resume cursor for OCR/LLM. Failed job reasons are also recorded on **`knowledge_document_jobs`** when **`trackingJobId`** is present.

### Ops: queue health endpoint

**`GET /api/knowledge-documents/queues/health`** (JWT; **admin** or **superadmin** only): Redis **`PING`**, then **`getJobCounts()`** per queue (`waiting`, `active`, `completed`, `failed`, `delayed` — Bull **`JobCounts`** shape in this repo). Intended for dashboards / alerting; **Bull Board** is not bundled.

---

## 14. Continuous Feedback Learning [Status: Implemented — analytics only]

### Responsibility (as shipped)

- **Persistence:** PostgreSQL table **`extraction_feedback_events`** (`ExtractionFeedbackEvent` entity). Rows are written **best-effort** (errors swallowed) from **`KnowledgeDocumentsService`** when an admin **approves**, **approves with edits**, or **rejects** a **`knowledge_extraction_candidates`** row.
- **Read API:** **`GET /knowledge-documents/extraction-feedback/recent`** (JWT; **admin** or **superadmin**). Optional query **`limit`** (integer, clamped **1–500**, default **200**).
- **Admin UI:** **`/dashboard/admin/extraction-feedback`** — lists recent events with link to the parent PDF document detail.
- **Not implemented:** There is no **`PdfFeedbackService`**, no **automated** prompt or threshold mutation from these rows, and **no** `extraction_feedback_events` row for “technician says chatbot was wrong” (that would be a separate product feature if added later).

### Table schema (truth)

| Column | Purpose |
|--------|---------|
| **`id`** | UUID primary key |
| **`documentId`** | Parent **`knowledge_documents`** row |
| **`candidateId`** | **`knowledge_extraction_candidates`** row |
| **`signal`** | **`approve`** \| **`approve_edit`** \| **`reject`** |
| **`docType`** | From document at write time (nullable) |
| **`sectionType`**, **`entryType`**, **`confidence`** | From candidate at write time (nullable) |
| **`adminId`** | Reviewing admin (nullable) |
| **`reason`** | Reject reason text (nullable) |
| **`editDelta`** | JSON object with submitted **`title`** / **`problemDescription`** / **`solution`** when signal is **`approve_edit`**; otherwise null |
| **`createdAt`** | Row creation time |

### When rows are written (code paths)

- **`approveExtractionCandidate`:** after creating **`knowledge_entries`** and enqueueing indexing: signal **`approve`** if body fields match the candidate; else **`approve_edit`** with **`editDelta`** holding the submitted strings (even if only one field changed).
- **`rejectExtractionCandidate`:** signal **`reject`** with optional **`reason`**.

### Roadmap (not code — do not treat as shipped)

These remain **design targets** for future iterations: export labeled dataset from **`extraction_feedback_events`**, dashboards by **`docType`**, few-shot prompt updates from approve/reject patterns, chatbot-downvote linked to chunks. Until built, they are **documentation intent only**.

---

## 15. Model Strategy [Status: Implemented]

### Core Principle

Use multiple specialized models — one model per task type.
Never use one model for everything.

### Model Assignment

| Task | Model | When |
|---|---|---|
| Gate Tier 1 | Heuristic (no model) | Always first |
| Gate Tier 2 | nomic-embed-text | When Tier 1 uncertain |
| Gate Tier 3 + machine detection | qwen2.5:7b-instruct | When Tier 2 uncertain |
| Structured extraction | qwen2.5:14b-instruct | All accepted docs |
| OCR | PaddleOCR (sidecar) | All non-digital pages |
| Vision / diagram understanding | **`llava:latest`** (default **`OLLAMA_VISION_MODEL`**) or other Ollama vision tags (e.g. **`llama3.2-vision`**) | When **`ENABLE_PDF_VISION`** and page-based rules in §16 (`PDF_VISION_*`) say to run vision after OCR |
| Embeddings | nomic-embed-text | All chunks before Qdrant insert |
| RAG retrieval | nomic-embed-text | All chatbot queries |

### Hardware Fallback Strategy

If server has limited resources:

| Task | Primary | Fallback |
|---|---|---|
| Extraction LLM | qwen2.5:14b-instruct | qwen2.5:7b-instruct |
| Vision | **`llava:latest`** (or **`OLLAMA_VISION_MODEL`**) | Disabled — OCR only |
| Embeddings | nomic-embed-text | nomic-embed-text (no fallback needed, small model) |

Vision disabled fallback behavior:
- Pages that need vision are added to admin page queue
- Admin sees: "This page contains a diagram. No GPU available for automatic reading.
  Please add text description manually."

### Language Handling

Language is detected at the gate step and passed to every downstream prompt.

Example extraction prompt header:
```
Language: French
Machine: Danao (Delice)
Section type: fault_table
Task: Extract all fault entries from the following French technical text.
Return only a valid JSON array. No explanation. No markdown.
```

Supported languages: French, English, Arabic
All three must be handled correctly by extraction prompts.

---

## 16. Performance Targets and Control Knobs [Status: Implemented — doc + read-only admin UI]

### Response time targets (product goals, not enforced in code)

| Action | Target |
|--------|--------|
| Upload API response | Under about one second for typical files |
| Gate decision | Tens of seconds depending on Ollama |
| Fault tables in chatbot | Depends on extraction + indexing; async |
| Full document indexed | No hard wall clock limit |
| Page-fix text reflected in RAG | After re-index path runs (see §12) |

These remain **aspirational SLA-style** statements; the backend does **not** implement **`REVIEW_REMINDER_DAYS`**, **`REVIEW_AUTO_APPROVE_*`**, or similar timers (those env names are **not** read anywhere).

### Environment variables — PDF pipeline (read by backend today)

Values below are **defaults or sources**; see **`backend/src/knowledge-documents/*.config.ts`**, **`knowledge-documents.service.ts`**, **`pdf-vision.config.ts`**, **`ai.service.ts`**, **`rag.service.ts`**, **`chat.controller.ts`**. **`.env.example`** in the repo root lists the same knobs for operators.

#### §1 Ingestion & paths

| Variable | Role |
|----------|------|
| **`KNOWLEDGE_PDF_MAX_BYTES`** | Max upload size (bytes); default **30 MiB** if unset |
| **`KNOWLEDGE_PDF_UPLOAD_DIR`** | Relative directory for stored PDFs (default **`uploads/knowledge-documents`**) |
| **`KNOWLEDGE_PAGE_FIX_IMAGE_MAX_BYTES`** | Max bytes for admin replacement page image (default **8 MiB**) |
| **`KNOWLEDGE_PAGE_FIX_IMAGE_UPLOAD_DIR`** | Relative dir for fix images (default under PDF upload dir **`…/page-fix-images`**) |

#### §2 Gate (`gate.config.ts`)

| Variable | Role |
|----------|------|
| **`GATE_TIER1_ACCEPT_ABOVE`** | Tier 1 heuristic accept threshold (default **0.75**) |
| **`GATE_TIER1_REJECT_BELOW`** | Tier 1 reject threshold (default **0.25**) |
| **`GATE_TIER2_WORK_SIM_MIN`** | Cosine sim to “work” profile for Tier 2 accept (default **0.8**) |
| **`GATE_TIER2_NONWORK_SIM_MIN`** | Cosine sim to “non-work” profile for Tier 2 reject (default **0.8**) |
| **`GATE_TIER2_PAGE_COUNT`** | Leading pages joined for Tier 2 embedding (default **3**) |
| **`GATE_HEURISTIC_PAGE_COUNT`** | Pages for Tier 1 + Tier 3 LLM sample (default **10**) |
| **`GATE_LLM_CHAR_LIMIT`** | Max chars sent to Tier 3 LLM (default **9000**, clamped in code) |
| **`OLLAMA_GATE_MODEL`** | Optional override for gate Tier 3; else **`OLLAMA_MODEL`** via **`AiService`** |

#### OCR

| Variable | Role |
|----------|------|
| **`ENABLE_PDF_OCR`** | Must be **`true`** to enqueue OCR during extraction (`'true'` string, case-insensitive) |
| **`PDF_OCR_MAX_PAGES`** | Max low-quality pages queued for OCR per extraction run (default **10**) |
| **`PADDLE_OCR_URL`** | PaddleOCR HTTP base (default **`http://paddle-ocr:8000`**) |
| **`PADDLE_OCR_LANG`** | Paddle model language (default **`latin`**; also **`en`**, **`french`**, **`arabic`**) |
| **`PADDLE_OCR_TIMEOUT_MS`** | HTTP timeout per page OCR call (default **120000**) |
| **`PDFTOPPM_PATH`** | Poppler **`pdftoppm`** (default **`pdftoppm`**) |

**Not used:** **`PDF_OCR_BATCH_SIZE`**, **`PDF_OCR_WORKERS`** — Bull OCR jobs process one payload list per job; concurrency is Nest **`@Process`** default (§13).

#### PDF vision (`pdf-vision.config.ts` + **`AiService.describeImageBase64`**)

| Variable | Role |
|----------|------|
| **`ENABLE_PDF_VISION`** | **`true`** enables vision jobs in principle; **effective** vision also requires the admin UI toggle (**`pipeline_preferences.pdfVisionEnabled`**, default **on**) — see **`PATCH /knowledge-documents/pipeline-preferences/pdf-vision`** and Pipeline env / PDF Library checkboxes |
| **`PDF_VISION_MAX_PAGES`** | Cap pages per vision batch (default **5**) |
| **`PDF_VISION_MAX_PAGES_PER_BATCH`** | Per-document-batch cap used by batch vision selection (default **20**) |
| **`DOC_BATCH_PAGES`** | Number of pages per routing batch for OCR/vision selection (default **20**) |
| **`PDF_VISION_TRIGGER_OCR_CONFIDENCE_BELOW`** | Mean OCR confidence below this → candidate for vision after OCR (default **0.45**) |
| **`PDF_VISION_MIN_OCR_TEXT_CHARS`** | Short OCR text → candidate for vision (default **40**) |
| **`ENABLE_GLYPH_CORRUPTION_VISION`** | When **`true`** (default), pages flagged by **`detectGlyphCorruption`** (custom-font / LCD-segment corruption) are forced into the vision queue right after page analysis, even if overall page text looks healthy. Bounded by **`PDF_VISION_MAX_PAGES`**. |
| **`OLLAMA_VISION_MODEL`** | Vision model id for Ollama **`/api/chat`** with `images[]` (default **`llava:latest`**, from **`getOllamaVisionModel()`**). Used as fallback when **`OPENROUTER_API_KEY`** + **`OPENROUTER_VISION_MODEL`** are not set, or when OpenRouter vision call fails. **Ops:** on the Ollama host run **`ollama pull llava`** (or e.g. **`llava:13b`**) before setting **`ENABLE_PDF_VISION=true`**. |
| **`OPENROUTER_API_KEY`** | When set, **`AiService.describeImageBase64ForPdf`** routes PDF vision through OpenRouter using **`OPENROUTER_VISION_MODEL`** (e.g. **`google/gemini-2.5-flash`**) instead of Ollama. Falls back to Ollama llava on failure. |
| **`OPENROUTER_VISION_MODEL`** | OpenRouter vision model id used by the PDF pipeline (e.g. **`google/gemini-2.5-flash`**). Required for OpenRouter vision; without it the pipeline uses Ollama. |

**Not used:** a single env named **`VISION_ENABLED`** or **`VISION_CONFIDENCE_THRESHOLD`** — use the **`ENABLE_PDF_`** / **`PDF_VISION_`** names above.

#### §7 Extraction chunk caps (`processDocumentExtraction`)

| Variable | Default (if unset) |
|----------|---------------------|
| **`DOC_EXTRACTION_MAX_CHUNKS`** | **50** |
| **`DOC_EXTRACTION_MAX_CANDIDATES`** | **200** |
| **`DOC_EXTRACTION_MAX_CANDIDATES_PER_CHUNK`** | **10** |
| **`DOC_EXTRACTION_CHUNK_SIZE`** | **12000** (characters, not “tokens” in code) |
| **`DOC_EXTRACTION_CHUNK_OVERLAP`** | **1500** |
| **`DOC_CHUNK_NEAR_DUPLICATE_JACCARD`** | **0.92** (near-duplicate suppression threshold before extraction/indexing) |

#### Ollama / Qdrant / chat widget

| Variable | Role |
|----------|------|
| **`OLLAMA_BASE_URL`** | Ollama HTTP API base (**`AiService`**, **`RagService`**) |
| **`OLLAMA_MODEL`** | Default chat/extraction LLM id |
| **`OLLAMA_EMBED_MODEL`** | Embedding model for RAG (**`RagService`**, default **`nomic-embed-text`**) |
| **`QDRANT_URL`** | Qdrant REST base |
| **`QDRANT_COLLECTION`** | Vector collection name (default **`manual_chunks`**) |
| **`ENABLE_CHAT_IMAGE_VISION`** | Techo user image attachment path; set to **`false`** to disable (default on) |

#### Bull / Redis (§13)

| Topic | As wired |
|-------|-----------|
| Job retention | **`removeOnComplete: 100`**, **`removeOnFail: 100`** on every **`queue.add`** — **not** env-driven |
| Redis URL | No **`BullModule.forRoot`** in **`AppModule`**; defaults to **localhost Redis** unless extended later |

### Admin: read-only snapshot

**`GET /api/knowledge-documents/pipeline-config`** (admin/superadmin) returns JSON with the **effective** values above (plus resolved paths). **UI:** **`/dashboard/admin/pipeline-config`** (“Pipeline env” in the admin sidebar). Use this to verify staging/production config without reading server env files.

---

## 17. Admin Dashboards Required [Status: Implemented — MVP + §17 backlog items]

This section maps **PDF Knowledge admin UX** to concrete routes under **`/dashboard/admin/…`**. Anything still aspirational is called out explicitly.

### 17.1 Document list view (PDF Library)

**Route:** **`/dashboard/admin/knowledge-docs`**.

**Implemented:** filename, machine label (or “not detected”), uploader + timestamp, **`docType`** + gate confidence + needs-review hint, **status badge**, **Open / Download / Delete**, **§11** “Show superseded” checkbox + **`?supersedes=`** replacement banner, **5s auto-refresh**.

**Implemented (this pass):** per-row **progress bar**, **`currentStage`** label (spaces instead of underscores), **pages processed / total pages** when present, **manual chunks indexed** line when **`chunksIndexed` > 0**.

**Not in list row:** per-quality 🟢/🟡 counts (those appear on **document detail** via page analysis / status).

### 17.2 Document detail view

**Route:** **`/dashboard/admin/knowledge-docs/:id`**.

**Implemented:** metadata, **official machine name** editor, **technician name suggestions**, **page analysis** table (paginated), **extraction candidates** with approve/reject/edit modal, **Run OCR** / **Run vision** / **reindex manual chunks** where exposed in UI, **§11** supersede links when applicable.

**Not implemented:** dedicated “this document’s rows only” slice of **`admin_page_fix_queue`** on the same page (admins use **Page fix queue** global list + document link).

### 17.3 Admin page fix queue

**Route:** **`/dashboard/admin/page-fix-queue`**.

**Implemented:** table (document link, page, reason), **Fix text**, **Upload image**, **Dismiss**.

**Implemented (this pass):** when **`replacementImagePath`** is set, an **inline thumbnail** loads via **`GET /knowledge-documents/page-fix-queue/:itemId/replacement-image`** (admin JWT; image bytes constrained under the page-fix upload directory on disk).

### 17.4 Machine profiles view

**Routes:** **`/dashboard/admin/machine-profiles`** (list + create), **`/dashboard/admin/machine-profiles/:id`** (detail).

**Implemented:** list table + **Create** form (name + manufacturer).

**Implemented (this pass):** **Manage** opens detail. Detail calls **`GET /machine-profiles/:id/summary`** (admin/superadmin) for:

- **`pdfDocumentCount`** — **`knowledge_documents`** with **`machineProfileId`** (excluding **`superseded`**).
- **`knowledgeEntriesApproxCount`** / **`knowledgeEntriesWithPhotoApproxCount`** — **`knowledge_entries`** where **`LOWER(TRIM(machineName))`** matches the profile name (**not** a FK; heuristic for dashboards only).

**Implemented:** **`PATCH /machine-profiles/:id`** from the detail form (machine name, manufacturer, family, model, components).

**Not implemented:** “Add experience” / “upload photo” **from this screen** (use **Knowledge base** flows; §9).

### 17.5 Pending review counter

**Implemented (unchanged):** sidebar badges via **`GET /knowledge-documents/admin-pipeline-counts`** and **`GET /knowledge/pending-review/count`**.

### 17.6 Extraction feedback log (§14)

**Implemented:** **`/dashboard/admin/extraction-feedback`** (see §14).

### 17.7 Pipeline environment (§16)

**Implemented:** **`/dashboard/admin/pipeline-config`** (see §16).

### 17.8 §22 Troubleshooting extraction reference

**Implemented:** **`/dashboard/admin/troubleshooting-extraction`** — loads **`GET /knowledge-documents/troubleshooting-extraction-reference`** (service name, Bull queue, env keys, **`knowledge_extraction_candidates`** columns, related HTTP routes). Linked from the admin sidebar (**§22 Extraction**) and **Pipeline hub** §22 card.

### 17.9 §23 Problems & solutions export

**Implemented:** **`/dashboard/admin/problems-solutions-export`** — filters + download via **`GET /api/export/problems-solutions`** (blob); loads **`GET /api/export/problems-solutions-reference`** for the §23 contract table. Sidebar **§23 Export**; **Pipeline hub** §23 card.

---

## 18. API Endpoints Required [Status: Implemented — reference]

**Global prefix:** every HTTP route below is served under **`/api`** (Nest `setGlobalPrefix('api')`). Example: `GET /knowledge-documents` → **`GET /api/knowledge-documents`**.

**Interactive discovery:** Open **`/api/docs`** on the backend host (Swagger UI). The admin Next app links to **`{NEXT_PUBLIC_API_URL}/api/docs`** (“API (Swagger)” in the sidebar; §18 card on **Pipeline hub**). Use **Authorize** with a JWT from **`POST /api/auth/login`**.

**Role shorthand:** **`admin`** = `ADMIN` or `SUPERADMIN` in code unless noted.

### App & auth

```
GET    /health                    → `{ status, timestamp, service }` (no JWT)
GET    /                          → hello string (no JWT)
POST   /auth/login                → JWT (LocalAuthGuard; body credentials)
POST   /auth/register             → register (public per controller)
GET    /auth/profile              → current user (JWT)
```

### PDF upload and management (`/knowledge-documents`)

```
POST   /knowledge-documents/upload?supersedesDocumentId=<uuid>  → multipart PDF upload; **202 Accepted**; optional §11 replacement chain (admin)
POST   /knowledge-documents?supersedesDocumentId=<uuid>         → same handler as **/upload** (alias)
GET    /knowledge-documents?includeSuperseded=true              → list (**technician** sees current only; **`includeSuperseded`** honored for **admin** only)
GET    /knowledge-documents/:id                                 → document detail + resume stats (**admin**, **technician**)
GET    /knowledge-documents/:id/status                          → progress (**admin**, **technician**)
GET    /knowledge-documents/:id/page-analysis                   → per-page OCR/quality (**admin** only)
GET    /knowledge-documents/:id/download                        → original PDF stream (**admin**, **technician**)
POST   /knowledge-documents/:id/run-ocr                         → manually trigger OCR (admin)
POST   /knowledge-documents/:id/run-vision                      → manually trigger vision for the document (admin)
POST   /knowledge-documents/:id/reindex-manual-chunks           → rebuild Qdrant manual chunks from current page_analysis (admin)
POST   /knowledge-documents/:id/gate/approve                    → continue pipeline after gate review (admin)
POST   /knowledge-documents/:id/gate/reject                     → reject at gate; body `reason` (admin)
GET    /knowledge-documents/:id/machine-name/suggestions        → pending machine-name suggestions (admin)
PATCH  /knowledge-documents/:id/machine-name                  → set official machine name (admin)
POST   /knowledge-documents/:id/machine-name/suggest          → technician proposes a name (pending admin review)
POST   /knowledge-documents/machine-name-suggestions/:suggestionId/approve   → approve one suggestion (admin)
POST   /knowledge-documents/machine-name-suggestions/:suggestionId/reject    → reject one suggestion (admin)
DELETE /knowledge-documents/:id                                 → delete document; purges manual Qdrant chunks + `vector_chunk_hashes` for that id (admin)
```

### Chat (`/chat`)

```
POST   /chat/message              → `{ reply, ticketId, sources }` — RAG + approved knowledge; **sources** = attribution list (§12); optional **imageBase64**, **history**, **ticketId**
GET    /chat/history/:ticketId    → conversation rows for a ticket (JWT; ticket access checked)
GET    /chat/my-history             → up to 200 messages where sender is current user (any ticket / general chat)
```

### Admin pipeline & page fix (`/knowledge-documents` continued)

```
GET    /knowledge-documents/admin-pipeline-counts               → `{ pageFixOpen, extractionCandidatesPending }` (admin)
GET    /knowledge-documents/queues/health                       → Redis PING + Bull `getJobCounts` per queue (admin; §13)
GET    /knowledge-documents/pipeline-config                     → read-only effective PDF pipeline env (admin; §16); **`vision`** includes **`enabled`** (effective), **`enabledFromEnv`**, **`adminToggleOn`**
GET    /knowledge-documents/database-inventory                  → curated §19 PostgreSQL table list (admin)
GET    /knowledge-documents/qa-success-criteria                 → §20 QA matrix (shipped / partial / gap / aspirational; curated)
GET    /knowledge-documents/troubleshooting-extraction-reference   → §22 read-only: extraction service, Bull queue, env keys, DB columns, related routes (curated)
GET    /knowledge-documents/pipeline-preferences/pdf-vision     → `{ pdfVisionAdminEnabled, enabledFromEnv, enabledEffective }` (admin)
PATCH  /knowledge-documents/pipeline-preferences/pdf-vision     → body `{ "enabled": true|false }` — admin PDF vision toggle (still requires **`ENABLE_PDF_VISION`** in env to turn on)
GET    /knowledge-documents/extraction-feedback/recent?limit=200  → recent §14 analytics rows (admin; limit 1–500)
GET    /knowledge-documents/page-fix-queue                      → list unreadable pages (admin)
GET    /knowledge-documents/page-fix-queue/:itemId/replacement-image → replacement JPEG/PNG/WebP (admin; §17)
POST   /knowledge-documents/page-fix-queue/:itemId/fix-text     → admin submits manual text
POST   /knowledge-documents/page-fix-queue/:itemId/fix-image    → admin uploads replacement page image (multipart); vision when enabled
POST   /knowledge-documents/page-fix-queue/:itemId/dismiss      → mark page as not important
```

### Candidate review (`/knowledge-documents`)

```
GET    /knowledge-documents/:id/extractions                     → list candidates for one document (admin)
POST   /knowledge-documents/extractions/:candidateId/approve    → approve (body optional edits) (admin)
POST   /knowledge-documents/extractions/:candidateId/reject     → reject with optional reason (admin)
```

### Machine profiles (`/machine-profiles`)

```
GET    /machine-profiles                    → list profiles (**admin**, **superadmin**, **technician**)
GET    /machine-profiles/:id/summary        → profile + PDF + approximate knowledge/photo counts (admin; §17) — register **before** `GET :id` in router
GET    /machine-profiles/:id                → profile by id
POST   /machine-profiles                    → create manually (admin)
PATCH  /machine-profiles/:id                → update profile (admin)
```

### Technician experience & knowledge (`/knowledge`)

```
GET    /knowledge/pending-review/count
GET    /knowledge/pending-review
GET    /knowledge/export/csv
GET    /knowledge/export/xlsx
GET    /knowledge
POST   /knowledge
GET    /knowledge/:id
PATCH  /knowledge/:id
DELETE /knowledge/:id
POST   /knowledge/:id/approve
POST   /knowledge/:id/reject
POST   /knowledge/:id/photo
GET    /knowledge/:id/photo-file
```

### Export (approved entries)

```
GET    /export/problems-solutions-reference                      → §23 read-only: columns, query params, notes (admin/superadmin)
GET    /export/problems-solutions?format=csv|xlsx&machine=&documentId=&severity=&from=&to=  → stream file; **machine** LIKE on machineName; **documentId** UUID = `knowledge_entries.knowledgeDocumentId` (set when approving PDF candidates); **severity** exact (case-insensitive); **from** / **to** ISO — both → `Between(createdAt)`; **from** only → `>=`; **to** only → `<=` end of that UTC day
```

Roles: **`GET …/problems-solutions`** — **admin, superadmin, technician**. **`…-reference`** — **admin, superadmin** only.

**Admin UI:** **`/dashboard/admin/problems-solutions-export`** (sidebar **§23 Export**; Pipeline hub §23 card).

**Separate raw dumps (technician-scoped listing columns):** **`GET /knowledge/export/csv`** and **`GET /knowledge/export/xlsx`** — not the same column layout as §23 curated export.

### WebSocket events (implemented vs aspirational)

**Implemented:** **`document:progress`** (namespace **`/documents`**, JWT on connect).

**Not implemented as separate named events:** `document:complete`, `document:failed`, `candidate:new`, `page:fixable` — use REST **`GET /knowledge-documents/:id/status`** and polling for those signals today.

---

## 19. Database Tables Required [Status: Implemented — reference]

TypeORM **`@Entity('table_name')`** names are the **PostgreSQL** table names below. **Qdrant** holds vector payloads (not listed here). Migrations live under **`backend/src/database/migrations/`** (numeric prefix order).

**Implemented (admin):** **`GET /knowledge-documents/database-inventory`** returns the same curated rows as the first table. UI: **`/dashboard/admin/database-inventory`** (sidebar **DB inventory**; Pipeline hub §19 card).

### Core PDF pipeline tables

| PostgreSQL table | TypeORM entity | Role |
|------------------|----------------|------|
| **`knowledge_documents`** | `KnowledgeDocument` | PDF file metadata, **`status`**, progress (**`progressPercent`**, **`currentStage`**, **`pagesProcessed`**), gate (**`isWorkRelated`**, **`gateConfidence`**), **`fingerprint`**, **`machineProfileId`**, **`supersedesDocumentId`** / **`supersededByDocumentId`** (§11), **`chunksIndexed`** |
| **`knowledge_document_page_analysis`** | `KnowledgeDocumentPageAnalysis` | One row per **`(documentId, pageNumber)`**: **`ocrText`**, quality, **`extractionMode`** (`text` \| `ocr` \| `vision`), **`visionUsed`**, warnings |
| **`knowledge_extraction_candidates`** | `KnowledgeExtractionCandidate` | LLM candidates for admin approve/reject → **`knowledge_entries`** |
| **`knowledge_document_jobs`** | `KnowledgeDocumentJob` | Bull job tracking (**`jobType`**, **`bullJobId`**, progress JSON) per document |
| **`vector_chunk_hashes`** | `VectorChunkHash` | Normalized chunk text SHA256 + **`documentId`** for cross-document embed dedup (§11) |
| **`machine_profiles`** | `MachineProfile` | Machine catalog; FK from **`knowledge_documents.machineProfileId`** |
| **`machine_name_suggestions`** | `MachineNameSuggestion` | Technician proposals until admin sets **`knowledge_documents.machineName`** |
| **`admin_page_fix_queue`** | `AdminPageFixQueueItem` | Unreadable pages; **`replacementImagePath`**; fix/dismiss |
| **`extraction_feedback_events`** | `ExtractionFeedbackEvent` | §14 analytics (approve / reject / edits metadata) |
| **`pipeline_preferences`** | `PipelinePreferences` | Singleton row: admin **`pdfVisionEnabled`** (UI toggle); effective PDF vision = **`ENABLE_PDF_VISION`** env **AND** this flag |

### Shared application tables (PDF pipeline touches)

| PostgreSQL table | TypeORM entity | Role |
|------------------|----------------|------|
| **`knowledge_entries`** | `KnowledgeEntry` | Approved technician + curated knowledge; **`photoPath`**; optional **`knowledgeDocumentId`** → PDF (**§23** export filter); RAG + export |
| **`audit_logs`** | `AuditLog` | Audit trail where instrumented |
| **`users`** | `User` | **`uploadedById`**, fix actors, **`createdById`** on knowledge, etc. |
| **`tickets`** | `Ticket` | Techo **`ticketId`** context |
| **`conversations`** | `Conversation` | Persisted chat rows |
| **`attachments`** | `Attachment` | Ticket attachments (distinct from knowledge PDFs) |

### Migration pointers (representative)

| Area | Example migration files |
|------|-------------------------|
| Initial knowledge docs + candidates | `1700000000002-AddKnowledgeDocsAndCandidates.ts` |
| Gate, doc type | `1700000000005-AddPdfGateAndDocType.ts` |
| Structured extraction columns | `1700000000006-AddExtractionStructuredFields.ts` |
| Page analysis | `1700000000007-AddKnowledgeDocumentPageAnalysis.ts` |
| Bull job rows + document progress fields | `1700000000008-AddKnowledgeDocumentJobAndProgress.ts` |
| Fingerprint | `1700000000009-AddKnowledgeDocumentFingerprint.ts` |
| Machine profiles | `1700000000010-AddMachineProfiles.ts` |
| Section routing | `1700000000011-AddPageSectionRouting.ts` |
| Page fix queue | `1700000000012-AddAdminPageFixQueue.ts` |
| Technician experience fields | `1700000000013-AddTechnicianExperienceFields.ts` |
| Experience photo | `1700000000014-AddExperiencePhotoPath.ts` |
| Vector chunk hashes | `1700000000015-AddVectorChunkHashes.ts` |
| Extraction feedback | `1700000000016-AddExtractionFeedbackEvents.ts` |
| Replacement image on fix queue | `1700000000017-AddPageFixQueueReplacementImage.ts` |
| PDF supersession (§11) | `1700000000018-AddKnowledgeDocumentSupersession.ts` |
| Knowledge entry → PDF FK (§23) | `1700000000020-AddKnowledgeEntryKnowledgeDocumentId.ts` |
| Pipeline preferences (admin vision toggle) | `1700000000019-AddPipelinePreferences.ts` |

---

## 20. Success Criteria [Status: Implemented — reference]

Section §20 is the **original product bar** for the PDF knowledge pipeline. The codebase does **not** auto-verify these items in CI today; instead we maintain an explicit **QA matrix** (same rows as below) via:

- **`GET /knowledge-documents/qa-success-criteria`** (admin/superadmin) — JSON for tooling or dashboards
- **`/dashboard/admin/success-criteria`** — human-readable table (sidebar **QA §20**; Pipeline hub §20 card)

**Status vocabulary**

| Status | Meaning |
|--------|---------|
| **Shipped** | Behavior is in production and matches the intent for typical happy paths. |
| **Partial** | Implemented but with documented limits, caps, or edge cases. |
| **Gap** | Not met as stated; needs design/work or measurement harness. |
| **Aspirational** | Benchmark / SLA style statement; not treated as a hard guarantee in code. |

### Matrix (aligned with `KnowledgeDocumentsService.getQaSuccessCriteria()`)

| ID | Goal (verbatim intent) | Status | Notes |
|----|-------------------------|--------|--------|
| `gate-irrelevant` | Irrelevant PDFs blocked at the gate without calling the LLM in obvious cases | **Partial** | Three-tier gate; obvious rejects often skip LLM; borderline cases still hit Tier 3. |
| `machine-cover` | Machine name and manufacturer auto-detected from PDF cover pages | **Partial** | Machine name + suggestions flow; manufacturer auto-fill is not guaranteed for every manual. |
| `pages-covered` | All pages of any PDF are covered by text extraction, OCR, or vision | **Partial** | Text + OCR + bounded vision; **`PDF_OCR_MAX_PAGES`** / **`PDF_VISION_MAX_PAGES`** cap work per run. |
| `upload-latency` | Very large PDFs do not block the backend — upload returns in under ~1 second | **Aspirational** | 202 Accepted after accept; disk I/O still scales with bytes — validate in your deployment. |
| `concurrent-uploads` | Multiple PDFs can be uploaded simultaneously without crashes | **Partial** | Bull-backed workers; no bundled stress test proves limits. |
| `progress-realtime` | Progress is visible from 0% to 100% in real time | **Partial** | Postgres fields + **`document:progress`** WS; some UIs still poll **`GET …/status`**. |
| `chat-latency` | Chatbot has access to fault tables within ~2 minutes of upload | **Gap** | No automated SLA; depends on queues, chunk limits, and model latency. |
| `unreadable-nonblocking` | Unreadable pages never block the pipeline — they go to admin queue | **Shipped** | **`admin_page_fix_queue`** + pipeline continues. |
| `admin-fix-index` | Admin can fix unreadable pages manually and content is indexed quickly | **Partial** | Re-index hooks after fix; Qdrant failures are log-only (see §17 ops notes). |
| `tech-in-chat` | Technician experience entries appear in chatbot answers alongside PDF knowledge | **Shipped** | Approved **`knowledge_entries`** in RAG path. |
| `attribution` | Chatbot always shows source attribution (page, document, technician) | **Partial** | **`sources`** on **`POST /chat/message`** + UI; persisting sources on stored rows still **pending** (Purpose backlog). |
| `cross-dedup` | Cross-document deduplication prevents duplicate answers | **Partial** | Fingerprint + **`vector_chunk_hashes`** + supersede purge — not full semantic de-duplication of all paraphrases. |
| `crash-resume` | System recovers automatically from worker crashes without reprocessing from page 1 | **Gap** | Retries / re-queues help; durable per-page checkpoint story not fully specified in code. |
| `tri-lang-ocr` | French, English, and Arabic PDFs are all extracted correctly | **Partial** | **`PADDLE_OCR_LANG`** (`latin`, `arabic`, etc.); quality still scan-dependent. |

**How to evolve §20:** When you ship a fix that closes a gap, update **`getQaSuccessCriteria()`** in **`knowledge-documents.service.ts`** and this table so the PDF, API, and UI stay aligned.

---

## 21. Implementation Order (Recommended) [Status: Implemented]

Build in this exact order to get value at each step:

1. Ingestion + validation + fingerprint deduplication
2. Bull queue setup (5 queues + worker structure)
3. Progress tracking (PostgreSQL fields + WebSocket events)
4. Upload gate (3-tier: heuristic → embedding → LLM)
5. Machine profile auto-detection
6. Doc-type routing + section labeling
7. Page quality scoring
8. Text extraction + OCR pipeline (Employees 1 + 2)
9. Structured extraction with chunk strategy per section type
10. Admin review loop + timeout policy
11. Unreadable page admin fix queue
12. Embedding + Qdrant indexing with dedup
13. Technician experience entries
14. Field photo knowledge
15. Vision model integration (Employee 3) — last because optional
16. Feedback learning loop
17. Admin dashboards (document list, detail, page fix queue, machine profiles)

---

This document is the complete reference for the SmartMaint PDF Knowledge pipeline.
All implementation decisions must align with this document.

---

## 22. Problem / Solution Extraction (Troubleshooting) [Status: Partial]

### Responsibility

**Implemented:** **`KnowledgeDocumentsService.processDocumentExtraction(documentId)`**, run by the Bull worker on queue **`knowledge-documents-extraction`** (job type **`extraction`** — see **`queues.constants.ts`** / **`KnowledgeDocumentsQueueProcessor`**). There is **no** separate **`PdfTroubleshootingExtractorService`** in the codebase.

**Read-only alignment for admins:** **`GET /knowledge-documents/troubleshooting-extraction-reference`** (curated JSON from **`getTroubleshootingExtractionReference()`**) and **`/dashboard/admin/troubleshooting-extraction`** (Pipeline hub §22 card).

### Objective

Many manuals expose fault tables, alarm lists, and corrective-action prose. The pipeline must turn those into **reviewable structured rows** (candidates), then **approved `knowledge_entries`** for RAG and reporting (§23).

### End-to-end flow (as coded)

1. **Job:** something upstream enqueues **`EXTRACTION_QUEUE`** → processor calls **`processDocumentExtraction`**.
2. **Prompt:** system text is read from **`backend/src/ai/prompts/techo-pdf-extractor-system.prompt.md`** with dist-relative fallbacks (same file).
3. **Parse:** **`pdf-parse`** yields full text + page count; **`knowledge_document_page_analysis`** for the document is replaced via **`savePageAnalysis`** (per-page quality + **`sectionType`** from **`detectSectionType`**).
4. **Async helpers:** low-quality pages may enqueue **OCR** or **vision** jobs; failures there are best-effort and do not abort extraction.
5. **Text window:** if the lowercased full string contains the substring **`troubleshooting`**, extraction (and **`reindexManualChunksForDocument`**) uses text from that offset onward; otherwise the **entire** extracted string is used. Manuals that only use e.g. **Dépannage** without the English word keep the full body (no French keyword slice today).
6. **Chunking:** **`buildRoutedChunks(documentId, text, chunkSize, overlap)`** uses page analysis when present, else sliding windows. **`prioritizeChunksForExtraction`** scores chunks using **`classifyChunkSection(chunk, docType)`** so fault/alarm/procedure-like regions are sent to the LLM first.
7. **Caps:** **`DOC_EXTRACTION_MAX_CHUNKS`**, **`DOC_EXTRACTION_MAX_CANDIDATES`**, **`DOC_EXTRACTION_MAX_CANDIDATES_PER_CHUNK`**, **`DOC_EXTRACTION_CHUNK_SIZE`**, **`DOC_EXTRACTION_CHUNK_OVERLAP`** bound cost.
8. **LLM:** for each chunk, **`aiService.chat`** with system prompt + a user message that demands JSON **`{ "candidates": [ … ] }`** (see inline contract in code).
9. **Persist:** valid items become **`knowledge_extraction_candidates`** rows (deduped in-process by title + problem + solution fingerprint). Admin **approve / reject** moves or drops them (§7–§8); approve path writes **`knowledge_entries`**.

### What the heuristics favor (patterns)

The LLM still does the semantic lift; routing biases it toward table-like and corrective content:

- Lines containing **`E-…`**, **`A-…`**, or **`|`** under **`fault_table`** / **`alarm_list`** page sections are split into line chunks when **`buildRoutedChunks`** runs in table mode.
- **`warning_notice`** pages contribute a bounded slice as a single chunk.
- **`detectSectionType`** matches keywords such as *fault table*, *troubleshooting*, *dépannage*, *alarm*, *wiring*, *warning*, *procedure*, *specification* (see service).

There is **no** stored label **`troubleshooting_table`**; closest stored page labels are **`fault_table`** / **`procedure_steps`**, and chunk hints include **`general_text`**.

### Section labels (two layers)

| Layer | Function | Typical values |
|--------|-----------|------------------|
| Per-page | **`detectSectionType`** → **`knowledge_document_page_analysis.sectionType`** | `fault_table`, `alarm_list`, `wiring`, `warning_notice`, `procedure_steps`, `specification`, `general` |
| Per-chunk hint | **`classifyChunkSection`** → passed as “Section type hint” in the user message; stored on each **`KnowledgeExtractionCandidate.sectionType`** | `fault_table`, `alarm_list`, `wiring`, `warning_notice`, `procedure_steps`, `specification`, `general_text` |

### Persisted schema (actual table)

**Table:** **`knowledge_extraction_candidates`** · **Entity:** **`KnowledgeExtractionCandidate`**

| DB column | Purpose |
|-----------|---------|
| `title` | Short heading |
| `problemDescription` | Problem statement |
| `solution` | Remediation |
| `symptom`, `rootCause` | Optional fields (map conceptually to “symptom” / “cause” in manuals) |
| `entryType` | From model, or default via **`defaultEntryTypeFromSection`** (`fault`, `procedure`, `safety`, `wiring`, `spec`) |
| `sectionType` | Chunk section hint above |
| `sourcePages` | **String** in DB (model may return numbers; joined or stringified) |
| `tags` | **String** (often comma-separated) |
| `confidence` | Float 0–1 or null |
| `status` | `candidate` → `approved` / `rejected` |

First-class columns for **`errorCode`**, **`severity`**, **`correctionSteps`**, **`language`**, **`machineProfileId`** on the candidate row **do not exist**; those ideas may appear **inside** free-text fields if the model emits them. Product-level reporting columns for export are largely on **`knowledge_entries`** after approval (§23).

### LLM JSON contract (summary)

- **System:** full contents of **`techo-pdf-extractor-system.prompt.md`**.
- **User (per chunk):** instructs JSON only with top-level **`candidates`**. Each element should include **`entryType`**, **`title`**, **`problemDescription`**, **`solution`**, and may include **`symptom`**, **`rootCause`**, **`tags`**, **`sourcePages`**, **`confidence`**. Allowed **`entryType`** values in the user prompt: **`fault`**, **`procedure`**, **`safety`**, **`wiring`**, **`spec`**.

### Chatbot use

Approved content is embedded and retrieved like other **`knowledge_entries`** and manual chunks (§12). **`POST /chat/message`** returns **`sources`** when the model uses retrieved passages; exact fault-code Q&A quality depends on how codes were written into titles/text and on vector retrieval.

---

## 23. Export to Excel / CSV [Status: Partial]

### Responsibility

| Path | Role |
|------|------|
| **`KnowledgeExportService`** (`backend/src/export/knowledge-export.service.ts`) + **`GET /export/problems-solutions`** | Curated **Problems & Solutions** sheet (13 columns); **exceljs** for **`.xlsx`**, quoted **`.csv`**. |
| **`GET /export/problems-solutions-reference`** | Read-only §23 contract JSON (**admin/superadmin**). |
| **`GET /knowledge/export/csv`** / **`GET /knowledge/export/xlsx`** | Raw **`knowledge_entries`** column dump; technicians only see **their** rows (**`KnowledgeService`**). |

### Objective

Offline reporting for **approved** knowledge: PDF-promoted rows and technician experience, with optional filters. Columns that are not stored on **`knowledge_entries`** stay **empty** (reserved for future structured fields).

### Query parameters (`GET /export/problems-solutions`)

| Param | Behavior |
|-------|-----------|
| **`format`** | **`xlsx`** (default) or **`csv`**. |
| **`machine`** | Case-insensitive **LIKE** on **`k.machineName`**. |
| **`documentId`** | **UUID** — exact match on **`knowledge_entries.knowledgeDocumentId`** (FK **`knowledge_documents`**). Populated when **`approveExtractionCandidate`** runs (**§7–§8**). Rows approved **before** migration **`1700000000020-AddKnowledgeEntryKnowledgeDocumentId`** keep **NULL** and will not match this filter. |
| **`severity`** | Case-insensitive equality on **`k.severity`**. |
| **`from`** / **`to`** | ISO timestamps accepted by **`Date`**. **Both** → **`Between(createdAt)`**. **Only `from`** → **`createdAt >= from`**. **Only `to`** → **`createdAt <=` end of that calendar day (UTC). |

**Roles:** **`GET …/problems-solutions`** — **admin, superadmin, technician** (same dataset for all three today — use **`/knowledge/export/*`** for technician-self raw dumps). **`…-reference`** — **admin, superadmin** only.

### Output columns

Single sheet **`Problems & Solutions`**. Headers:

`Machine Name`, `Manufacturer`, `Error Code`, `Problem`, `Symptom`, `Cause`, `Solution`, `Correction Steps`, `Severity`, `Source Document`, `Page(s)`, `Language`, `Extracted Date`

**Filled from DB / joins:** **`machineName`**, **`problemDescription`**, **`symptom`**, **`rootCause`**, **`solution`**, **`severity`**, **`createdAt`**. **`Manufacturer`** when **`knowledgeDocumentId`** resolves and the linked PDF has **`machineProfileId`** → **`machine_profiles.manufacturer`**. **`Source Document`**: PDF → **`knowledge_documents.originalName`**; **`field_experience`** (and similar) → **`Field experience —`** then **`user.fullName`**, else **`username`**, else **`email`**.

**Reserved (usually blank):** Error Code, Correction Steps, Page(s), Language.

### File response

- Streamed **`StreamableFile`** with **`Content-Disposition: attachment; filename="problems-solutions_{machineSlug|all}[_doc]_{YYYY-MM-DD}.xlsx|csv"`** (`_doc` appears when a valid **`documentId`** filter is present; machine slug sanitized).
- Excel header row: **bold**, cyan fill **`#00B8D4`**, white text; column widths estimated from cell lengths (capped).

### Admin UI

**Implemented:** **`/dashboard/admin/problems-solutions-export`** — filter form + blob download; sidebar **§23 Export**; Pipeline hub §23 card.

### Not implemented (legacy doc targets)

- Excel **summary statistics** block above the grid.
- **Alternating row** banding (header styling only).
- Dedicated **`knowledge_problems_solutions`** table — the long relational sketch in older revisions remains a **product target**, not a live table.

### Database (today)

- **`knowledge_entries`** holds approved rows; optional **`knowledgeDocumentId`** FK (**`ON DELETE SET NULL`**) links PDF-sourced approvals back to **`knowledge_documents`** for filters and **`Manufacturer`** / PDF title in export.
- **`knowledge_extraction_candidates`** is not exported directly (§22).

### Example requests

```
GET /export/problems-solutions?format=csv
GET /export/problems-solutions?machine=Danao&format=xlsx
GET /export/problems-solutions?documentId=<uuid>&format=xlsx
GET /export/problems-solutions?severity=high&from=2024-01-01&to=2024-12-31
```

---