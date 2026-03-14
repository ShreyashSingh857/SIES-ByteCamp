import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import cytoscape from 'cytoscape';
import { Filter, RefreshCw, ZoomIn, ZoomOut, Maximize2, Info, Search } from 'lucide-react';
import { setSelectedNode, clearSelection, setGraphData, setFilterLangs, setFilterTypes } from '../store/index';
import { useGetGraphQuery } from '../store/slices/apiSlice';
import { EDGE_TYPE_CONFIG } from '../assets/mockdata';
import serviceIcon from '../assets/Icons/Service.svg';
import fileIcon from '../assets/Icons/File.svg';
import functionIcon from '../assets/Icons/Function.svg';
import apiEndpointIcon from '../assets/Icons/APIEndpoint.svg';
import dbTableIcon from '../assets/Icons/DBTable.svg';
import dbFieldIcon from '../assets/Icons/DBField.svg';
import apiContractIcon from '../assets/Icons/APIContract.svg';
import { buildDisplayGraph, computeNodeSizesByDepth, getDefaultVisibleTypes, normalizeEdgeType, normalizeNodeType } from './graphViewUtils';

const GRAPH_NODE_TYPE_CONFIG = {
  service: { label: 'Service', color: '#1d4ed8', border: '#3b82f6', shape: 'round-rectangle', icon: serviceIcon },
  file: { label: 'File', color: '#0369a1', border: '#0ea5e9', shape: 'round-rectangle', icon: fileIcon },
  folder: { label: 'Folder', color: '#1e40af', border: '#60a5fa', shape: 'round-rectangle', icon: fileIcon },
  function: { label: 'Function', color: '#15803d', border: '#22c55e', shape: 'ellipse', icon: functionIcon },
  api_endpoint: { label: 'API Endpoint', color: '#7c3aed', border: '#a855f7', shape: 'diamond', icon: apiEndpointIcon },
  db_table: { label: 'DB Table', color: '#b45309', border: '#f59e0b', shape: 'round-rectangle', icon: dbTableIcon },
  db_field: { label: 'DB Field', color: '#be123c', border: '#f43f5e', shape: 'ellipse', icon: dbFieldIcon },
  api_contract: { label: 'API Contract', color: '#0f766e', border: '#14b8a6', shape: 'round-rectangle', icon: apiContractIcon },
};

const NODE_TYPES = ['service', 'file', 'function', 'api_endpoint', 'db_table', 'db_field', 'api_contract'];
const EDGE_PALETTE = ['#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#14b8a6', '#ef4444', '#0ea5e9', '#f97316'];

const buildCyStyle = (nodeTypes, edgeConfig) => [
  {
    selector: 'node',
    style: {
      'label': '',
      'text-valign': 'bottom',
      'text-halign': 'center',
      'font-size': '8px',
      'font-family': 'monospace',
      'color': '#94a3b8',
      'text-margin-y': '3px',
      'width': 'data(nodeSize)',
      'height': 'data(nodeSize)',
      'background-image': 'data(icon)',
      'background-fit': 'cover cover',
      'background-opacity': 0,
      'border-width': 0,
      'overlay-opacity': 0,
      'overlay-padding': 0,
    },
  },
  {
    selector: 'node.show-label',
    style: {
      'label': 'data(label)',
    },
  },
  ...nodeTypes.map((type) => {
    const cfg = GRAPH_NODE_TYPE_CONFIG[type] || {};
    return {
      selector: `node[type = "${type}"]`,
      style: {
        'shape': cfg.shape || 'round-rectangle',
      },
    };
  }),
  {
    selector: 'edge',
    style: {
      'width': 'mapData(count, 1, 8, 1.6, 5)',
      'line-color': '#2563eb',
      'target-arrow-color': '#2563eb',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'font-size': '9px',
      'font-family': 'monospace',
      'color': '#64748b',
      'text-rotation': 'autorotate',
      'opacity': 0.55,
    },
  },
  ...Object.keys(edgeConfig).map((type) => {
    const cfg = edgeConfig[type] || {};
    return {
      selector: `edge[edgeType = "${type}"]`,
      style: {
        'line-color': cfg.color || '#334155',
        'target-arrow-color': cfg.color || '#334155',
        'line-style': cfg.style || 'solid',
      },
    };
  }),
  { selector: 'node.selected',         style: { 'border-width': '3px', 'border-color': '#ef4444', 'overlay-color': '#ef4444', 'overlay-opacity': 0.08 } },
  { selector: 'node.direct-impact',    style: { 'border-width': '3px', 'border-color': '#f97316', 'overlay-color': '#f97316', 'overlay-opacity': 0.08 } },
  { selector: 'node.transitive-impact',style: { 'border-width': '2px', 'border-color': '#eab308', 'overlay-color': '#eab308', 'overlay-opacity': 0.06 } },
  { selector: 'node.search-match',     style: { 'border-width': '3px', 'border-color': '#38bdf8', 'overlay-color': '#38bdf8', 'overlay-opacity': 0.06 } },
  { selector: 'node.dimmed',           style: { 'opacity': 0.25 } },
  { selector: 'edge.dimmed',           style: { 'opacity': 0.1  } },
];

const GraphView = () => {
  const dispatch     = useDispatch();
  const navigate     = useNavigate();
  const cyRef        = useRef(null);
  const containerRef = useRef(null);
  const layoutKeyRef = useRef('');

  const selectedNode      = useSelector((s) => s.graph.selectedNode);
  const themeMode         = useSelector((s) => s.theme.mode);
  const filterTypes       = useSelector((s) => s.graph.filterTypes);
  const filterLangs       = useSelector((s) => s.graph.filterLangs);
  const currentRepoId     = useSelector((s) => s.graph.currentRepoId);
  // Wire up BFS results computed by graphSlice so the canvas highlighting is live
  const directImpact      = useSelector((s) => s.graph.directImpact);
  const transitiveImpact  = useSelector((s) => s.graph.transitiveImpact);

  // Fetch graph using the repoId from scan result
  const { data: fetchedGraphData, isLoading } = useGetGraphQuery(currentRepoId, {
    skip: !currentRepoId,
  });
  const graphData = fetchedGraphData || { nodes: [], edges: [] };
  const nodeTypes = useMemo(() => NODE_TYPES, []);
  const [scope, setScope] = useState('overview');
  const [perspective, setPerspective] = useState('structure');
  const [localDepth, setLocalDepth] = useState(2);
  const [hideLeafNodes, setHideLeafNodes] = useState(true);
  const [showAllLabels, setShowAllLabels] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [expandedFiles, setExpandedFiles] = useState(new Set());
  const [searchText, setSearchText] = useState('');

  const [showLegend, setShowLegend]   = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewportZoom, setViewportZoom] = useState(1);
  const defaultTypes = useMemo(() => getDefaultVisibleTypes(perspective), [perspective]);
  const effectiveFilterTypes = filterTypes.length > 0 ? filterTypes : defaultTypes;
  const availableLangs = useMemo(() => {
    const langs = new Set();
    (graphData.nodes || []).forEach((node) => {
      const lang = node.language || node.lang;
      if (lang) langs.add(lang);
    });
    return [...langs].sort();
  }, [graphData]);
  const graphNodeIds = useMemo(() => new Set((graphData.nodes || []).map((node) => node.id)), [graphData]);
  const rawGraph = useMemo(() => {
    const nodes = (graphData.nodes || []).map((node) => {
      const type = normalizeNodeType(node.type);
      return {
        id: node.id,
        label: node.name || node.label || node.id,
        type,
        lang: node.language || node.lang,
        path: node.path || node.file || node.name,
        isSynthetic: false,
      };
    });
    const edges = (graphData.edges || []).map((edge) => ({
      ...edge,
      source: edge.source ?? edge.from,
      target: edge.target ?? edge.to,
    })).filter((edge) => edge.source && edge.target && edge.source !== edge.target).map((edge, index) => ({
      id: edge.id || `edge-${index}`,
      source: edge.source,
      target: edge.target,
      edgeType: normalizeEdgeType(edge.type ?? edge.edgeType ?? edge.label),
      count: 1,
    }));
    const sizes = computeNodeSizesByDepth(nodes, edges);
    return {
      nodes: nodes.map((node) => ({ ...node, nodeSize: sizes.get(node.id) || 44 })),
      links: edges,
      collapsedFolders: new Set(),
    };
  }, [graphData]);
  const displayGraph = useMemo(() => {
    if (perspective === 'all') return rawGraph;
    const base = buildDisplayGraph(graphData, {
      scope,
      perspective,
      selectedNodeId: selectedNode,
      localDepth,
      expandedFolders,
      expandedFiles,
      activeTypes: scope === 'local' ? [] : effectiveFilterTypes,
      hideLeafNodes,
    });
    if (scope === 'local' || !filterLangs.length) {
      return base;
    }
    const allowed = new Set(filterLangs);
    const nodes = base.nodes.filter((node) => (node.isSynthetic ? true : allowed.has(node.lang || '')));
    const ids = new Set(nodes.map((node) => node.id));
    return {
      ...base,
      nodes,
      links: base.links.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
    };
  }, [graphData, scope, perspective, selectedNode, localDepth, expandedFolders, expandedFiles, effectiveFilterTypes, hideLeafNodes, filterLangs, rawGraph]);
  const edgeConfig = useMemo(() => {
    const present = new Set(displayGraph.links.map((edge) => edge.edgeType || 'RELATED'));
    const merged = { ...EDGE_TYPE_CONFIG };
    [...present].forEach((type, index) => {
      if (!merged[type]) {
        merged[type] = {
          color: EDGE_PALETTE[index % EDGE_PALETTE.length],
          style: 'solid',
          label: type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase()),
        };
      }
    });
    return merged;
  }, [displayGraph.links]);
  const searchMatches = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return [];
    return displayGraph.nodes.filter((node) => `${node.label} ${node.path || ''}`.toLowerCase().includes(query)).map((node) => node.id);
  }, [displayGraph, searchText]);
  const selectedData = selectedNode ? displayGraph.nodes.find((node) => node.id === selectedNode) || graphData.nodes.find((node) => node.id === selectedNode) : null;
  const selectedIsFolder = Boolean(selectedData?.isSynthetic && selectedData?.type === 'folder');
  const selectedFolderPath = selectedIsFolder ? selectedData.path : null;
  const selectedIsFile = selectedData?.type === 'file' && !selectedData?.isSynthetic;

  useEffect(() => {
    if (scope === 'local' && selectedNode) return;
    if (!selectedNode) setScope('overview');
  }, [selectedNode, scope]);

  useEffect(() => {
    if (scope === 'local' && selectedNode && !graphNodeIds.has(selectedNode)) {
      setScope('overview');
    }
  }, [graphNodeIds, scope, selectedNode]);

  const gridStyle = useMemo(() => {
    const z = Math.max(0.2, Math.min(3, viewportZoom));
    const major = Math.max(36, Math.round(80 * z));
    const minor = Math.max(10, Math.round(20 * z));
    const isDark = themeMode === 'dark';
    const majorAlpha = isDark ? Math.min(0.14, 0.05 + z * 0.02) : Math.min(0.22, 0.08 + z * 0.03);
    const minorAlpha = isDark ? Math.min(0.08, 0.02 + z * 0.015) : Math.min(0.12, 0.04 + z * 0.02);
    const gridRgb = isDark ? '59,130,246' : '148,163,184';

    return {
      backgroundColor: isDark ? '#020817' : '#f8fafc',
      backgroundImage:
        `linear-gradient(rgba(${gridRgb},${majorAlpha}) 1px, transparent 1px), ` +
        `linear-gradient(90deg, rgba(${gridRgb},${majorAlpha}) 1px, transparent 1px), ` +
        `linear-gradient(rgba(${gridRgb},${minorAlpha}) 1px, transparent 1px), ` +
        `linear-gradient(90deg, rgba(${gridRgb},${minorAlpha}) 1px, transparent 1px)`,
      backgroundSize: `${major}px ${major}px, ${major}px ${major}px, ${minor}px ${minor}px, ${minor}px ${minor}px`,
      border: isDark ? '1px solid #1e293b' : '1px solid #cbd5e1',
      minHeight: 0,
    };
  }, [viewportZoom, themeMode]);


  useEffect(() => {
    const valid = (filterTypes || []).filter((t) => nodeTypes.includes(t));
    if (valid.length !== (filterTypes || []).length) {
      dispatch(setFilterTypes(valid));
    }
  }, [filterTypes, nodeTypes, dispatch]);

  useEffect(() => {
    dispatch(setFilterTypes([]));
  }, [perspective, dispatch]);

  useEffect(() => {
    const valid = (filterLangs || []).filter((lang) => availableLangs.includes(lang));
    if (valid.length !== (filterLangs || []).length) {
      dispatch(setFilterLangs(valid));
    }
  }, [availableLangs, filterLangs, dispatch]);

  // Keep Redux graphData in sync with the RTK Query result so setSelectedNode
  // fallback BFS always has real data even if graphData isn't passed explicitly.
  useEffect(() => {
    if (fetchedGraphData) {
      dispatch(setGraphData(fetchedGraphData));
    }
  }, [fetchedGraphData, dispatch]);

  useEffect(() => {
    if (!containerRef.current || cyRef.current) return;
    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: buildCyStyle(['folder', ...nodeTypes], edgeConfig),
      boxSelectionEnabled: false,
      minZoom: 0.2,
      maxZoom: 3,
    });
    let lastZoom = 1;
    cy.on('zoom', () => {
      const z = Number(cy.zoom().toFixed(2));
      if (Math.abs(z - lastZoom) >= 0.02) {
        lastZoom = z;
        setViewportZoom(z);
      }
    });
    cy.on('tap', 'node', (evt) => {
      const id = evt.target.id();
      if (id === selectedNode) {
        dispatch(clearSelection());
      } else {
        dispatch(setSelectedNode({ id, graphData }));
        if (graphNodeIds.has(id)) {
          setScope('local');
        }
      }
    });
    cy.on('tap', (evt) => {
      if (evt.target === cy) dispatch(clearSelection());
    });
    cy.on('mouseover', 'node', (evt) => evt.target.addClass('show-label'));
    cy.on('mouseout', 'node', () => {
      const showByZoom = cy.zoom() >= 1.05 || showAllLabels;
      cy.nodes().removeClass('show-label');
      if (showByZoom) cy.nodes().addClass('show-label');
      if (selectedNode) cy.$id(selectedNode).addClass('show-label');
    });
    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [dispatch, graphData, nodeTypes, selectedNode, showAllLabels, edgeConfig]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const elements = [
      ...displayGraph.nodes.map((node) => ({ data: { ...node, icon: GRAPH_NODE_TYPE_CONFIG[node.type]?.icon || fileIcon } })),
      ...displayGraph.links.map((edge) => ({ data: { ...edge, count: edge.count || 1 } })),
    ];
    cy.batch(() => {
      cy.elements().remove();
      cy.add(elements);
    });
    const layout = scope === 'local'
      ? { name: 'cose', animate: false, randomize: true, nodeRepulsion: 50000, idealEdgeLength: 220, nodeOverlap: 18, gravity: 0.12, numIter: 1800, fit: true, padding: 140 }
      : perspective === 'structure'
      ? { name: 'breadthfirst', animate: false, fit: true, padding: 180, spacingFactor: 1.3, directed: false }
      : { name: 'cose', animate: false, randomize: true, nodeRepulsion: 36000, idealEdgeLength: 170, nodeOverlap: 18, gravity: 0.08, numIter: 2200, fit: true, padding: 200 };
    const layoutKey = `${scope}-${perspective}-${displayGraph.nodes.length}-${displayGraph.links.length}`;
    if (layoutKey !== layoutKeyRef.current) {
      layoutKeyRef.current = layoutKey;
      cy.layout(layout).run();
      cy.fit(undefined, 120);
      cy.zoom(cy.zoom() * 0.85);
      cy.center();
      setViewportZoom(Number(cy.zoom().toFixed(2)));
    }
  }, [displayGraph, scope, perspective]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const showByZoom = cy.zoom() >= 1.05 || showAllLabels;
    cy.nodes().removeClass('show-label');
    if (showByZoom) cy.nodes().addClass('show-label');
    if (selectedNode) cy.$id(selectedNode).addClass('show-label');
    searchMatches.forEach((id) => cy.$id(id).addClass('show-label'));
  }, [showAllLabels, selectedNode, searchMatches]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.nodes().removeClass('selected direct-impact transitive-impact dimmed search-match');
    cy.edges().removeClass('dimmed');

    searchMatches.forEach((id) => {
      cy.$id(id).addClass('search-match show-label');
    });

    if (!selectedNode) return;

    if (selectedData?.isSynthetic) {
      cy.$id(selectedNode).addClass('selected show-label');
      return;
    }

    const directSet     = new Set(directImpact);
    const transitiveSet = new Set(transitiveImpact);
    const allImpacted   = new Set([...directImpact, ...transitiveImpact]);

    cy.nodes().forEach((node) => {
      const id = node.id();
      if (id === selectedNode) {
        node.addClass('selected show-label');
      } else if (directSet.has(id)) {
        node.addClass('direct-impact');
      } else if (transitiveSet.has(id)) {
        node.addClass('transitive-impact');
      } else if (!searchMatches.includes(id)) {
        node.addClass('dimmed');
      }
    });

    cy.edges().forEach((edge) => {
      const s = edge.data('source');
      const t = edge.data('target');
      if (
        s !== selectedNode &&
        t !== selectedNode &&
        !allImpacted.has(s) &&
        !allImpacted.has(t)
      ) {
        edge.addClass('dimmed');
      }
    });
    const selectedElement = cy.$id(selectedNode);
    if (selectedElement.length) {
      cy.animate({ fit: { eles: selectedElement.closedNeighborhood(), padding: 90 }, duration: 250 });
    }
  }, [selectedNode, directImpact, transitiveImpact, searchMatches, selectedData]);

  const handleZoomIn  = () => {
    cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  };
  const handleZoomOut = () => {
    cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  };
  const handleFit     = () => {
    cyRef.current?.fit(undefined, 30);
  };
  const handleReset   = () => {
    dispatch(clearSelection());
    setScope('overview');
    setExpandedFolders(new Set());
    setExpandedFiles(new Set());
    setSearchText('');
    cyRef.current?.fit(undefined, 30);
  };
  const handleSearchFocus = () => {
    const match = searchMatches[0];
    if (!match) return;
    dispatch(setSelectedNode({ id: match, graphData }));
    if (graphNodeIds.has(match)) setScope('local');
  };

  return (
    <div className="flex flex-col gap-3" style={{ height: 'calc(100vh - 7rem)' }}>
      {isLoading && (
        <div className="absolute top-4 right-4 z-50 px-4 py-2 rounded-lg" style={{ background: '#3b82f6', color: '#fff' }}>
          Loading graph data...
        </div>
      )}
      {!currentRepoId && !isLoading && (
        <div className="absolute top-4 right-4 z-50 px-4 py-2 rounded-lg" style={{ background: '#475569', color: '#fff' }}>
          No repository scanned. <button onClick={() => navigate('/upload')} style={{ textDecoration: 'underline' }}>Scan a repo →</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <button onClick={handleZoomIn}  className="p-1.5 rounded-md transition-colors" title="Zoom in"><ZoomIn  size={15} /></button>
          <button onClick={handleZoomOut} className="p-1.5 rounded-md transition-colors" title="Zoom out"><ZoomOut size={15} /></button>
          <button onClick={handleFit}     className="p-1.5 rounded-md transition-colors" title="Fit"><Maximize2 size={15} /></button>
          <button onClick={handleReset}   className="p-1.5 rounded-md transition-colors" title="Reset"><RefreshCw size={15} /></button>
        </div>

        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {['structure', 'all'].map((value) => (
            <button
              key={value}
              onClick={() => setPerspective(value)}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium"
              style={{ background: perspective === value ? 'rgba(59,130,246,0.12)' : 'transparent', color: perspective === value ? '#3b82f6' : 'var(--text-muted)' }}
            >
              {value === 'all' ? 'Combined' : 'Structure'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {['overview', 'local'].map((value) => (
            <button
              key={value}
              onClick={() => setScope(value)}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium"
              style={{ background: scope === value ? 'rgba(59,130,246,0.12)' : 'transparent', color: scope === value ? '#3b82f6' : 'var(--text-muted)' }}
            >
              {value === 'overview' ? 'Overview' : `Local ${localDepth}`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <Search size={13} style={{ color: 'var(--text-muted)' }} />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') handleSearchFocus(); }}
            placeholder="Search file or function"
            className="bg-transparent outline-none text-xs w-44"
          />
          <button onClick={handleSearchFocus} className="text-xs px-2 py-1 rounded-md" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
            Focus
          </button>
        </div>

        <button
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{ background: showFilters ? 'rgba(59,130,246,0.12)' : 'var(--card)', color: showFilters ? '#3b82f6' : 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          <Filter size={13} /> Filters
        </button>

        <button
          onClick={() => setShowLegend((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{ background: showLegend ? 'rgba(59,130,246,0.12)' : 'var(--card)', color: showLegend ? '#3b82f6' : 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          <Info size={13} /> Legend
        </button>

        <div className="ml-auto flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>{displayGraph.nodes.length} shown</span>
          <span>{displayGraph.links.length} edges</span>
          <span>{graphData.nodes.length} raw</span>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card flex flex-wrap items-center gap-2 py-3">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Node type:</span>
          {nodeTypes.map((type) => {
            const cfg = GRAPH_NODE_TYPE_CONFIG[type] || {};
            const active = effectiveFilterTypes.includes(type);
            return (
              <button
                key={type}
                onClick={() => {
                  const base = filterTypes.length > 0 ? filterTypes : defaultTypes;
                  const next = base.includes(type) ? base.filter((t) => t !== type) : [...base, type];
                  dispatch(setFilterTypes(next));
                }}
                className="text-xs px-2.5 py-1 rounded-full font-medium transition-all"
                style={{ background: active ? `${cfg.border || '#3b82f6'}20` : 'var(--bg-muted)', color: active ? cfg.border || '#3b82f6' : 'var(--text-muted)', border: `1px solid ${active ? (cfg.border || '#3b82f6') + '50' : 'var(--border)'}` }}
              >
                <img src={cfg.icon || fileIcon} alt={type} className="inline-block w-4 h-4 mr-1 rounded align-text-bottom" />
                {cfg.label || type}
              </button>
            );
          })}
          {filterTypes.length > 0 && (
            <button onClick={() => dispatch(setFilterTypes([]))} className="text-xs px-2 py-1 rounded-full transition-all" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              Reset type defaults
            </button>
          )}

          <span className="text-xs font-medium ml-3" style={{ color: 'var(--text-muted)' }}>Language:</span>
          {availableLangs.map((lang) => {
            const active = filterLangs.length === 0 || filterLangs.includes(lang);
            return (
              <button
                key={lang}
                onClick={() => {
                  const next = filterLangs.includes(lang) ? filterLangs.filter((value) => value !== lang) : [...filterLangs, lang];
                  dispatch(setFilterLangs(next));
                }}
                className="text-xs px-2.5 py-1 rounded-full font-medium transition-all"
                style={{ background: active ? 'rgba(59,130,246,0.12)' : 'var(--bg-muted)', color: active ? '#3b82f6' : 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                {lang}
              </button>
            );
          })}
          {filterLangs.length > 0 && (
            <button onClick={() => dispatch(setFilterLangs([]))} className="text-xs px-2 py-1 rounded-full transition-all" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              Reset languages
            </button>
          )}
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <div className="card flex flex-wrap gap-x-5 gap-y-2 py-3">
          <div className="flex flex-wrap gap-3">
            {['folder', ...nodeTypes].map((type) => {
              const cfg = GRAPH_NODE_TYPE_CONFIG[type] || {};
              return (
                <div key={type} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <img src={cfg.icon || fileIcon} alt={type} className="w-4 h-4 rounded" />
                  {cfg.label || type}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.keys(edgeConfig).map((type) => {
              const cfg = edgeConfig[type] || {};
              return (
                <div key={type} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span className="inline-block w-5" style={{ borderTop: `2px ${cfg.style || 'solid'} ${cfg.color || '#475569'}` }} />
                  {cfg.label || type}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}><span className="w-3 h-3 rounded-sm border-2 inline-block" style={{ borderColor: '#ef4444' }} /> Selected</div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}><span className="w-3 h-3 rounded-sm border-2 inline-block" style={{ borderColor: '#f97316' }} /> Direct Impact</div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}><span className="w-3 h-3 rounded-sm border-2 inline-block" style={{ borderColor: '#eab308' }} /> Transitive</div>
          </div>
        </div>
      )}

      {/* Selected node info bar */}
      {selectedData && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm flex-wrap"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <span className="font-semibold code-text" style={{ color: '#ef4444' }}>{selectedData.label || selectedData.name || selectedData.id}</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{selectedData.lang || selectedData.language || 'mixed'} · {selectedData.type}</span>
          <span className="text-xs flex-1 truncate hidden sm:block" style={{ color: 'var(--text-muted)' }}>{selectedData.path || selectedData.name}</span>
          {selectedIsFolder && (
            <button
              onClick={() => setExpandedFolders((current) => {
                const next = new Set(current);
                if (next.has(selectedFolderPath)) next.delete(selectedFolderPath);
                else next.add(selectedFolderPath);
                return next;
              })}
              className="text-xs font-medium px-3 py-1 rounded-lg transition-all shrink-0"
              style={{ background: '#1d4ed8', color: '#fff' }}
            >
              {expandedFolders.has(selectedFolderPath) ? 'Collapse folder' : 'Expand folder'}
            </button>
          )}
          {selectedIsFile && (
            <button
              onClick={() => setExpandedFiles((current) => {
                const next = new Set(current);
                if (next.has(selectedData.id)) next.delete(selectedData.id);
                else next.add(selectedData.id);
                return next;
              })}
              className="text-xs font-medium px-3 py-1 rounded-lg transition-all shrink-0"
              style={{ background: '#0369a1', color: '#fff' }}
            >
              {expandedFiles.has(selectedData.id) ? 'Hide details' : 'Expand details'}
            </button>
          )}
          {!selectedIsFolder && (
            <button
              onClick={() => setScope((current) => current === 'local' ? 'overview' : 'local')}
              className="text-xs font-medium px-3 py-1 rounded-lg transition-all shrink-0"
              style={{ background: '#475569', color: '#fff' }}
            >
              {scope === 'local' ? 'Back to overview' : 'Open local graph'}
            </button>
          )}
        </div>
      )}

      {/* Cytoscape canvas */}
      <div className="flex-1 rounded-xl overflow-hidden" style={gridStyle}>
        <div key="graph-2d" ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};

export default GraphView;
