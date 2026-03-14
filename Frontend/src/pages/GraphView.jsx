import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import cytoscape from 'cytoscape';
import { Filter, RefreshCw, ZoomIn, ZoomOut, Maximize2, Info } from 'lucide-react';
import { setSelectedNode, clearSelection } from '../store/index';
import { useGetGraphQuery } from '../store/slices/apiSlice';
import { NODE_TYPE_CONFIG, EDGE_TYPE_CONFIG } from '../assets/mockdata';

const NODE_TYPES  = Object.keys(NODE_TYPE_CONFIG);
const EDGE_TYPES  = Object.keys(EDGE_TYPE_CONFIG);

const buildCyElements = (graphData, filterLangs, filterTypes) => {
  let nodes = graphData.nodes;
  if (filterTypes.length > 0) nodes = nodes.filter((n) => filterTypes.includes(n.type));

  const validIds = new Set(nodes.map((n) => n.id));
  const edges = graphData.edges.filter(
    (e) => validIds.has(e.source) && validIds.has(e.target)
  );

  return [
    ...nodes.map((n) => ({
      data: { id: n.id, label: n.label, type: n.type, lang: n.lang, path: n.path, description: n.description },
    })),
    ...edges.map((e) => ({
      data: { id: e.id, source: e.source, target: e.target, edgeType: e.type, label: e.label },
    })),
  ];
};

const buildCyStyle = () => [
  {
    selector: 'node',
    style: {
      'label': 'data(label)',
      'text-valign': 'bottom',
      'text-halign': 'center',
      'font-size': '10px',
      'font-family': "'JetBrains Mono', monospace",
      'color': '#94a3b8',
      'text-margin-y': '4px',
      'width': '36px',
      'height': '36px',
      'border-width': '2px',
    },
  },
  ...NODE_TYPES.map((type) => {
    const cfg = NODE_TYPE_CONFIG[type];
    return {
      selector: `node[type = "${type}"]`,
      style: {
        'background-color': cfg.color,
        'border-color': cfg.border,
        'shape': cfg.shape,
      },
    };
  }),
  {
    selector: 'edge',
    style: {
      'width': 1.5,
      'target-arrow-shape': 'triangle',
      'target-arrow-size': '6px',
      'curve-style': 'bezier',
      'font-size': '9px',
      'font-family': "'JetBrains Mono', monospace",
      'color': '#64748b',
      'text-rotation': 'autorotate',
      'text-margin-y': '-6px',
    },
  },
  ...EDGE_TYPES.map((type) => {
    const cfg = EDGE_TYPE_CONFIG[type];
    return {
      selector: `edge[edgeType = "${type}"]`,
      style: {
        'line-color': cfg.color,
        'target-arrow-color': cfg.color,
        'line-style': cfg.style,
      },
    };
  }),
  {
    selector: 'node.selected',
    style: {
      'border-width': '3px',
      'border-color': '#ef4444',
      'overlay-color': '#ef4444',
      'overlay-opacity': 0.08,
    },
  },
  {
    selector: 'node.direct-impact',
    style: {
      'border-width': '3px',
      'border-color': '#f97316',
      'overlay-color': '#f97316',
      'overlay-opacity': 0.08,
    },
  },
  {
    selector: 'node.transitive-impact',
    style: {
      'border-width': '2px',
      'border-color': '#eab308',
      'overlay-color': '#eab308',
      'overlay-opacity': 0.06,
    },
  },
  {
    selector: 'node.dimmed',
    style: { 'opacity': 0.25 },
  },
  {
    selector: 'edge.dimmed',
    style: { 'opacity': 0.1 },
  },
];

const GraphView = () => {
  const dispatch   = useDispatch();
  const navigate   = useNavigate();
  const cyRef      = useRef(null);
  const containerRef = useRef(null);

  const selectedNode   = useSelector((s) => s.graph.selectedNode);
  const directImpact   = useSelector((s) => s.graph.directImpact);
  const transitiveImpact = useSelector((s) => s.graph.transitiveImpact);
  const filterTypes    = useSelector((s) => s.graph.filterTypes);
  const filterLangs    = useSelector((s) => s.graph.filterLangs);

  const { data: fetchedGraphData, isLoading } = useGetGraphQuery();
  
  // Use fetched data if available, otherwise fallback to empty arrays
  const graphData = fetchedGraphData || { nodes: [], edges: [] };

  const [showLegend, setShowLegend]   = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTypes, setActiveTypes] = useState([]);

  // Initialise Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;

    const elements = buildCyElements(graphData, filterLangs, filterTypes);

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: buildCyStyle(),
      layout: {
        name: 'cose',
        animate: false,
        nodeRepulsion: 8500,
        idealEdgeLength: 110,
        edgeElasticity: 0.45,
        nestingFactor: 1.2,
        gravity: 0.25,
        numIter: 1000,
        randomize: false,
      },
      minZoom: 0.2,
      maxZoom: 3,
    });

    cyRef.current = cy;

    cy.on('tap', 'node', (evt) => {
      const id = evt.target.id();
      if (id === selectedNode) {
        dispatch(clearSelection());
      } else {
        dispatch(setSelectedNode({ id, graphData: elements.length ? { nodes: elements.filter(e => e.data.type || e.data.lang).map(e => ({...e.data})), edges: elements.filter(e => e.data.source).map(e => ({...e.data})) } : graphData }));
      }
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) dispatch(clearSelection());
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [graphData, filterTypes, filterLangs]);

  // Apply highlight classes whenever selection changes
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.nodes().removeClass('selected direct-impact transitive-impact dimmed');
    cy.edges().removeClass('dimmed');

    if (!selectedNode) return;

    const allImpacted = new Set([selectedNode, ...directImpact, ...transitiveImpact]);

    cy.nodes().forEach((node) => {
      const id = node.id();
      if (id === selectedNode) {
        node.addClass('selected');
      } else if (directImpact.includes(id)) {
        node.addClass('direct-impact');
      } else if (transitiveImpact.includes(id)) {
        node.addClass('transitive-impact');
      } else {
        node.addClass('dimmed');
      }
    });

    cy.edges().forEach((edge) => {
      const s = edge.data('source');
      const t = edge.data('target');
      if (!allImpacted.has(s) || !allImpacted.has(t)) {
        edge.addClass('dimmed');
      }
    });
  }, [selectedNode, directImpact, transitiveImpact]);

  const handleZoomIn  = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit     = () => cyRef.current?.fit(undefined, 30);
  const handleReset   = () => { dispatch(clearSelection()); cyRef.current?.fit(undefined, 30); };

  const selectedData = selectedNode
    ? graphData.nodes.find((n) => n.id === selectedNode)
    : null;

  return (
    <div className="flex flex-col gap-3" style={{ height: 'calc(100vh - 7rem)' }}>
      {isLoading && (
        <div className="absolute top-4 right-4 z-50 px-4 py-2 rounded-lg" style={{ background: '#3b82f6', color: '#fff' }}>
          Loading graph data...
        </div>
      )}
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <button onClick={handleZoomIn}  className="p-1.5 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800" title="Zoom in"><ZoomIn  size={15} /></button>
          <button onClick={handleZoomOut} className="p-1.5 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800" title="Zoom out"><ZoomOut size={15} /></button>
          <button onClick={handleFit}     className="p-1.5 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800" title="Fit"><Maximize2 size={15} /></button>
          <button onClick={handleReset}   className="p-1.5 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800" title="Reset"><RefreshCw size={15} /></button>
        </div>

        <button
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: showFilters ? 'rgba(59,130,246,0.12)' : 'var(--card)',
            color: showFilters ? '#3b82f6' : 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
        >
          <Filter size={13} /> Filters
        </button>

        <button
          onClick={() => setShowLegend((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: showLegend ? 'rgba(59,130,246,0.12)' : 'var(--card)',
            color: showLegend ? '#3b82f6' : 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
        >
          <Info size={13} /> Legend
        </button>

        <div className="ml-auto flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>{graphData.nodes.length} nodes</span>
          <span>{graphData.edges.length} edges</span>
          {selectedNode && (
            <span className="font-medium" style={{ color: '#ef4444' }}>
              {directImpact.length + transitiveImpact.length} impacted
            </span>
          )}
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card flex flex-wrap items-center gap-2 py-3">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Node type:
          </span>
          {NODE_TYPES.map((type) => {
            const cfg = NODE_TYPE_CONFIG[type];
            const active = activeTypes.length === 0 || activeTypes.includes(type);
            return (
              <button
                key={type}
                onClick={() =>
                  setActiveTypes((prev) =>
                    prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
                  )
                }
                className="text-xs px-2.5 py-1 rounded-full font-medium transition-all"
                style={{
                  background: active ? `${cfg.border}20` : 'var(--bg-muted)',
                  color:      active ? cfg.border        : 'var(--text-muted)',
                  border:     `1px solid ${active ? cfg.border + '50' : 'var(--border)'}`,
                }}
              >
                {cfg.label}
              </button>
            );
          })}
          {activeTypes.length > 0 && (
            <button
              onClick={() => setActiveTypes([])}
              className="text-xs px-2 py-1 rounded-full transition-all"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <div className="card flex flex-wrap gap-x-5 gap-y-2 py-3">
          <div className="flex flex-wrap gap-3">
            {NODE_TYPES.map((type) => {
              const cfg = NODE_TYPE_CONFIG[type];
              return (
                <div key={type} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ background: cfg.color, border: `1.5px solid ${cfg.border}` }} />
                  {cfg.label}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3">
            {EDGE_TYPES.map((type) => {
              const cfg = EDGE_TYPE_CONFIG[type];
              return (
                <div key={type} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span className="inline-block w-5" style={{ borderTop: `2px ${cfg.style} ${cfg.color}` }} />
                  {cfg.label}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="w-3 h-3 rounded-sm border-2 inline-block" style={{ borderColor: '#ef4444' }} /> Selected
            </div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="w-3 h-3 rounded-sm border-2 inline-block" style={{ borderColor: '#f97316' }} /> Direct Impact
            </div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="w-3 h-3 rounded-sm border-2 inline-block" style={{ borderColor: '#eab308' }} /> Transitive
            </div>
          </div>
        </div>
      )}

      {/* Selected node info bar */}
      {selectedData && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <span className="font-semibold code-text" style={{ color: '#ef4444' }}>{selectedData.label}</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{selectedData.lang} · {selectedData.type}</span>
          <span className="text-xs flex-1 truncate hidden sm:block" style={{ color: 'var(--text-muted)' }}>{selectedData.path}</span>
          <button
            onClick={() => navigate('/impact')}
            className="ml-auto text-xs font-medium px-3 py-1 rounded-lg transition-all flex-shrink-0"
            style={{ background: '#ef4444', color: '#fff' }}
          >
            View Impact →
          </button>
        </div>
      )}

      {/* Cytoscape canvas */}
      <div
        className="flex-1 rounded-xl overflow-hidden"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', minHeight: 0 }}
      >
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};

export default GraphView;
