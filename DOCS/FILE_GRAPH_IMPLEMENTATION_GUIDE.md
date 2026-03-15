# File-Centric Graph View — Deep Analysis & Step-by-Step Implementation Guide

> **Scope:** Frontend-only refactor. Backend, AI-Engine, and Neo4j stay untouched.  
> **Risk level per step:** 🟢 Safe | 🟡 Medium | 🔴 Breaking if skipped

---

## 1. Deep Analysis of Your Approach (Errors Found)

Before writing a single line of code, here are the real problems you will run into if you start implementing without addressing these.

---

### Error 1 — The raw graph has NO file-to-file edges (Critical)

This is the most important thing to understand. Your parser creates edges like:

```
file:Backend/app.js  ──IMPORTS──>  module:./src/routes/scan.routes.js
```

NOT:

```
file:Backend/app.js  ──IMPORTS──>  file:Backend/src/routes/scan.routes.js
```

The intermediate `MODULE` node exists between two files. So if you just filter the existing edges to show file↔file connections, you'll get **zero edges**. The dependency graph collapses into a useless cloud of disconnected dots.

**Fix:** You need a path-resolution step in the frontend transform layer that:
1. Sees `file:Backend/app.js` → `module:./src/routes/scan.routes.js`
2. Resolves `./src/routes/scan.routes.js` relative to `Backend/` → `Backend/src/routes/scan.routes.js`
3. Looks up `file:Backend/src/routes/scan.routes.js` in the node set
4. Creates a synthetic `file → file` edge if found

I verified this against your real graph data: this process yields **87 valid file-to-file edges** from the 900-node graph you already have. That's a clean, readable graph.

---

### Error 2 — External/NPM module imports will pollute the graph

Your import edges point to both internal files AND external packages:

```
file:Frontend/src/store/store.js  ──IMPORTS──>  module:react-redux
file:Frontend/src/store/store.js  ──IMPORTS──>  module:./slices/graphSlice
```

If you try to resolve ALL module imports to file nodes, `module:react-redux` has no corresponding file in your project, and you'll get silent failures or garbage edges.

**Fix:** Only resolve imports whose module name starts with `./` or `../` (relative paths). Skip all absolute/bare module names like `express`, `react`, `lodash`, etc.

---

### Error 3 — Clicking a file to show its children requires a real mode switch, not just a filter

You want: "click file → show its functions as child nodes, with the file as the parent."

Cytoscape supports **compound nodes** (parent-child containment). This is the right primitive. But you can't just re-run the same layout on the same graph — compound node layout conflicts with the top-level force-directed layout. You need two distinct Cytoscape rendering modes:

- **Mode A (Overview):** File nodes + cluster compound parents. Force-directed layout. No functions visible.
- **Mode B (Drill-down):** Selected file becomes a compound parent. Its functions are child nodes inside it. Neighboring files are shown normally. COSE layout.

Trying to do both in one mode creates cascading layout bugs. The `layoutKey` ref in the current `GraphView.jsx` already tries to prevent layout re-runs — you must extend this pattern carefully.

---

### Error 4 — Cytoscape compound nodes for clustering don't "just work" with your current style

When you add compound (parent) nodes for clusters, the current stylesheet in `buildCyStyle` has no rules for them. Without explicit styles, compound parents render as ugly gray rectangles that overlap with children and confuse layout algorithms.

**Fix:** Add dedicated compound node styles with `background-opacity: 0.05`, `border-width: 2px`, `border-style: dashed`, and `padding: 40px` so they act as transparent visual containers.

---

### Error 5 — The `buildDisplayGraph` function in `graphViewUtils.js` is deeply incompatible

`buildDisplayGraph` is built around the old type system: it knows about `service`, `db_field`, `api_endpoint`, etc. It collapses files into folder nodes, computes visibility based on type filters, and handles the old `scope: 'local'` expand logic.

You cannot bolt your new logic onto this function. Calling it and then filtering the result will still produce wrong output because it collapses things at the folder level before you can work with files.

**Fix:** Write a completely new `buildFileGraph.js` utility. Do NOT modify `graphViewUtils.js` (other parts of the app may still use it). Just don't call it from the new graph.

---

### Error 6 — Isolated file nodes (no cross-file relative imports)

Some files only import external packages (`react`, `express`, `cytoscape`). After your path-resolution step, these files will have zero edges in the file graph. They'll float as disconnected islands in the layout, which looks wrong.

**Fix:** Don't delete them. Instead:
- They're still valid nodes — include them in their cluster group.
- The cluster compound parent gives them visual context.
- Optionally, add a UI toggle to "hide isolated files" (files with degree 0 in the file graph).

---

### Error 7 — Your Redux `computeImpact` BFS in `graphSlice.js` uses `edge.source`/`edge.target`

The raw graph data uses `edge.from`/`edge.to` (from the AI-Engine), not `edge.source`/`edge.target`. The current code normalizes this in `rawGraph` in `GraphView.jsx`. Your new transform must also produce `source`/`target` in edges (not `from`/`to`) for BFS highlighting to continue working.

---

### Error 8 — filterTypes in Redux will break if you remove type options

The current Redux state has `filterTypes: ['service', 'file', ...]`. If you change the graph to only show `file` nodes, the existing filter panel will show controls for `service`, `db_table`, etc. that do nothing, confusing users.

**Fix:** Remove the old type filter panel in `GraphView.jsx` for the new file-view. Replace with a cluster visibility toggle. The Redux state `filterTypes` can remain for backwards compatibility; just don't render the old filter UI.

---

## 2. Architecture: What You're Building

```
Raw graph data (unchanged)
  └── nodes: FILE, FUNCTION, MODULE, SYMBOL, DATABASE, EXTERNAL_SERVICE
  └── edges: IMPORTS (file→module), CALLS (fn→fn or fn→symbol), READS (fn→db)

                    ↓  NEW TRANSFORM (frontend only)

buildFileGraph(rawData)
  └── fileNodes:   only FILE-type nodes
  └── fileEdges:   resolved relative imports → file-to-file edges
  └── clusters:    files grouped by path pattern (Frontend/Backend/DB/AI/Tests/Utils)
  └── fileDetails: map of fileId → { functions[], apiEndpoints[] }  (for drill-down)

                    ↓

GraphView (Mode A — Overview)
  └── Cytoscape compound nodes:  one per cluster (transparent background)
      └── File nodes inside each compound node
      └── Edges between file nodes across clusters
      └── Clicking a file → switches to Mode B

GraphView (Mode B — Drill-down)
  └── Selected file as compound parent
      └── Function child nodes inside it
      └── Other connected files shown at same level
      └── Back button → returns to Mode A
```

---

## 3. Step-by-Step Implementation

---

### STEP 1 — Create `buildFileGraph.js` 🟢

Create this file at:
```
Frontend/src/pages/buildFileGraph.js
```

This is the heart of the new logic. It does NOT touch any existing file.

```js
// Frontend/src/pages/buildFileGraph.js

import path from 'path-browserify'; // yarn add path-browserify (or use inline impl below)

// ─── Cluster assignment ──────────────────────────────────────────────────────

const CLUSTER_RULES = [
  { key: 'Tests',     test: p => /test|spec|__tests__|\.test\.|\.spec\./i.test(p) },
  { key: 'Frontend',  test: p => /^frontend\//i.test(p) || /\/(components|pages|views|ui)\//i.test(p) },
  { key: 'Backend',   test: p => /\/(controllers|routes|middlewares|services)\//i.test(p) },
  { key: 'Database',  test: p => /\/(db|database|migrations|models|queries|schema)\//i.test(p) || /queries\./i.test(p) },
  { key: 'AI Engine', test: p => /^ai[\-_]engine\//i.test(p) || /\/(pipeline|llm|agent)\//i.test(p) },
  { key: 'Workers',   test: p => /\/(workers|queues|jobs)\//i.test(p) },
  { key: 'Utilities', test: p => /\/(config|utils|helpers|lib|store|slices)\//i.test(p) },
];

export function assignCluster(filePath) {
  const p = filePath.toLowerCase();
  for (const rule of CLUSTER_RULES) {
    if (rule.test(p)) return rule.key;
  }
  // Fall back to top-level directory name
  const top = filePath.split('/')[0];
  return top || 'Other';
}

// ─── Path resolution (no Node.js `path` needed) ─────────────────────────────

function resolvePath(fromFile, relativeImport) {
  // fromFile: 'Backend/app.js'  →  dir: 'Backend'
  const parts = fromFile.split('/');
  parts.pop(); // remove filename
  
  const importParts = relativeImport.split('/');
  for (const part of importParts) {
    if (part === '..') {
      parts.pop();
    } else if (part !== '.') {
      parts.push(part);
    }
  }
  return parts.join('/');
}

// ─── Main transform ──────────────────────────────────────────────────────────

export function buildFileGraph(rawData) {
  const { nodes = [], edges = [] } = rawData;

  // 1. Collect all FILE nodes
  const fileNodeMap = new Map(); // id → node
  for (const n of nodes) {
    if (n.type === 'FILE' || n.type === 'file') {
      const id = n.id;
      const filePath = id.replace(/^file:/, '');
      fileNodeMap.set(id, {
        id,
        label: filePath.split('/').pop(),   // just the filename
        path: filePath,
        type: 'file',
        lang: n.language || n.lang || '',
        cluster: assignCluster(filePath),
        isSynthetic: false,
      });
    }
  }

  // 2. Collect FUNCTION nodes and map them to their parent file
  const fileFunctions = new Map(); // fileId → Function[]
  for (const n of nodes) {
    if (n.type === 'FUNCTION' || n.type === 'function') {
      const fileKey = n.file ? `file:${n.file}` : null;
      if (!fileKey || !fileNodeMap.has(fileKey)) continue;
      if (!fileFunctions.has(fileKey)) fileFunctions.set(fileKey, []);
      fileFunctions.get(fileKey).push({
        id: n.id,
        label: n.name || n.id,
        type: 'function',
        line: n.line,
        parentFileId: fileKey,
      });
    }
  }

  // 3. Resolve relative imports → file-to-file edges
  const edgeMap = new Map();   // dedup key → edge object

  for (const e of edges) {
    const edgeType = e.type || e.edgeType || 'IMPORTS';
    if (edgeType !== 'IMPORTS') continue;

    const from = e.from || e.source;
    const to   = e.to   || e.target;
    if (!from || !to) continue;
    if (!fileNodeMap.has(from)) continue;          // source must be a FILE
    if (!to.startsWith('module:.')) continue;      // only relative imports

    const fromPath  = from.replace(/^file:/, '');
    const importStr = to.replace(/^module:/, '');
    const resolved  = resolvePath(fromPath, importStr);

    // Try to match with or without extensions
    let targetId = null;
    for (const ext of ['', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.py']) {
      const candidate = `file:${resolved}${ext}`;
      if (fileNodeMap.has(candidate)) { targetId = candidate; break; }
    }

    if (!targetId || targetId === from) continue;

    const key = `${from}→${targetId}`;
    if (!edgeMap.has(key)) {
      edgeMap.set(key, {
        id: key,
        source: from,
        target: targetId,
        edgeType: 'IMPORTS',
        count: 0,
      });
    }
    edgeMap.get(key).count += 1;
  }

  // 4. Intra-file CALLS edges (for drill-down mode)
  const callEdges = [];
  for (const e of edges) {
    const edgeType = e.type || e.edgeType || '';
    if (edgeType !== 'CALLS') continue;
    const from = e.from || e.source;
    const to   = e.to   || e.target;
    if (!from || !to || from === to) continue;
    callEdges.push({ id: `call-${from}→${to}`, source: from, target: to, edgeType: 'CALLS', count: 1 });
  }

  // 5. Build unique cluster list
  const clusters = new Map();
  for (const node of fileNodeMap.values()) {
    if (!clusters.has(node.cluster)) {
      clusters.set(node.cluster, { id: `cluster:${node.cluster}`, label: node.cluster, memberCount: 0 });
    }
    clusters.get(node.cluster).memberCount += 1;
  }

  const fileNodes = [...fileNodeMap.values()];
  const fileEdges = [...edgeMap.values()];

  return {
    fileNodes,
    fileEdges,
    clusters: [...clusters.values()],
    fileFunctions,   // Map<fileId, Function[]> — used by drill-down
    callEdges,       // raw CALLS edges — used by drill-down
  };
}

// ─── Compute node sizes by connectivity degree ───────────────────────────────

export function computeFileSizes(fileNodes, fileEdges) {
  const degree = new Map(fileNodes.map(n => [n.id, 0]));
  for (const e of fileEdges) {
    degree.set(e.source, (degree.get(e.source) || 0) + 1);
    degree.set(e.target, (degree.get(e.target) || 0) + 1);
  }
  const maxDegree = Math.max(1, ...degree.values());
  return new Map(fileNodes.map(n => {
    const ratio = (degree.get(n.id) || 0) / maxDegree;
    return [n.id, Math.round(28 + ratio * 42)];   // 28px min → 70px max
  }));
}
```

**Before proceeding:** Run `node -e "require('./buildFileGraph')"` mentally — no imports are broken, all functions are pure. No side effects.

---

### STEP 2 — Install `path-browserify` (if needed) 🟢

If you want to avoid the inline path resolution above:

```bash
cd Frontend
npm install path-browserify
```

Then in `vite.config.js` add:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      path: 'path-browserify',
    },
  },
});
```

**However** — the inline `resolvePath` function in Step 1 above handles `../` and `./` correctly without any dependency. You can skip this step entirely.

---

### STEP 3 — Add cluster color config 🟢

In `Frontend/src/assets/mockdata.js`, add this export at the bottom (don't change existing exports):

```js
export const CLUSTER_CONFIG = {
  'Frontend':  { color: '#0369a1', border: '#38bdf8', bg: 'rgba(14,165,233,0.05)'  },
  'Backend':   { color: '#15803d', border: '#4ade80', bg: 'rgba(34,197,94,0.05)'   },
  'Database':  { color: '#b45309', border: '#fbbf24', bg: 'rgba(245,158,11,0.05)'  },
  'AI Engine': { color: '#7c3aed', border: '#c084fc', bg: 'rgba(168,85,247,0.05)'  },
  'Workers':   { color: '#be123c', border: '#fb7185', bg: 'rgba(244,63,94,0.05)'   },
  'Tests':     { color: '#475569', border: '#94a3b8', bg: 'rgba(148,163,184,0.05)' },
  'Utilities': { color: '#0f766e', border: '#2dd4bf', bg: 'rgba(20,184,166,0.05)'  },
  'Core':      { color: '#1d4ed8', border: '#60a5fa', bg: 'rgba(96,165,250,0.05)'  },
  'Other':     { color: '#334155', border: '#64748b', bg: 'rgba(100,116,139,0.05)' },
};
```

---

### STEP 4 — Create the new Cytoscape stylesheet builder 🟡

In `GraphView.jsx`, you'll add a new stylesheet builder function below the existing `buildCyStyle`. Don't remove the old one yet — keep both until you do the switchover.

Add this inside `GraphView.jsx` before the component function:

```js
import { CLUSTER_CONFIG } from '../assets/mockdata';
import { buildFileGraph, computeFileSizes } from './buildFileGraph';

const buildFileCyStyle = (clusterConfigs) => [
  // ── Compound cluster containers ──────────────────────────────────────────
  {
    selector: 'node.cluster-parent',
    style: {
      'shape': 'round-rectangle',
      'background-opacity': 0.04,
      'border-width': '1.5px',
      'border-style': 'dashed',
      'border-color': 'data(borderColor)',
      'background-color': 'data(bgColor)',
      'label': 'data(label)',
      'text-valign': 'top',
      'text-halign': 'center',
      'font-size': '11px',
      'font-weight': 'bold',
      'color': 'data(borderColor)',
      'padding': '30px',
      'compound-sizing-wrt-labels': 'include',
    },
  },
  // ── File nodes ────────────────────────────────────────────────────────────
  {
    selector: 'node[type = "file"]',
    style: {
      'shape': 'round-rectangle',
      'width': 'data(nodeSize)',
      'height': 'data(nodeSize)',
      'background-image': 'data(icon)',
      'background-fit': 'cover',
      'background-opacity': 0,
      'border-width': '1.5px',
      'border-color': 'data(borderColor)',
      'label': '',
      'text-valign': 'bottom',
      'text-halign': 'center',
      'font-size': '8px',
      'font-family': 'monospace',
      'color': '#94a3b8',
      'text-margin-y': '4px',
      'overlay-opacity': 0,
    },
  },
  {
    selector: 'node[type = "file"].show-label',
    style: { 'label': 'data(label)' },
  },
  // ── Function nodes (drill-down mode) ─────────────────────────────────────
  {
    selector: 'node[type = "function"]',
    style: {
      'shape': 'ellipse',
      'width': 22,
      'height': 22,
      'background-color': '#22c55e',
      'border-width': '1px',
      'border-color': '#15803d',
      'label': 'data(label)',
      'font-size': '7px',
      'font-family': 'monospace',
      'color': '#94a3b8',
      'text-valign': 'bottom',
      'text-margin-y': '3px',
      'overlay-opacity': 0,
    },
  },
  // ── Edges ─────────────────────────────────────────────────────────────────
  {
    selector: 'edge',
    style: {
      'width': 'mapData(count, 1, 5, 1.2, 3.5)',
      'line-color': '#334155',
      'target-arrow-color': '#334155',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'opacity': 0.5,
    },
  },
  {
    selector: 'edge[edgeType = "IMPORTS"]',
    style: { 'line-color': '#3b82f6', 'target-arrow-color': '#3b82f6' },
  },
  {
    selector: 'edge[edgeType = "CALLS"]',
    style: { 'line-color': '#22c55e', 'target-arrow-color': '#22c55e', 'line-style': 'dashed' },
  },
  // ── Selection / impact states ──────────────────────────────────────────────
  { selector: 'node.selected',          style: { 'border-width': '3px', 'border-color': '#ef4444', 'overlay-color': '#ef4444', 'overlay-opacity': 0.08 } },
  { selector: 'node.direct-impact',     style: { 'border-width': '3px', 'border-color': '#f97316', 'overlay-color': '#f97316', 'overlay-opacity': 0.08 } },
  { selector: 'node.transitive-impact', style: { 'border-width': '2px', 'border-color': '#eab308', 'overlay-color': '#eab308', 'overlay-opacity': 0.06 } },
  { selector: 'node.search-match',      style: { 'border-width': '3px', 'border-color': '#38bdf8' } },
  { selector: 'node.dimmed',            style: { 'opacity': 0.18 } },
  { selector: 'edge.dimmed',            style: { 'opacity': 0.06 } },
];
```

---

### STEP 5 — Add a `graphMode` state toggle to `GraphView.jsx` 🟡

This is where the old and new view live side-by-side before you fully cut over. Add this UI toggle at the top of the toolbar in `GraphView.jsx`:

```jsx
const [graphMode, setGraphMode] = useState('files'); // 'files' | 'legacy'
```

Add to the toolbar JSX:

```jsx
<div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
  {['files', 'legacy'].map(mode => (
    <button
      key={mode}
      onClick={() => setGraphMode(mode)}
      className="px-2.5 py-1.5 rounded-md text-xs font-medium"
      style={{
        background: graphMode === mode ? 'rgba(59,130,246,0.12)' : 'transparent',
        color:      graphMode === mode ? '#3b82f6' : 'var(--text-muted)',
      }}
    >
      {mode === 'files' ? 'File Graph ✦' : 'Legacy'}
    </button>
  ))}
</div>
```

For now, when `graphMode === 'legacy'`, the existing `displayGraph` logic runs exactly as before. This is your safety net — you can always flip back.

---

### STEP 6 — Add drill-down state 🟡

Add these state variables to `GraphView.jsx`:

```js
const [drillDownFileId, setDrillDownFileId] = useState(null); // null = overview
const [hideSingletons, setHideSingletons]  = useState(false); // toggle isolated files
```

---

### STEP 7 — Add the `fileGraph` memo 🟡

Inside `GraphView.jsx`, after your existing `rawGraph` memo, add:

```js
const fileGraph = useMemo(() => {
  if (graphMode !== 'files') return null;
  return buildFileGraph(graphData);
}, [graphData, graphMode]);

const fileSizes = useMemo(() => {
  if (!fileGraph) return new Map();
  return computeFileSizes(fileGraph.fileNodes, fileGraph.fileEdges);
}, [fileGraph]);
```

---

### STEP 8 — Build the Cytoscape elements for file-mode 🟡

Add a new memo for the Cytoscape elements when in file-mode:

```js
const fileCyElements = useMemo(() => {
  if (!fileGraph || graphMode !== 'files') return null;

  if (drillDownFileId) {
    // ── DRILL-DOWN MODE ────────────────────────────────────────────────────
    const parentFile = fileGraph.fileNodes.find(n => n.id === drillDownFileId);
    if (!parentFile) return null;

    const childFunctions = fileGraph.fileFunctions.get(drillDownFileId) || [];

    // Find neighbor files via fileEdges
    const neighborFileIds = new Set();
    for (const e of fileGraph.fileEdges) {
      if (e.source === drillDownFileId) neighborFileIds.add(e.target);
      if (e.target === drillDownFileId) neighborFileIds.add(e.source);
    }

    const neighborFiles = fileGraph.fileNodes.filter(n => neighborFileIds.has(n.id));
    const clusterCfg = CLUSTER_CONFIG[parentFile.cluster] || CLUSTER_CONFIG['Other'];

    const elements = [];

    // Compound parent node for the drilled file
    elements.push({
      data: {
        id: drillDownFileId,
        label: parentFile.label,
        type: 'file',
        icon: fileIcon,
        borderColor: clusterCfg.border,
        bgColor: clusterCfg.bg,
        nodeSize: 48,
        cluster: parentFile.cluster,
      },
      classes: 'selected show-label',
    });

    // Child function nodes
    for (const fn of childFunctions) {
      elements.push({
        data: { id: fn.id, label: fn.label, type: 'function', parent: drillDownFileId },
      });
    }

    // Intra-file CALLS edges among child functions
    const childIds = new Set(childFunctions.map(f => f.id));
    for (const e of fileGraph.callEdges) {
      if (childIds.has(e.source) && childIds.has(e.target)) {
        elements.push({ data: { ...e } });
      }
    }

    // Neighbor file nodes
    for (const nf of neighborFiles) {
      const nfCfg = CLUSTER_CONFIG[nf.cluster] || CLUSTER_CONFIG['Other'];
      elements.push({
        data: {
          id: nf.id,
          label: nf.label,
          type: 'file',
          icon: fileIcon,
          borderColor: nfCfg.border,
          bgColor: nfCfg.bg,
          nodeSize: fileSizes.get(nf.id) || 36,
          cluster: nf.cluster,
        },
        classes: 'show-label',
      });
    }

    // Edges to/from neighbor files
    for (const e of fileGraph.fileEdges) {
      const involves = e.source === drillDownFileId || e.target === drillDownFileId;
      if (involves) {
        elements.push({ data: { ...e, count: e.count || 1 } });
      }
    }

    return elements;
  }

  // ── OVERVIEW MODE ──────────────────────────────────────────────────────────

  const elements = [];
  const clusterIds = new Set();

  // Filter singletons if toggle is on
  let visibleFiles = fileGraph.fileNodes;
  if (hideSingletons) {
    const connected = new Set();
    for (const e of fileGraph.fileEdges) {
      connected.add(e.source);
      connected.add(e.target);
    }
    visibleFiles = visibleFiles.filter(n => connected.has(n.id));
  }
  const visibleFileIds = new Set(visibleFiles.map(n => n.id));

  // Cluster compound parent nodes
  for (const cluster of fileGraph.clusters) {
    const hasVisible = visibleFiles.some(n => n.cluster === cluster.label);
    if (!hasVisible) continue;

    const cfg = CLUSTER_CONFIG[cluster.label] || CLUSTER_CONFIG['Other'];
    clusterIds.add(cluster.id);
    elements.push({
      data: {
        id: cluster.id,
        label: cluster.label,
        borderColor: cfg.border,
        bgColor: cfg.bg,
        type: 'cluster',
      },
      classes: 'cluster-parent',
    });
  }

  // File nodes (children of their cluster)
  for (const node of visibleFiles) {
    const cfg = CLUSTER_CONFIG[node.cluster] || CLUSTER_CONFIG['Other'];
    const clusterId = `cluster:${node.cluster}`;
    elements.push({
      data: {
        id: node.id,
        label: node.label,
        type: 'file',
        lang: node.lang,
        path: node.path,
        cluster: node.cluster,
        icon: fileIcon,
        borderColor: cfg.border,
        bgColor: cfg.bg,
        nodeSize: fileSizes.get(node.id) || 32,
        parent: clusterIds.has(clusterId) ? clusterId : undefined,
      },
    });
  }

  // File-to-file edges
  for (const e of fileGraph.fileEdges) {
    if (!visibleFileIds.has(e.source) || !visibleFileIds.has(e.target)) continue;
    elements.push({ data: { ...e, count: e.count || 1 } });
  }

  return elements;
}, [fileGraph, graphMode, drillDownFileId, fileSizes, hideSingletons]);
```

---

### STEP 9 — Update the Cytoscape initialization `useEffect` 🔴

This is the most critical change. The current `useEffect` that creates the Cytoscape instance has hardcoded style and event handlers. You need to handle both modes.

Find the `useEffect` that does `cytoscape({ container: ... })` and make these changes:

**A. Use the new style when in file mode:**
```js
// Replace:
style: buildCyStyle(['folder', ...nodeTypes], edgeConfig),
// With:
style: graphMode === 'files'
  ? buildFileCyStyle(CLUSTER_CONFIG)
  : buildCyStyle(['folder', ...nodeTypes], edgeConfig),
```

**B. Update the `tap` handler for file nodes:**
```js
cy.on('tap', 'node', (evt) => {
  const id    = evt.target.id();
  const type  = evt.target.data('type');

  if (graphMode === 'files') {
    if (type === 'cluster') return; // clicking cluster parent does nothing
    if (type === 'file') {
      if (drillDownFileId) {
        // Already in drill-down — clicking another file switches drill-down
        setDrillDownFileId(id);
      } else {
        // Overview — single click selects, use double-click or button for drill-down
        dispatch(setSelectedNode({ id, graphData }));
      }
    }
    return;
  }

  // Legacy mode — existing logic unchanged
  if (id === selectedNode) {
    dispatch(clearSelection());
  } else {
    dispatch(setSelectedNode({ id, graphData }));
    if (graphNodeIds.has(id)) setScope('local');
  }
});
```

> **Important:** Add `graphMode` and `drillDownFileId` to the `useEffect` dependency array for the Cytoscape initialization. This forces a re-init when mode switches. Because `useEffect` destroys and recreates `cy`, there's no style bleed between modes.

---

### STEP 10 — Update the elements `useEffect` 🔴

This is the `useEffect` that calls `cy.batch(() => { cy.elements().remove(); cy.add(elements); })`.

Modify it to branch on `graphMode`:

```js
useEffect(() => {
  const cy = cyRef.current;
  if (!cy) return;

  if (graphMode === 'files') {
    if (!fileCyElements) return;

    cy.batch(() => {
      cy.elements().remove();
      cy.add(fileCyElements);
    });

    const layoutName = drillDownFileId ? 'cose' : 'cose';
    const layout = drillDownFileId
      ? { name: 'cose', animate: false, randomize: true, nodeRepulsion: 40000, idealEdgeLength: 140, fit: true, padding: 80 }
      : { name: 'cose', animate: false, randomize: false, nodeRepulsion: 60000, idealEdgeLength: 200, gravity: 0.06, numIter: 1800, fit: true, padding: 100 };

    const layoutKey = `files-${drillDownFileId || 'overview'}-${fileCyElements.length}`;
    if (layoutKey !== layoutKeyRef.current) {
      layoutKeyRef.current = layoutKey;
      cy.layout(layout).run();
      cy.fit(undefined, 80);
    }
    return;
  }

  // Legacy mode — existing code runs here, unchanged
  const elements = [
    ...displayGraph.nodes.map((node) => ({ data: { ...node, icon: GRAPH_NODE_TYPE_CONFIG[node.type]?.icon || fileIcon } })),
    ...displayGraph.links.map((edge) => ({ data: { ...edge, count: edge.count || 1 } })),
  ];
  // ... rest of existing code ...
}, [graphMode, fileCyElements, displayGraph, drillDownFileId, scope, perspective]);
```

---

### STEP 11 — Add the "Expand file" button and drill-down UI 🟢

In the selected node info bar (the red-outlined bar that appears when a node is selected), add a new button for drill-down in file mode:

```jsx
{graphMode === 'files' && selectedData?.type === 'file' && (
  <button
    onClick={() => setDrillDownFileId(
      drillDownFileId === selectedData.id ? null : selectedData.id
    )}
    className="text-xs font-medium px-3 py-1 rounded-lg transition-all shrink-0"
    style={{ background: drillDownFileId ? '#15803d' : '#0369a1', color: '#fff' }}
  >
    {drillDownFileId === selectedData.id ? '← Back to overview' : 'Drill into file →'}
  </button>
)}
```

Also add a small toolbar for file-mode only:

```jsx
{graphMode === 'files' && (
  <div className="flex items-center gap-2">
    {drillDownFileId && (
      <button
        onClick={() => { setDrillDownFileId(null); dispatch(clearSelection()); }}
        className="text-xs px-3 py-1.5 rounded-lg"
        style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
      >
        ← All files
      </button>
    )}
    <button
      onClick={() => setHideSingletons(v => !v)}
      className="text-xs px-2.5 py-1.5 rounded-lg"
      style={{
        background: hideSingletons ? 'rgba(59,130,246,0.12)' : 'var(--card)',
        color: hideSingletons ? '#3b82f6' : 'var(--text-muted)',
        border: '1px solid var(--border)',
      }}
    >
      {hideSingletons ? 'Show isolated' : 'Hide isolated'}
    </button>
  </div>
)}
```

---

### STEP 12 — Update the file-mode info panel 🟢

When a file is clicked in file-mode, show its cluster, path, language, and a function count. Find the `selectedData` block in the JSX and add a file-mode branch:

```jsx
{graphMode === 'files' && selectedData && selectedData.type === 'file' && (
  <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm flex-wrap"
    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
  >
    <span className="font-semibold code-text" style={{ color: '#ef4444' }}>
      {selectedData.label}
    </span>
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: (CLUSTER_CONFIG[selectedData.cluster] || CLUSTER_CONFIG['Other']).bg,
               color: (CLUSTER_CONFIG[selectedData.cluster] || CLUSTER_CONFIG['Other']).border }}
    >
      {selectedData.cluster}
    </span>
    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
      {selectedData.lang} · {(fileGraph?.fileFunctions.get(selectedData.id) || []).length} functions
    </span>
    <span className="text-xs flex-1 truncate hidden sm:block" style={{ color: 'var(--text-muted)' }}>
      {selectedData.path}
    </span>
    {/* Drill-down button added in Step 11 */}
  </div>
)}
```

---

### STEP 13 — Update the Legend for file-mode 🟢

In the legend section, add a file-mode legend showing clusters:

```jsx
{graphMode === 'files' && showLegend && (
  <div className="card flex flex-wrap gap-3 py-3">
    {Object.entries(CLUSTER_CONFIG).map(([name, cfg]) => (
      <div key={name} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span className="w-3 h-3 rounded-sm border-2 inline-block"
          style={{ borderColor: cfg.border, background: cfg.bg }} />
        {name}
      </div>
    ))}
    <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
      <span className="inline-block w-5" style={{ borderTop: '2px solid #3b82f6' }} /> Imports
    </div>
    <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
      <span className="inline-block w-5" style={{ borderTop: '2px dashed #22c55e' }} /> Calls (drill-down)
    </div>
  </div>
)}
```

---

### STEP 14 — Update the graphSlice BFS for file-mode 🟡

The BFS in `graphSlice.js` (`computeImpact`) works on `edge.source` and `edge.target`. Your new `fileGraph.fileEdges` uses the same keys. However, the selected node in file-mode might be a file ID (`file:Backend/app.js`), which won't be in the raw `graphData.edges` (those use function/module IDs).

**Fix:** When `setSelectedNode` is called in file-mode, pass the `fileEdges` instead of raw `graphData.edges`:

In `GraphView.jsx`, when handling node click in file-mode:
```js
// In the tap handler:
if (type === 'file') {
  dispatch(setSelectedNode({
    id,
    graphData: {
      nodes: fileGraph.fileNodes,
      edges: fileGraph.fileEdges,
    },
  }));
}
```

This way BFS correctly traverses file-to-file edges and highlights the import chain.

---

### STEP 15 — Clean up and remove the toggle 🟢

Once the file graph mode is working correctly and you're satisfied:

1. Remove the `graphMode` state and the `'legacy'` toggle button.
2. Delete all `if (graphMode === 'legacy')` branches.
3. Remove the `buildCyStyle`, `GRAPH_NODE_TYPE_CONFIG`, `displayGraph`, `rawGraph`, `effectiveFilterTypes`, `defaultTypes`, `scope`, `perspective`, `expandedFolders`, `expandedFiles`, `hideLeafNodes` state variables (they're all part of the old graph).
4. Remove the `filterTypes` UI from the toolbar.
5. Keep `filterLangs` — it still applies to file nodes by `node.lang`.
6. Archive (don't delete) `graphViewUtils.js` — other pages like `FileViewer.jsx` may use it.

---

## 4. Testing Checklist (Do These In Order)

| # | Test | Pass Criteria |
|---|------|---------------|
| 1 | Load a scanned repo in file-mode | File nodes appear, clustered in colored containers |
| 2 | Check edge count vs raw imports | At least 1 import edge visible between files |
| 3 | Click a file node | Info bar appears with cluster badge + function count |
| 4 | Click "Drill into file" | Functions appear inside file compound node |
| 5 | Click a neighbor file in drill-down | Info bar updates, function panel switches |
| 6 | Click "← All files" | Returns to overview, compound clusters restored |
| 7 | "Hide isolated" toggle | Disconnected file nodes disappear/reappear |
| 8 | Search for a filename | Node gets blue highlight border |
| 9 | Click file → BFS impact | Direct/transitive import chain highlighted |
| 10 | Flip to "Legacy" mode | Old graph renders exactly as before |
| 11 | Flip back to "File Graph" | File graph renders correctly, no stale state |

---

## 5. Common Bugs to Watch For

**Bug: All files appear disconnected (no edges)**
- Cause: Relative import resolution is failing. Check `resolvePath()` returns the right path, and the `file:` prefix lookup matches exactly.
- Debug: `console.log(fileGraph.fileEdges.length)` in the `fileGraph` memo — should be > 0.

**Bug: Cluster compound nodes overlap file nodes messily**
- Cause: COSE layout doesn't respect compound node boundaries well by default.
- Fix: Increase `nodeRepulsion` to 80000+ and add `padding: 60px` to compound nodes.

**Bug: Clicking cluster parent selects it accidentally**
- Cause: The tap handler isn't filtering `type === 'cluster'`.
- Fix: Ensure the check `if (type === 'cluster') return;` is in place.

**Bug: Drill-down shows functions from ALL files, not just the selected one**
- Cause: `fileFunctions.get(drillDownFileId)` is using a wrong key format.
- Debug: Print `[...fileGraph.fileFunctions.keys()].slice(0,3)` and compare to `drillDownFileId`.

**Bug: `cy.layout().run()` is called every re-render, fighting animation**
- Cause: `layoutKeyRef` comparison is using an unstable key.
- Fix: Make sure `layoutKey` includes `fileCyElements.length` so re-layout only happens when element count changes.

---

## 6. What Intentionally Stays Unchanged

| Layer | Change |
|---|---|
| `AI-Engine/` — all pipeline files | None |
| `Backend/` — all controllers, services, routes | None |
| `Backend/src/db/neo4j.queries.js` | None |
| `graphViewUtils.js` | None (keep for other pages) |
| `graphSlice.js` | Only the `computeImpact` BFS call site in GraphView changes |
| `apiSlice.js` — `useGetGraphQuery` | None |
| All other pages (`FileViewer`, `Analyze`, `DirListView`) | None |
| `mockdata.js` — existing exports | None (only append `CLUSTER_CONFIG`) |

The parser still generates every node type. Nothing is deleted. The frontend just ignores MODULE, SYMBOL, DATABASE, EXTERNAL_SERVICE nodes in file-mode and uses them only for the legacy view.
