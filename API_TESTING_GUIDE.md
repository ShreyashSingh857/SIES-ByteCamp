# PolyglotDepMap – API Testing Guide

All backend endpoints are served at `http://localhost:5000/api`.  
The frontend dev server runs at `http://localhost:5173` (or `5174`).

---

## 1. Health Check
**`GET /api/health`**

```bash
curl http://localhost:5000/api/health
```
**Expected:**
```json
{ "status": "ok", "uptime": 12.3 }
```

---

## 2. Scan a Repository
**`POST /api/scan`**

Clones the repo, runs the AI Engine, and saves the graph to disk. Returns a `repoId` used for all subsequent calls.

```bash
curl -X POST http://localhost:5000/api/scan \
  -H "Content-Type: application/json" \
  -d '{ "repoUrl": "https://github.com/mde/ejs" }'
```
**Expected (✅ verified working):**
```json
{
  "success": true,
  "data": {
    "repoId": "ejs-1710400000000-abc123",
    "repoUrl": "https://github.com/mde/ejs",
    "graphApi": "/api/graph/ejs-1710400000000-abc123",
    "parserSummary": { "nodes": 42, "edges": 60 }
  }
}
```
> ⏱ This takes time — the AI Engine clones and parses the repo. Save the `repoId`.

---

## 3. Get Graph
**`GET /api/graph/:repoId`**

Returns the parsed nodes and edges from disk.

```bash
curl http://localhost:5000/api/graph/<repoId>
```
**Expected (✅ verified working):**
```json
{
  "success": true,
  "repoId": "ejs-1710400000000-abc123",
  "data": {
    "nodes": [{ "id": "file:src/ejs.js", "name": "ejs.js", "type": "FILE", "language": "JavaScript" }],
    "edges": [{ "source": "file:src/ejs.js", "target": "file:src/utils.js", "type": "IMPORTS" }],
    "summary": { "nodeCount": 42, "edgeCount": 60 }
  }
}
```

---

## 4. Seed Schema into Neo4j
**`POST /api/db/seed/schema`**

Creates Neo4j constraints and indexes. Run once before seeding graph data.

```bash
curl -X POST http://localhost:5000/api/db/seed/schema
```
**Expected (✅ verified working):**
```json
{ "success": true, "message": "Schema seed completed" }
```

---

## 5. Seed Graph into Neo4j
**`POST /api/db/seed/graph/:repoId`**

Seeds the saved parser output into Neo4j. Returns a `scanId` needed for impact and metrics.

```bash
curl -X POST http://localhost:5000/api/db/seed/graph/<repoId> \
  -H "Content-Type: application/json" \
  -d '{ "repoUrl": "https://github.com/mde/ejs" }'
```
**Expected (✅ verified working):**
```json
{
  "success": true,
  "message": "Graph seeded into Neo4j",
  "data": {
    "repoId": "ejs-1710400000000-abc123",
    "scanId": "scan-<uuid>",
    "fileCount": 12,
    "functionCount": 38,
    "dependencyCount": 60
  }
}
```
> Save the `scanId` for the next two requests.

---

## 6. Get Metrics
**`GET /api/metrics/:scanId`**

```bash
curl http://localhost:5000/api/metrics/<scanId>
```
**Expected:**
```json
{
  "success": true,
  "data": {
    "scanId": "scan-<uuid>",
    "totalServices": 1,
    "totalDependencies": 60
  }
}
```

---

## 7. Impact Analysis
**`GET /api/impact?node=<nodeIdentifier>&scanId=<scanId>`**

`node` can be a node `id`, `name`, `path`, `fieldName`, or `tableName`. `scanId` is optional but scopes results.

```bash
curl "http://localhost:5000/api/impact?node=ejs.js&scanId=<scanId>"
```
**Expected:**
```json
{
  "success": true,
  "data": {
    "node": "ejs.js",
    "scanId": "scan-<uuid>",
    "count": 5,
    "impactedNodes": [
      { "id": "file:scan-xxx:file:src/utils.js", "name": "utils.js", "type": "File", "hops": 1 },
      { "id": "file:scan-xxx:file:src/compile.js", "name": "compile.js", "type": "File", "hops": 2 }
    ]
  }
}
```
> Nodes with `hops: 1` = Direct Impact. `hops > 1` = Transitive Impact.

---

## 8. Delete Graph
**`DELETE /api/graph/:repoId`**

```bash
curl -X DELETE http://localhost:5000/api/graph/<repoId>
```
**Expected:**
```json
{ "success": true, "repoId": "...", "message": "Graph deleted successfully" }
```

---

## 9. Help Endpoints
```bash
curl http://localhost:5000/api/help
curl "http://localhost:5000/api/help/search?q=impact"
curl http://localhost:5000/api/help/<topicId>
```

---

## End-to-End Flow Summary

```
1. POST /api/scan           → get repoId
2. POST /api/db/seed/schema → setup Neo4j (once)
3. POST /api/db/seed/graph/:repoId → get scanId
4. GET  /api/graph/:repoId  → view graph in UI
5. GET  /api/impact?node=...&scanId=... → impact in UI
6. GET  /api/metrics/:scanId → dashboard stats
```

## Frontend Integration Map

| Frontend Component  | API Hook                       | Endpoint Called                        |
|---------------------|--------------------------------|----------------------------------------|
| `UploadRepo.jsx`    | `useScanRepoMutation`          | `POST /api/scan`                       |
| `UploadRepo.jsx`    | `useSeedGraphMutation`         | `POST /api/db/seed/graph/:repoId`      |
| `GraphView.jsx`     | `useGetGraphQuery(repoId)`     | `GET /api/graph/:repoId`               |
| `ImpactPanel.jsx`   | `useGetImpactAnalysisQuery`    | `GET /api/impact?node=...&scanId=...`  |
| `HelpPage.jsx`      | `useGetHelpTopicsQuery`        | `GET /api/help`                        |
| `HelpPage.jsx`      | `useSearchHelpQuery`           | `GET /api/help/search?q=...`           |
