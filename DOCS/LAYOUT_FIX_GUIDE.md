# Layout Fix Guide — File Graph Overlap & Scatter Issues

> All changes are in two files only: `GraphView.jsx` and optionally `package.json`.  
> Every problem is traced to an exact line number from your current code.

---

## Diagnosis: Why Each Bug Happens

### Bug 1 — Overview: Nodes all piled up / clusters overlapping (Image 1)

**Root cause A — `randomize: false` (line 743)**
```js
// CURRENT (broken):
{ name: 'cose', animate: false, randomize: false, nodeRepulsion: 60000, ... }
```
`randomize: false` tells COSE to start every node from its current position. On first load all nodes start at `(0, 0)` because Cytoscape hasn't positioned them yet. The spring simulation then tries to push them apart, but with 78 nodes all starting at the same point, repulsion vectors cancel each other out symmetrically — nodes barely move and all cluster in the center.

**Root cause B — `nodeOverlap` is missing from the overview layout (line 743)**
The legacy layout (line 764) has `nodeOverlap: 18` which tells COSE to actively push overlapping nodes apart. The file-mode overview layout is missing this entirely, so overlapping nodes are never resolved.

**Root cause C — COSE doesn't constrain children inside compound parents**
Cytoscape's built-in COSE runs the spring simulation on all nodes together, then places compound node boundaries *after* the simulation ends (they expand to fit wherever their children landed). This means children of different clusters can land next to each other during simulation, and cluster boxes then grow to overlap each other. COSE was not designed for compound node graphs.

---

### Bug 2 — Drill-down: File node and its container stacked on same spot (Image 2)

**Root cause — The file node is both a regular node AND a compound parent**

In your drill-down elements construction (lines 351–390), function nodes are given:
```js
{ data: { id: fn.id, parent: drillDownFileId } }  // parent = "file:Backend/app.js"
```

This makes the file node (`file:Backend/app.js`) a compound parent. In Cytoscape, a compound parent node renders as a *container box* that auto-resizes to contain all its children. The file node's own icon, border, and `nodeSize` styling then renders on top of this container box — giving you the three-rectangles-inside-each-other look you see in Image 2.

Additionally, compound parents are placed by the layout *after* their children, so their position is computed last and often lands on top of neighboring nodes.

---

## The Fixes

### Fix 1 — Install `cytoscape-fcose` (strongly recommended)

`fcose` is a layout algorithm built specifically for compound node graphs. It separates the spring simulation by compound group, ensuring children stay inside their parent boundaries during layout — not just after.

```bash
cd Frontend
npm install cytoscape-fcose
```

Then register it once, at the top of `GraphView.jsx` after the cytoscape import:

```js
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';       // ADD THIS
cytoscape.use(fcose);                       // ADD THIS
```

---

### Fix 2 — Replace the overview layout object (line 743)

Find this block in the `useEffect` that handles layout:

```js
// CURRENT (line 741–743):
const layout = drillDownFileId
  ? { name: 'cose', animate: false, randomize: true, nodeRepulsion: 40000, idealEdgeLength: 140, fit: true, padding: 80 }
  : { name: 'cose', animate: false, randomize: false, nodeRepulsion: 60000, idealEdgeLength: 200, gravity: 0.06, numIter: 1800, fit: true, padding: 100 };
```

Replace the entire block with:

```js
// FIXED:
const layout = drillDownFileId
  ? {
      // Drill-down: simple COSE, few nodes, no compound cluster parents
      name: 'cose',
      animate: false,
      randomize: true,
      nodeRepulsion: 8000,
      idealEdgeLength: 100,
      nodeOverlap: 20,
      gravity: 0.25,
      numIter: 1000,
      fit: true,
      padding: 60,
    }
  : {
      // Overview: fcose handles compound cluster containment properly
      name: 'fcose',
      animate: false,
      randomize: true,
      idealEdgeLength: 180,
      nodeRepulsion: () => 6500,
      edgeElasticity: () => 0.45,
      nestingFactor: 0.1,           // keeps cluster children from drifting outside
      gravity: 0.25,
      gravityRange: 3.8,
      gravityCompound: 1.0,         // extra gravity pulling cluster children toward center
      gravityRangeCompound: 1.5,
      numIter: 2500,
      tile: true,                   // tiles disconnected components instead of stacking them
      tilingPaddingVertical: 40,
      tilingPaddingHorizontal: 40,
      fit: true,
      padding: 60,
      uniformNodeDimensions: false,
    };
```

**If you don't want to install fcose**, use this fallback for the overview that still improves things significantly:

```js
// Fallback without fcose (better than current, but not perfect):
: {
    name: 'cose',
    animate: false,
    randomize: true,               // CRITICAL: was false, must be true
    nodeRepulsion: 12000,
    idealEdgeLength: 160,
    nodeOverlap: 30,               // CRITICAL: was missing
    gravity: 0.4,
    gravityRange: 3.8,
    numIter: 3500,                 // more iterations to escape local minima
    fit: true,
    padding: 80,
    componentSpacing: 120,         // space between disconnected components
  }
```

---

### Fix 3 — Separate the drill-down compound container from the file node

This is the fix for Image 2. The compound parent must be a **separate, invisible node** — not the file node itself.

In `GraphView.jsx`, find the `fileCyElements` memo, specifically the drill-down branch that starts at approximately line 348. Replace the entire drill-down branch with:

```js
if (drillDownFileId) {
  const parentFile = fileGraph.fileNodes.find((node) => node.id === drillDownFileId);
  if (!parentFile) return [];

  const childFunctions = fileGraph.fileFunctions.get(drillDownFileId) || [];
  const neighborFileIds = new Set();
  fileGraph.fileEdges.forEach((edge) => {
    if (edge.source === drillDownFileId) neighborFileIds.add(edge.target);
    if (edge.target === drillDownFileId) neighborFileIds.add(edge.source);
  });
  const neighborFiles = fileGraph.fileNodes.filter((node) => neighborFileIds.has(node.id));
  const parentCfg = CLUSTER_CONFIG[parentFile.cluster] || CLUSTER_CONFIG.Other;

  // ── CRITICAL CHANGE: use a SEPARATE invisible container node ──────────
  const containerId = `__container__:${drillDownFileId}`;
  // ─────────────────────────────────────────────────────────────────────

  const elements = [];

  // 1. Invisible compound container (expands around functions)
  elements.push({
    data: {
      id: containerId,
      label: parentFile.label,
      type: 'cluster',
      borderColor: parentCfg.border,
      bgColor: parentCfg.bg,
    },
    classes: 'cluster-parent',   // reuse the same transparent dashed style
  });

  // 2. The actual file node — NOT a compound parent, just a regular node
  elements.push({
    data: {
      id: drillDownFileId,
      label: parentFile.label,
      type: 'file',
      path: parentFile.path,
      lang: parentFile.lang,
      cluster: parentFile.cluster,
      icon: fileIcon,
      borderColor: parentCfg.border,
      bgColor: parentCfg.bg,
      nodeSize: 48,
      // NO parent field — this is a free-standing node beside the container
    },
    classes: 'selected show-label',
  });

  // 3. Function nodes — children of the CONTAINER, not the file node
  childFunctions.forEach((fn) => {
    elements.push({
      data: {
        id: fn.id,
        label: fn.label,
        type: 'function',
        parent: containerId,         // ← container, not the file node
      },
    });
  });

  // 4. CALLS edges between functions
  const childIds = new Set(childFunctions.map((item) => item.id));
  fileGraph.callEdges.forEach((edge) => {
    if (childIds.has(edge.source) && childIds.has(edge.target)) {
      elements.push({ data: { ...edge, count: edge.count || 1 } });
    }
  });

  // 5. Neighbor file nodes
  neighborFiles.forEach((node) => {
    const cfg = CLUSTER_CONFIG[node.cluster] || CLUSTER_CONFIG.Other;
    elements.push({
      data: {
        id: node.id,
        label: node.label,
        type: 'file',
        path: node.path,
        lang: node.lang,
        cluster: node.cluster,
        icon: fileIcon,
        borderColor: cfg.border,
        bgColor: cfg.bg,
        nodeSize: fileSizes.get(node.id) || 36,
      },
      classes: 'show-label',
    });
  });

  // 6. Edges to/from neighbor files
  fileGraph.fileEdges.forEach((edge) => {
    if (edge.source === drillDownFileId || edge.target === drillDownFileId) {
      elements.push({ data: { ...edge, count: edge.count || 1 } });
    }
  });

  return elements;
}
```

---

### Fix 4 — Increase compound node padding in the stylesheet

In `buildFileCyStyle` (around line 125–140), update the `cluster-parent` padding:

```js
// CURRENT:
padding: '30px',

// CHANGE TO:
padding: '45px',
```

Also add `min-width` and `min-height` so empty or single-child cluster containers don't collapse to a tiny dot:

```js
{
  selector: 'node.cluster-parent',
  style: {
    shape: 'round-rectangle',
    'background-opacity': 0.04,
    'border-width': '1.5px',
    'border-style': 'dashed',
    'border-color': 'data(borderColor)',
    'background-color': 'data(bgColor)',
    label: 'data(label)',
    'text-valign': 'top',
    'text-halign': 'center',
    'font-size': '11px',
    'font-weight': 'bold',
    color: 'data(borderColor)',
    padding: '45px',                        // ← increased
    'min-width': '120px',                   // ← ADD
    'min-height': '80px',                   // ← ADD
    'compound-sizing-wrt-labels': 'include',
  },
},
```

---

### Fix 5 — Post-layout `fit` call is fighting the layout's own `fit: true`

After `cy.layout(layout).run()` (line 748), you call `cy.fit(undefined, 80)` immediately after. The layout already ran with `fit: true`, then you're fitting again with different padding. Remove the second fit for file mode:

```js
// CURRENT (lines 747–749):
layoutKeyRef.current = layoutKey;
cy.layout(layout).run();
cy.fit(undefined, 80);              // ← REMOVE this line for file mode

// FIXED:
layoutKeyRef.current = layoutKey;
cy.layout(layout).run();
// fit is already handled by the layout's own fit:true
```

---

## Summary — What to Change and Where

| # | File | Line (approx) | Change |
|---|------|---------------|--------|
| 1 | `package.json` | — | `npm install cytoscape-fcose` |
| 2 | `GraphView.jsx` | top imports | `import fcose from 'cytoscape-fcose'; cytoscape.use(fcose);` |
| 3 | `GraphView.jsx` | ~741–743 | Replace layout object (Fix 2 above) |
| 4 | `GraphView.jsx` | ~348–410 | Replace drill-down elements branch (Fix 3 above) |
| 5 | `GraphView.jsx` | ~125–140 | Increase compound padding + add min-width/height (Fix 4) |
| 6 | `GraphView.jsx` | ~748–749 | Remove second `cy.fit()` call after layout (Fix 5) |

**Do them in order 1 → 6.** Steps 1–3 fix Image 1. Steps 3–6 fix Image 2. Step 3 (layout object) helps both.
