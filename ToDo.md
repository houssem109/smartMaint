# SmartMaint AI Phase 2 — ToDo / Requirements

This document is meant to be easy to read later. It collects **what we want to build**, the **expected functionality**, and the **questions / inputs still needed** before we code the next parts.

## Current status (what already exists)

- Backend
  - `KnowledgeEntry` model + admin/technician CRUD UI (problem + solution library) ✅ (implemented earlier)
  - Techo LLM integration (Ollama wrapper) ✅
  - Techo chat API (JWT-protected):
    - `POST /api/chat/message` ✅
    - `GET /api/chat/history/:ticketId` ✅
    - `GET /api/chat/my-history` ✅ (store messages per account)
  - Techo system prompt file exists ✅ (`backend/src/ai/prompts/techo-system.prompt.md`)
  - Chat is conversation-capable and supports basic controls (editing + response replacement, “thinking” indicator) ✅ (frontend)

- Frontend
  - Techo widget (floating chat UI) ✅
  - Multi-tab conversations (local UI) + persistence in browser localStorage ✅
  - Admin knowledge base UI exists ✅
  - Technician/Worker sidebars include “Knowledge base” ✅
- PDF library extraction MVP (Part 1 + Part 2)
  - Admin PDF library upload/list/details page ✅
  - Automatic PDF text extraction → Problem/Solution candidates ✅
  - Admin approve/edit/reject extracted candidates → creates `KnowledgeEntry` ✅

## What we want next (big picture)

We want Techo to be able to answer maintenance/troubleshooting questions using:

1. Experience knowledge (our `KnowledgeEntry` problem/solution library)
2. Manuals in PDF form
   - Upload PDFs
   - See what Techo extracted
   - Review/approve extracted problem/solution candidates
   - Use the PDF content for full-text QA via RAG

Additionally, for certain errors (example: “article does not exist…”), we want Techo to:

3. Call a safe database lookup tool (SQL Server) to check existence in tables/fields
   - If not found: reply “not found” (stop)
   - If found: continue diagnostics or create ticket/notify technician

## Phase 2 — PDF Library + RAG (Part A + Part B)

### Part 1 — Admin UI to upload + see PDFs (transparent)

**User-visible result**

- Admin page: `(/dashboard/admin/knowledge-docs)` (or similar)
  - Upload button (PDF)
  - Table showing **ALL uploaded PDFs**:
    - filename, original name, upload time, uploaded by, status
  - Click a PDF → details page with a “resume/summary” section:
    - chunks indexed (eventually)
    - extracted candidates count
    - approved count
    - rejected count
  - Extracted problem/solution candidates table:
    - view full extracted text
    - approve/edit/reject (approve → becomes `KnowledgeEntry`)

**Backend responsibilities**

- Create `knowledge_documents` table
  - metadata + status (uploaded / processing / done / failed)
- Create endpoints:
  - upload PDF
  - list all documents (admin)
  - get document details (admin)

### Part 2 — Extraction from PDFs (Problem/Solution candidates)

**Pipeline B (transparent extraction)**

On PDF upload:
1. Extract text from PDF
2. Chunk into segments
3. Run an LLM extractor to detect:
   - title
   - problem description / symptoms
   - solution steps
   - optional tags (machine subsystem, error domain, safety, etc.)
4. Store extraction results as “candidates” linked to the PDF
5. UI allows admin to approve/reject/edit
6. Approving creates/updates `KnowledgeEntry`

### Part 3 — Full-text RAG index from PDFs (Q&A)

**Pipeline A (full manual RAG)**

On PDF upload:
1. Extract text
2. Chunk into retrieval segments
3. Create embeddings for each chunk
4. Store embeddings in a vector DB and keep metadata:
   - documentId
   - page number (if possible)
   - section heading (if detectable)
5. During chat, retrieve top-k relevant chunks from this vector DB
6. Inject retrieved context into Techo’s prompt

### Techo behavior with RAG

- When user asks:
  - retrieve relevant chunks from vector DB
  - retrieve relevant `KnowledgeEntry` (later, if also indexed)
  - answer using retrieved context
- Still obey Techo safety rules & job-only scope.

## Admin/Technician “Knowledge base” (Experience library)

Already implemented earlier.

Future integration with RAG:
- Either index `KnowledgeEntry` in the vector DB as chunks
- Or retrieve directly from DB by embedding similarity

## Conversation threads / editing / done-state

Current desired UI behavior (already partially implemented in frontend):

- Multiple conversation tabs
- Each tab keeps its own conversation memory context
- Edit last user message:
  - when sending edited message, Techo’s reply should be replaced/updated (not duplicated)
- When a conversation is “done”:
  - disable further sending in that thread
  - keep conversation visible for reference

Open technical improvement:
- Current conversation tabs exist locally; we still need a better “server truth” thread model (if we want perfect cross-device sync).

## SQL Server lookup tool for “not found” errors (tool-use)

Desired behavior for errors like:

“Vérification l'article n'existe pas de la table ARTICLE/MAGASIN”

**User-visible result**

- Techo identifies what to search:
  - Which table(s)
  - Which field(s)
  - Which lookup value(s) to use
- Techo calls backend tool:
  - safe, allowlisted query
- If result is not found:
  - reply clearly: “Not found in ARTICLE/MAGASIN”
  - stop there (no unrelated solution)
- If found:
  - continue with the next diagnostic step OR create ticket + notify technician

**Important security rule**

- AI must NOT generate arbitrary SQL.
- Backend tool must only allow:
  - allowlisted table names
  - allowlisted column names
  - parameterized queries (no string SQL construction)

## WhatsApp integration (later phase)

Testing:
- Twilio trial / sandbox for end-to-end test

Production cost option (later):
- Often Meta direct / Cloud API is cheaper than Twilio at scale

Implementation plan later:
- Add WhatsApp webhook controller
- Map WA user → SmartMaint user (or external user id)
- Send message → backend chat pipeline
- Send reply back → WhatsApp API

## What I need from you (open questions / inputs)

### A) PDF ingestion/extraction

1. Do you want **only admin** to upload PDFs, or technicians too?
2. Approx size of PDFs:
   - typical pages? (example: ~192 pages like your manual)
3. Output format for extracted candidates:
   - “title / problemDescription / solution (steps)” is fine?
4. Should approved candidates go into:
   - `KnowledgeEntry` table only
   - or both `KnowledgeEntry` + a vector index for RAG?

### B) Vector DB / embeddings choices (Part A)

1. Choose vector DB:
   - **Chroma** or **Qdrant**
2. Choose embedding model:
   - multilingual required (French + technical logs now; Arabic later)
3. Do you want chunk size constraints:
   - default: chunk by tokens with overlap

### C) SQL Server lookup tool

1. SQL Server connection details:
   - host
   - database name
   - auth type (username/pass or Windows auth)
2. For your error example:
   - which exact table contains the “article exists” data?
   - which columns contain:
     - article code
     - magasin / location / branch key
3. When the value is missing in the error text:
   - should Techo ask the user for the article code/magasin?
   - or do we derive it from surrounding logs?
4. Allowlist scope (start small):
   - first tables you want allowlisted (ARTICLE, MAGASIN, ITEM_LOCATION, etc.)

### D) Thread server-side truth (cross refresh/device)

1. Do you want:
   - local-only tabs (OK for now)
   - or server-saved threads so you can keep tabs across devices?

## Next coding order I recommend

If you confirm the direction for PDF library and indexing:

1. Implement “PDF Library UI + upload + list + details placeholder”
2. Implement extraction pipeline (Problem/Solution candidates + approval) ✅
3. Implement full-text RAG indexing (vector DB + retrieval)
4. Wire Techo chat to use RAG retrieved context
5. Then implement SQL Server tool-use “not found” workflow

## Decisions
- Vector DB choice: **Qdrant** (free, open-source, easy to run locally with Docker)

## Status
- Vector DB choice selected ✅
- PDF extraction pipeline + admin approval UI implemented ✅
- Qdrant + Ollama embeddings wiring for RAG (index/search + chat injection) ✅ (code implemented; requires Qdrant + embedding model running)

---
End of ToDo.md

