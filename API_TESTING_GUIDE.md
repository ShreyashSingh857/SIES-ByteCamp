# PolyglotDepMap - End-to-End API Testing Guide

This document outlines how to manually test the fully integrated frontend, backend, and AI engine setup. All placeholder data has been replaced with live API endpoints connected directly to the backend and its child process (AI Engine).

## 1. Environment Setup

Ensure you have two terminal windows open:

**Backend Server:**
```bash
cd Backend
npm install
# Set NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD if testing database integration
npm run dev
```

**Frontend Server:**
```bash
cd Frontend
npm install
npm run dev
```
Open your browser to `http://localhost:5173` (or the port specified by Vite).

## 2. API Health & Help Module

1. **Dashboard Health Indicator**
   - Navigate to the Home Dashboard.
   - Look at the top right header: `API Status`. It should read `healthy` (green). If you shut down the backend server, it will poll and switch to `Offline` (red).
   - *Validates:* `GET /api/health` polling.

2. **Help Center**
   - From the Home Dashboard, click the **Help Center** quick action.
   - You should see all default help topics loaded from the backend.
   - Search for a specific word (e.g., `password`). The results should filter using the backend search query.
   - *Validates:* `GET /api/help` and `GET /api/help/search?q=keyword`.

## 3. End-to-End AI Engine Scanning & Graphing

To verify the core AI Engine works through the frontend seamlessly:

1. **Upload Repository**
   - Go to **Upload Repos** (`/upload`).
   - Paste a public Github URL, e.g., `https://github.com/expressjs/express`.
   - Click "Scan & Build Graph".
   - *Behavior:* The frontend sends a `POST /api/scan` to the backend. The backend clones the repository to `workspace/repositories/` and spawns the `AI-Engine`. The AI Engine parses the code, builds the JSON graph result, and outputs it to `stdout`. The Backend captures this data and stores it in memory.

2. **Verify Graph Rendering**
   - Upon successful scan, you will be redirected to the **Graph View** (`/graph`).
   - The frontend calls `GET /api/graph`.
   - *Behavior:* Cytoscape renderer should now draw the parsed nodes and dependency edges instead of the initial fallback dummy data.

## 4. Impact Simulation (BFS)

The Impact graph calculation is now fully powered by the backend API edge traversal.

1. **Simulate Impact**
   - Go to **Impact Sim** (`/impact`).
   - Ensure you scanned a repository first, as the API uses the in-memory graph data.
   - Click any highlighted origin node in the selection list.
   - *Behavior:* The frontend grabs the `node.id` and makes a call to `GET /api/impact?nodeId={id}`.
   - The Backend receives this ID, accesses the stored edges, runs a Breadth-First-Search (BFS), and returns exactly which modules are Directly and Transitively impacted.
   - The UI will render exactly what the backend API provided.

## 5. Console & Network Debugging

If anything fails, verify the following:

- **Frontend Network Tab (DevTools):** Ensure calls to `localhost:5000/api/...` return HTTP 200.
- **Backend Terminal:** Look out for outputs from the `AI-Engine` indicating parsing successes or errors. Look for Neo4j missing warnings unless you properly authenticated it.

---
*Happy Testing!*
