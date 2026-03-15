# Polyglot — AI-Powered Dependency Intelligence

> **"Change one line of code. Know everything it breaks — before you push."**

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Node.js-Express%205-339933?style=flat&logo=node.js)](https://nodejs.org)
[![Neo4j](https://img.shields.io/badge/Neo4j-Graph%20DB-008CC1?style=flat&logo=neo4j)](https://neo4j.com)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4.1-412991?style=flat&logo=openai)](https://openai.com)
[![Tree-sitter](https://img.shields.io/badge/Tree--sitter-AST%20Parser-F05033?style=flat)](https://tree-sitter.github.io)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat)](LICENSE)

---

## What is Polyglot?

Modern software is polyglot. A single user action ripples through a React frontend, a Node.js API gateway, a Python data service, and a PostgreSQL schema — but traditional tools stop at the language boundary, leaving engineers blind to cross-service impact.

**Polyglot is the world's first AI-powered polyglot dependency mapping platform.** It scans your entire repository, builds a unified cross-language knowledge graph in Neo4j, and lets you trace the exact impact of any code change — across every service, API contract, and database field — before you commit.

---

## The Problem

| Pain Point | Reality |
|---|---|
| Hidden cross-language dependencies | A Python schema change silently breaks a React component three hops away |
| Manual impact analysis | Engineers spend hours reverse-engineering ripple effects of refactors |
| Siloed static analysis tools | ESLint, Pylint, SonarQube — all language-specific, all blind at service boundaries |
| Stale architecture diagrams | Documentation rots within weeks of the last refactor |
| Production incidents from blind merges | Every refactor is a gamble when you don't know who consumes your internal APIs |

---

## The Solution

Polyglot automates architectural discovery in five stages:

```
GitHub URL / Local ZIP
        ↓
  [AI-Engine] Tree-sitter AST Parsing
        ↓
  Dependency Graph Extraction
  (FILES, FUNCTIONS, API_ENDPOINTs, DATABASEs, MODULES)
        ↓
  [Neo4j] Graph Storage & BFS Traversal
        ↓
  [OpenAI GPT-4.1-mini] LLM Enrichment
  (API contract inference, implicit dependency detection)
        ↓
  [Cytoscape.js] Interactive Graph Visualization
        ↓
  Impact Panel — 6-hop ripple analysis in real time
```

---

## Key Features

### 🔍 Polyglot AST Analysis
Tree-sitter WASM parsers extract deep structure from JavaScript, TypeScript, Python, Java, Go, Rust, Ruby, C#, Kotlin, and PHP — all in a single pipeline. SQL files are parsed for table and column references.

### 🕸️ Unified Dependency Graph
All extracted entities are merged into a single Neo4j knowledge graph with typed relationships:
- `IMPORTS` / `CALLS` — static code dependencies
- `EXPOSES_API` / `CONSUMES_API` — HTTP route provider/consumer links
- `USES_TABLE` / `USES_FIELD` — database access patterns
- `EMITS_EVENT` / `LISTENS_EVENT` — event bus topology

### ⚡ Impact Simulator
Select any node in the graph — a function, a file, a database field — and instantly see every downstream node it affects up to 6 hops away, colour-coded by impact severity (direct → transitive).

### 🧠 AI-Powered Contract Inference
GPT-4.1-mini analyses route handlers and infers OpenAPI-style request/response contracts with confidence scores. Implicit runtime dependencies (environment variables, caches, external services) are surfaced without manual annotation.

### 📁 File Viewer with Live Dependencies
Browse any scanned file with full syntax highlighting. See which files import it and which it depends on, in real time, powered by Neo4j BFS queries.

### 🌙 Dark / Light Mode
Full theme support with a system-aware default. Every panel, graph, and code viewer respects the active theme.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│  React 19 · Redux Toolkit · RTK Query · Cytoscape.js        │
│  Framer Motion · Tailwind CSS · MUI · react-syntax-hl       │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST / JSON
┌──────────────────────────▼──────────────────────────────────┐
│                        BACKEND                              │
│  Express 5 · Node.js ESM · cookie-parser · CORS             │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │scan.controller│  │llm.service   │  │neo4j.queries     │  │
│  │  ↓ clone     │  │  ↓ OpenAI    │  │  ↓ BFS impact    │  │
│  │  ↓ AI-Engine │  │  ↓ infer     │  │  ↓ file relations│  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└──────┬────────────────────────────────────────┬─────────────┘
       │ child_process (execFile)               │ bolt://
┌──────▼───────────────┐            ┌───────────▼─────────────┐
│      AI-ENGINE       │            │         NEO4J            │
│  Node.js · CommonJS  │            │  Graph DB · Cypher BFS   │
│  Tree-sitter WASM    │            │  Constraints + Indexes   │
│  extractDependencies │            │  seedParsedGraph (MERGE) │
│  graphBuilder        │            │  getImpactedNodesByNode  │
│  runStaticAnalysis   │            └─────────────────────────┘
│  graphIntelligence   │
└──────────────────────┘
```

### Component Breakdown

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | React 19, Redux Toolkit, RTK Query | UI, state management, API calls |
| Graph Viz | Cytoscape.js | Interactive node-edge canvas |
| Animations | Framer Motion | Landing page, transitions |
| Backend | Express 5, Node.js (ESM) | REST API, orchestration |
| AI Engine | Tree-sitter WASM, Node.js (CJS) | AST parsing, dependency extraction |
| Graph DB | Neo4j 6, Cypher | Graph storage, BFS impact traversal |
| LLM | OpenAI GPT-4.1-mini | Contract inference, implicit dep detection |
| Deployment | Vercel (Frontend), configurable (Backend) | Hosting |

---

## Monorepo Structure

```
SIES-ByteCamp/
├── Frontend/                   # React 19 SPA
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Landing.jsx        # Marketing landing page
│   │   │   ├── UploadRepo.jsx     # GitHub URL + scan trigger
│   │   │   ├── Analyze.jsx        # Directory tree explorer
│   │   │   ├── GraphView.jsx      # Cytoscape.js graph canvas
│   │   │   ├── ImpactPanel.jsx    # BFS impact analysis UI
│   │   │   ├── FileViewerWithDependencies.jsx  # Code viewer
│   │   │   └── DirListView.jsx    # Directory listing
│   │   ├── store/
│   │   │   ├── slices/
│   │   │   │   ├── graphSlice.js  # Graph state + BFS compute
│   │   │   │   ├── apiSlice.js    # RTK Query endpoints
│   │   │   │   └── themeSlice.js  # Dark/light mode
│   │   └── components/
│   │       ├── ui/                # Landing page sections
│   │       └── layout/            # Header, Sidebar, Layout
│
├── Backend/                    # Express 5 API
│   ├── app.js                     # Middleware + routes
│   ├── src/
│   │   ├── controllers/
│   │   │   └── scan.controller.js # Core: clone → parse → seed
│   │   ├── services/
│   │   │   └── llm.service.js     # OpenAI integration
│   │   ├── db/
│   │   │   └── neo4j.queries.js   # Cypher queries
│   │   └── config/
│   │       └── neo4j.js           # Neo4j driver
│
├── AI-Engine/                  # Static analysis pipeline
│   ├── src/
│   │   ├── pipeline/
│   │   │   ├── scanRepository.js  # File discovery
│   │   │   ├── parseFiles.js      # Tree-sitter WASM loader
│   │   │   ├── extractDependencies.js  # AST → graph nodes/edges
│   │   │   ├── graphBuilder.js    # Deduplicating graph store
│   │   │   └── runStaticAnalysis.js    # Pipeline orchestrator
│   │   ├── llm/
│   │   │   └── graphIntelligence.js    # LLM graph enrichment
│   │   └── config/
│   │       └── languages.js       # Language → WASM mapping
│
└── workspace/
    ├── repositories/              # Cloned repos (gitignored)
    └── graphs/                    # Parsed graph JSON cache
```

---

## Getting Started

### Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18+ |
| Neo4j | 5+ (local or Aura cloud) |
| OpenAI API Key | GPT-4.1-mini access |

### 1. Clone the repository

```bash
git clone https://github.com/your-org/sies-bytecamp.git
cd sies-bytecamp
```

### 2. Configure the Backend

```bash
cd Backend
cp .env.example .env   # create this file — see variables below
npm install
npm run dev            # starts on :5000
```

**Backend environment variables:**

```env
PORT=5000
CLIENT_URL=http://localhost:5173
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
OPENAI_API_MODE=chat
```

### 3. Configure the AI-Engine

```bash
cd AI-Engine
cp .env.example .env
npm install
```

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
```

### 4. Configure the Frontend

```bash
cd Frontend
cp .env.example .env
npm install
npm run dev            # starts on :5173
```

```env
VITE_API_URL=http://localhost:5000/api
VITE_API_BASE_URL=http://localhost:5000/api
```

### 5. Seed the Neo4j Schema

Once the backend is running, hit this endpoint once to create constraints and indexes:

```bash
curl -X POST http://localhost:5000/api/db/seed/schema
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/scan` | Clone a GitHub repo and run AST analysis |
| `GET` | `/api/graph/:repoId` | Retrieve parsed graph (nodes + edges) |
| `DELETE` | `/api/graph/:repoId` | Remove stored graph |
| `POST` | `/api/db/seed/schema` | Create Neo4j constraints and indexes |
| `POST` | `/api/db/seed/graph/:repoId` | Seed parsed graph into Neo4j |
| `GET` | `/api/impact?node=...&scanId=...` | BFS impact analysis from a node |
| `GET` | `/api/impact/files?scanId=...&filePath=...` | Related files for a path |
| `POST` | `/api/analyze/dependencies` | Text-match dependency search |
| `POST` | `/api/analyze/dependencies-llm` | Full Neo4j + LLM dependency analysis |
| `GET` | `/api/metrics/:scanId` | Graph statistics |
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/help` | Help topics |

---

## User Flow

```
1. Landing Page      → Hero, problem statement, how-it-works
2. Sign Up / Login   → Auth (mock in v1, real in v2)
3. Upload Repo       → Paste GitHub URL, add to queue, hit "Scan & Build Graph"
4. Scan Progress     → Clone → AI-Engine parse → Neo4j seed
5. Analyze View      → Directory cards with file-tree previews
6. File Viewer       → Syntax-highlighted code + incoming/outgoing dependency panel
7. Graph View        → Full Cytoscape canvas, filter by node type/language
8. Select a Node     → Click any node → BFS impact highlighted in orange/yellow
9. Impact Panel      → Full list of direct + transitive affected nodes
10. LLM Analysis     → Select code text → get AI-powered dependency explanation
```

---

## Supported Languages

| Language | Parser | Import Extraction | Call Graph | API Detection | DB Detection |
|---|---|---|---|---|---|
| JavaScript / JSX | Tree-sitter WASM | ✅ | ✅ | ✅ (Express/Fastify) | ✅ |
| TypeScript / TSX | Tree-sitter WASM | ✅ | ✅ | ✅ | ✅ |
| Python | Tree-sitter WASM | ✅ | ✅ | ✅ (Flask/FastAPI) | ✅ |
| Java | Tree-sitter WASM | ✅ | ✅ | ✅ (Spring) | ✅ |
| SQL / PSQL | Regex extraction | — | — | — | ✅ (table/column) |

---

## Real Scan Results

Projects scanned during development and testing:

| Repository | Files Scanned | Nodes | Edges | Languages |
|---|---|---|---|---|
| sies-bytecamp (self) | 69 | 703 | 1,165 | JavaScript |
| Frontend-only (React) | ~50 | 576 | 1,038 | JavaScript |
| myBrowser (Java) | 6 | 41 | 37 | Java |
| GDG Project | 6 | 67 | 73 | JavaScript |

---

## What Makes This Different

| Tool | Cross-Language | AI Contracts | Graph Storage | Impact Sim | Live UI |
|---|---|---|---|---|---|
| ESLint / Pylint | ❌ | ❌ | ❌ | ❌ | ❌ |
| SonarQube | ❌ | ❌ | ❌ | ❌ | ❌ |
| Sourcegraph | Partial | ❌ | ❌ | ❌ | ✅ |
| CodeScene | Partial | ❌ | ❌ | Partial | ✅ |
| **Polyglot** | ✅ | ✅ | ✅ (Neo4j) | ✅ (6-hop BFS) | ✅ |

---

## Track

**GenAI Track — GA1**
Built for SIES ByteCamp 2026. Leverages OpenAI GPT-4.1-mini for LLM-powered contract inference and dependency intelligence. Tree-sitter provides the deterministic static analysis backbone. Neo4j powers the millisecond-speed graph traversal.

---

## Team

Built at SIES ByteCamp 2026 · Track GA1 · v1.0.4-STABLE

---

## License

MIT © 2026 Polyglot / Antigravity