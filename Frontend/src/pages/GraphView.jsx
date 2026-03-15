import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import { Filter, RefreshCw, ZoomIn, ZoomOut, Maximize2, Info, Search, MessageCircle, X } from 'lucide-react';
import { setSelectedNode, clearSelection, setGraphData, setFilterLangs, setFilterTypes, applyGraphPatch } from '../store/index';
import { apiSlice, useGetGraphQuery } from '../store/slices/apiSlice';
import serviceIcon from '../assets/Icons/Service.svg';
import fileIcon from '../assets/Icons/File.svg';
import functionIcon from '../assets/Icons/Function.svg';
import apiEndpointIcon from '../assets/Icons/APIEndpoint.svg';
import dbTableIcon from '../assets/Icons/DBTable.svg';
import dbFieldIcon from '../assets/Icons/DBField.svg';
import apiContractIcon from '../assets/Icons/APIContract.svg';
import { buildDisplayGraph, computeNodeSizesByDepth, getDefaultVisibleTypes, normalizeEdgeType, normalizeNodeType } from './graphViewUtils';
import { buildFileGraph, computeFileSizes } from './buildFileGraph';
import DependencyChatPanel from '../components/ui/DependencyChatPanel';

cytoscape.use(fcose);

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
const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const LEGACY_EDGE_TYPE_CONFIG = {
  CALLS: { color: '#3b82f6', style: 'solid', label: 'Calls' },
  USES_FIELD: { color: '#f59e0b', style: 'dashed', label: 'Uses Field' },
  IMPLEMENTS: { color: '#22c55e', style: 'solid', label: 'Implements' },
  CONSUMES: { color: '#a855f7', style: 'dotted', label: 'Consumes' },
};

const CLUSTER_CONFIG = {
  Frontend: { color: '#0369a1', border: '#38bdf8', bg: 'rgba(14,165,233,0.05)' },
  Backend: { color: '#15803d', border: '#4ade80', bg: 'rgba(34,197,94,0.05)' },
  Database: { color: '#b45309', border: '#fbbf24', bg: 'rgba(245,158,11,0.05)' },
  'AI Engine': { color: '#7c3aed', border: '#c084fc', bg: 'rgba(168,85,247,0.05)' },
  Workers: { color: '#be123c', border: '#fb7185', bg: 'rgba(244,63,94,0.05)' },
  Tests: { color: '#475569', border: '#94a3b8', bg: 'rgba(148,163,184,0.05)' },
  Utilities: { color: '#0f766e', border: '#2dd4bf', bg: 'rgba(20,184,166,0.05)' },
  Core: { color: '#1d4ed8', border: '#60a5fa', bg: 'rgba(96,165,250,0.05)' },
  Other: { color: '#334155', border: '#64748b', bg: 'rgba(100,116,139,0.05)' },
};

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

const buildFileCyStyle = () => [
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
      padding: '45px',
      'min-width': '120px',
      'min-height': '80px',
      'compound-sizing-wrt-labels': 'include',
    },
  },
  {
    selector: 'node[type = "file"]',
    style: {
      shape: 'round-rectangle',
      width: 'data(nodeSize)',
      height: 'data(nodeSize)',
      'background-image': 'data(icon)',
      'background-fit': 'cover',
      'background-opacity': 0,
      'border-width': '1.5px',
      'border-color': 'data(borderColor)',
      label: '',
      'text-valign': 'bottom',
      'text-halign': 'center',
      'font-size': '8px',
      'font-family': 'monospace',
      color: '#94a3b8',
      'text-margin-y': '4px',
      'overlay-opacity': 0,
    },
  },
  {
    selector: 'node[type = "file"].show-label',
    style: {
      label: 'data(label)',
    },
  },
  {
    selector: 'node[type = "file"].dependency-parent',
    style: {
      shape: 'round-rectangle',
      width: '80px',
      height: '55px',
      'background-image': 'none',
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
      padding: '50px',
      'min-width': '140px',
      'min-height': '90px',
      'compound-sizing-wrt-labels': 'include',
    },
  },
  {
    selector: 'node[type = "file"].dependency-imports',
    style: {
      'border-width': '2px',
      'border-color': '#3b82f6',
    },
  },
  {
    selector: 'node[type = "file"].dependency-importers',
    style: {
      'border-width': '2px',
      'border-color': '#f97316',
    },
  },
  {
    selector: 'node[type = "file"].dependency-bidirectional',
    style: {
      'border-width': '2px',
      'border-color': '#a855f7',
    },
  },
  {
    selector: 'node[type = "function"]',
    style: {
      shape: 'ellipse',
      width: 22,
      height: 22,
      'background-color': '#22c55e',
      'border-width': '1px',
      'border-color': '#15803d',
      label: 'data(label)',
      'font-size': '7px',
      'font-family': 'monospace',
      color: '#94a3b8',
      'text-valign': 'bottom',
      'text-margin-y': '3px',
      'overlay-opacity': 0,
    },
  },
  {
    selector: 'edge',
    style: {
      width: 'mapData(count, 1, 5, 1.2, 3.5)',
      'line-color': '#334155',
      'target-arrow-color': '#334155',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      opacity: 0.5,
    },
  },
  {
    selector: 'edge[edgeType = "IMPORTS"]',
    style: {
      'line-color': '#3b82f6',
      'target-arrow-color': '#3b82f6',
    },
  },
  {
    selector: 'edge[edgeType = "CALLS"]',
    style: {
      'line-color': '#22c55e',
      'target-arrow-color': '#22c55e',
      'line-style': 'dashed',
    },
  },
  {
    selector: 'edge.dependency-outgoing',
    style: {
      'line-color': '#3b82f6',
      'target-arrow-color': '#3b82f6',
      'line-style': 'solid',
      opacity: 0.7,
    },
  },
  {
    selector: 'edge.dependency-incoming',
    style: {
      'line-color': '#f97316',
      'target-arrow-color': '#f97316',
      'line-style': 'dashed',
      opacity: 0.7,
    },
  },
  { selector: 'node.selected', style: { 'border-width': '3px', 'border-color': '#ef4444', 'overlay-color': '#ef4444', 'overlay-opacity': 0.08 } },
  { selector: 'node.direct-impact', style: { 'border-width': '3px', 'border-color': '#f97316', 'overlay-color': '#f97316', 'overlay-opacity': 0.08 } },
  { selector: 'node.transitive-impact', style: { 'border-width': '2px', 'border-color': '#eab308', 'overlay-color': '#eab308', 'overlay-opacity': 0.06 } },
  { selector: 'node.search-match', style: { 'border-width': '3px', 'border-color': '#38bdf8' } },
  { selector: 'node.dimmed', style: { opacity: 0.18 } },
  { selector: 'edge.dimmed', style: { opacity: 0.06 } },
];

const GraphView = () => {
  const dispatch     = useDispatch();
  const navigate     = useNavigate();
  const cyRef        = useRef(null);
  const containerRef = useRef(null);
  const layoutKeyRef = useRef('');
  const selectedNodeRef = useRef(null);
  const showAllLabelsRef = useRef(false);
  const graphModeRef = useRef('files');
  const graphDataRef = useRef({ nodes: [], edges: [] });
  const graphNodeIdsRef = useRef(new Set());
  const fileGraphRef = useRef(null);
  const drillDownFileIdRef = useRef(null);

  const selectedNode      = useSelector((s) => s.graph.selectedNode);
  const themeMode         = useSelector((s) => s.theme.mode);
  const filterTypes       = useSelector((s) => s.graph.filterTypes);
  const filterLangs       = useSelector((s) => s.graph.filterLangs);
  const currentRepoId     = useSelector((s) => s.graph.currentRepoId);
  const currentScanId     = useSelector((s) => s.graph.currentScanId);
  const storedGraphData   = useSelector((s) => s.graph.graphData);
  const graphDataRepoId   = useSelector((s) => s.graph.graphDataRepoId);
  // Wire up BFS results computed by graphSlice so the canvas highlighting is live
  const directImpact      = useSelector((s) => s.graph.directImpact);
  const transitiveImpact  = useSelector((s) => s.graph.transitiveImpact);

  // Fetch graph using the repoId from scan result
  const { data: fetchedGraphData, isLoading } = useGetGraphQuery(currentRepoId, {
    skip: !currentRepoId,
  });
  const graphData = useMemo(() => {
    if (graphDataRepoId === currentRepoId) {
      return storedGraphData || { nodes: [], edges: [] };
    }
    return fetchedGraphData || { nodes: [], edges: [] };
  }, [currentRepoId, fetchedGraphData, graphDataRepoId, storedGraphData]);
  const nodeTypes = useMemo(() => NODE_TYPES, []);
  const [graphMode, setGraphMode] = useState('files');
  const [drillDownFileId, setDrillDownFileId] = useState(null);
  const [hideSingletons, setHideSingletons] = useState(false);
  const [hiddenClusters, setHiddenClusters] = useState(new Set());
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
  const [chatOpen, setChatOpen] = useState(false);
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

  const fileGraph = useMemo(() => {
    if (graphMode !== 'files') return null;
    return buildFileGraph(graphData);
  }, [graphData, graphMode]);

  const fileSizes = useMemo(() => {
    if (!fileGraph) return new Map();
    return computeFileSizes(fileGraph.fileNodes, fileGraph.fileEdges);
  }, [fileGraph]);

  const fileCyElements = useMemo(() => {
    if (!fileGraph || graphMode !== 'files') return null;

    if (drillDownFileId) {
      const parentFile = fileGraph.fileNodes.find((node) => node.id === drillDownFileId);
      if (!parentFile) return [];

      const dependencyEdges = fileGraph.fileEdges.filter((edge) => edge.source === drillDownFileId || edge.target === drillDownFileId);
      const importedIds = new Set();
      const importerIds = new Set();
      dependencyEdges.forEach((edge) => {
        if (edge.source === drillDownFileId) importedIds.add(edge.target);
        if (edge.target === drillDownFileId) importerIds.add(edge.source);
      });

      const dependencyNodeIds = new Set([...importedIds, ...importerIds]);
      const groupByNodeId = new Map();
      dependencyNodeIds.forEach((nodeId) => {
        const isImported = importedIds.has(nodeId);
        const isImporter = importerIds.has(nodeId);
        if (isImported && isImporter) groupByNodeId.set(nodeId, 'bidirectional');
        else if (isImported) groupByNodeId.set(nodeId, 'imports');
        else groupByNodeId.set(nodeId, 'importers');
      });

      const dependentFiles = fileGraph.fileNodes
        .filter((node) => dependencyNodeIds.has(node.id))
        .sort((a, b) => a.label.localeCompare(b.label));

      const grouped = { imports: [], importers: [], bidirectional: [] };
      dependentFiles.forEach((node) => {
        const group = groupByNodeId.get(node.id) || 'imports';
        grouped[group].push(node);
      });

      const parentCfg = CLUSTER_CONFIG[parentFile.cluster] || CLUSTER_CONFIG.Other;
      const elements = [];

      elements.push({
        data: {
          id: drillDownFileId,
          label: parentFile.label,
          type: 'file',
          path: parentFile.path,
          lang: parentFile.lang,
          cluster: parentFile.cluster,
          borderColor: parentCfg.border,
          bgColor: parentCfg.bg,
          nodeSize: 48,
        },
        position: { x: 0, y: 0 },
        classes: 'dependency-parent selected show-label',
      });

      const spacingY = 85;
      const groupX = {
        imports: -220,
        bidirectional: 0,
        importers: 220,
      };

      const buildPosition = (group, index, count) => {
        const offset = (index - (count - 1) / 2) * spacingY;
        return { x: groupX[group], y: offset + 30 };
      };

      ['imports', 'bidirectional', 'importers'].forEach((group) => {
        grouped[group].forEach((node, index) => {
          const cfg = CLUSTER_CONFIG[node.cluster] || CLUSTER_CONFIG.Other;
          const className = group === 'imports'
            ? 'dependency-imports'
            : group === 'importers'
              ? 'dependency-importers'
              : 'dependency-bidirectional';

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
              parent: drillDownFileId,
              dependencyGroup: group,
            },
            position: buildPosition(group, index, grouped[group].length),
            classes: `show-label ${className}`,
          });
        });
      });

      dependencyEdges.forEach((edge) => {
        const directionClass = edge.source === drillDownFileId ? 'dependency-outgoing' : 'dependency-incoming';
        elements.push({
          data: { ...edge, count: edge.count || 1 },
          classes: directionClass,
        });
      });

      return elements;
    }

    let visibleFiles = fileGraph.fileNodes.filter((node) => !hiddenClusters.has(node.cluster));
    if (filterLangs.length > 0) {
      const langSet = new Set(filterLangs);
      visibleFiles = visibleFiles.filter((node) => langSet.has(node.lang));
    }

    if (hideSingletons) {
      const connected = new Set();
      fileGraph.fileEdges.forEach((edge) => {
        connected.add(edge.source);
        connected.add(edge.target);
      });
      visibleFiles = visibleFiles.filter((node) => connected.has(node.id));
    }

    const visibleFileIds = new Set(visibleFiles.map((node) => node.id));
    const elements = [];
    const clusterIds = new Set();

    fileGraph.clusters.forEach((cluster) => {
      if (hiddenClusters.has(cluster.label)) return;
      const hasVisible = visibleFiles.some((node) => node.cluster === cluster.label);
      if (!hasVisible) return;

      const cfg = CLUSTER_CONFIG[cluster.label] || CLUSTER_CONFIG.Other;
      clusterIds.add(cluster.id);
      elements.push({
        data: {
          id: cluster.id,
          label: cluster.label,
          type: 'cluster',
          borderColor: cfg.border,
          bgColor: cfg.bg,
        },
        classes: 'cluster-parent',
      });
    });

    visibleFiles.forEach((node) => {
      const cfg = CLUSTER_CONFIG[node.cluster] || CLUSTER_CONFIG.Other;
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
    });

    fileGraph.fileEdges.forEach((edge) => {
      if (visibleFileIds.has(edge.source) && visibleFileIds.has(edge.target)) {
        elements.push({ data: { ...edge, count: edge.count || 1 } });
      }
    });

    return elements;
  }, [fileGraph, graphMode, drillDownFileId, hideSingletons, hiddenClusters, fileSizes, filterLangs]);

  const edgeConfig = useMemo(() => {
    const present = new Set(displayGraph.links.map((edge) => edge.edgeType || 'RELATED'));
    const merged = { ...LEGACY_EDGE_TYPE_CONFIG };
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

  const fileOverviewNodes = useMemo(() => {
    if (!fileGraph) return [];
    return fileGraph.fileNodes.filter((node) => {
      if (hiddenClusters.has(node.cluster)) return false;
      if (filterLangs.length > 0 && !filterLangs.includes(node.lang)) return false;
      if (!hideSingletons) return true;
      const connected = fileGraph.fileEdges.some((edge) => edge.source === node.id || edge.target === node.id);
      return connected;
    });
  }, [fileGraph, filterLangs, hiddenClusters, hideSingletons]);

  const searchMatches = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return [];
    if (graphMode === 'files') {
      const sourceNodes = drillDownFileId
        ? (fileCyElements || []).filter((item) => item?.data?.type === 'file' || item?.data?.type === 'function').map((item) => item.data)
        : fileOverviewNodes;
      return sourceNodes
        .filter((node) => `${node.label || ''} ${node.path || ''}`.toLowerCase().includes(query))
        .map((node) => node.id);
    }

    return displayGraph.nodes
      .filter((node) => `${node.label} ${node.path || ''}`.toLowerCase().includes(query))
      .map((node) => node.id);
  }, [displayGraph, searchText, graphMode, fileCyElements, drillDownFileId, fileOverviewNodes]);

  const selectedData = useMemo(() => {
    if (!selectedNode) return null;
    if (graphMode === 'files') {
      return fileGraph?.fileNodes.find((node) => node.id === selectedNode) || null;
    }
    return displayGraph.nodes.find((node) => node.id === selectedNode) || graphData.nodes.find((node) => node.id === selectedNode) || null;
  }, [selectedNode, graphMode, fileGraph, displayGraph, graphData]);

  const selectedIsFolder = Boolean(selectedData?.isSynthetic && selectedData?.type === 'folder');
  const selectedFolderPath = selectedIsFolder ? selectedData.path : null;
  const selectedIsFile = selectedData?.type === 'file' && !selectedData?.isSynthetic;

  useEffect(() => {
    if (graphMode === 'files') return;
    if (scope === 'local' && selectedNode) return;
    if (!selectedNode) setScope('overview');
  }, [selectedNode, scope, graphMode]);

  useEffect(() => {
    if (graphMode === 'files') return;
    if (scope === 'local' && selectedNode && !graphNodeIds.has(selectedNode)) {
      setScope('overview');
    }
  }, [graphNodeIds, scope, selectedNode, graphMode]);

  const gridStyle = useMemo(() => {
    const z = Math.max(0.2, Math.min(3, viewportZoom));
    const major = Math.max(40, Math.round(80 * z));
    const minor = Math.max(10, Math.round(20 * z));
    const majorAlpha = Math.min(0.8, 0.8 + z * 0.03);
    const minorAlpha = Math.min(0.6, 0.6 + z * 0.02);
    const gridRgb = '226,232,240'; // slate-200

    return {
      backgroundColor: '#f8fafc',
      backgroundImage:
        `linear-gradient(rgba(${gridRgb},${majorAlpha}) 1px, transparent 1px), ` +
        `linear-gradient(90deg, rgba(${gridRgb},${majorAlpha}) 1px, transparent 1px), ` +
        `linear-gradient(rgba(${gridRgb},${minorAlpha}) 1px, transparent 1px), ` +
        `linear-gradient(90deg, rgba(${gridRgb},${minorAlpha}) 1px, transparent 1px)`,
      backgroundSize: `${major}px ${major}px, ${major}px ${major}px, ${minor}px ${minor}px, ${minor}px ${minor}px`,
      border: '1px solid #e2e8f0', // slate-200
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
    if (currentRepoId && fetchedGraphData) {
      dispatch(setGraphData({ repoId: currentRepoId, graphData: fetchedGraphData }));
    }
  }, [currentRepoId, fetchedGraphData, dispatch]);

  useEffect(() => {
    if (!currentRepoId) {
      return undefined;
    }

    const eventSource = new EventSource(`${API_BASE_URL}/events/${currentRepoId}`);

    eventSource.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'GRAPH_PATCH') {
        dispatch(applyGraphPatch({ repoId: currentRepoId, patch: message.patch }));
      }

      if (message.type === 'SCAN_COMPLETE') {
        dispatch(apiSlice.util.invalidateTags(['Graph']));
      }

      if (message.type === 'SYNC_ERROR') {
        console.error('Live sync error:', message.error);
      }
    };

    eventSource.onerror = () => {
      console.warn('SSE connection lost, browser will retry...');
    };

    return () => eventSource.close();
  }, [currentRepoId, dispatch]);

  useEffect(() => {
    selectedNodeRef.current = selectedNode;
    showAllLabelsRef.current = showAllLabels;
    graphModeRef.current = graphMode;
    graphDataRef.current = graphData;
    graphNodeIdsRef.current = graphNodeIds;
    fileGraphRef.current = fileGraph;
    drillDownFileIdRef.current = drillDownFileId;
  }, [selectedNode, showAllLabels, graphMode, graphData, graphNodeIds, fileGraph, drillDownFileId]);

  useEffect(() => {
    layoutKeyRef.current = '';
  }, [graphMode, drillDownFileId]);

  useEffect(() => {
    if (!containerRef.current || cyRef.current) return;
    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: graphMode === 'files' ? buildFileCyStyle() : buildCyStyle(['folder', ...nodeTypes], edgeConfig),
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
      const type = evt.target.data('type');
      const mode = graphModeRef.current;

      if (mode === 'files') {
        if (type === 'cluster') return;
        if (type !== 'file') return;

        const payloadGraph = fileGraphRef.current
          ? { nodes: fileGraphRef.current.fileNodes, edges: fileGraphRef.current.fileEdges }
          : { nodes: [], edges: [] };

        dispatch(setSelectedNode({ id, graphData: payloadGraph }));
        setDrillDownFileId(id);
        return;
      }

      if (id === selectedNodeRef.current) {
        dispatch(clearSelection());
      } else {
        dispatch(setSelectedNode({ id, graphData: graphDataRef.current }));
        if (graphNodeIdsRef.current.has(id)) {
          setScope('local');
        }
      }
    });
    cy.on('tap', (evt) => {
      if (evt.target === cy) dispatch(clearSelection());
    });
    cy.on('mouseover', 'node', (evt) => evt.target.addClass('show-label'));
    cy.on('mouseout', 'node', () => {
      const showByZoom = cy.zoom() >= 1.05 || showAllLabelsRef.current;
      cy.nodes().removeClass('show-label');
      if (showByZoom) cy.nodes().addClass('show-label');
      if (selectedNodeRef.current) cy.$id(selectedNodeRef.current).addClass('show-label');
    });
    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [dispatch, edgeConfig, graphMode, nodeTypes]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const nextStyle = graphMode === 'files' ? buildFileCyStyle() : buildCyStyle(['folder', ...nodeTypes], edgeConfig);
    cy.style(nextStyle);
  }, [graphMode, nodeTypes, edgeConfig]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    if (graphMode === 'files') {
      const elements = fileCyElements || [];
      cy.batch(() => {
        cy.elements().remove();
        cy.add(elements);
      });

      const layout = drillDownFileId
        ? {
            name: 'preset',
            animate: false,
            fit: true,
            padding: 60,
          }
        : {
            name: 'fcose',
            animate: false,
            randomize: true,
            idealEdgeLength: 180,
            nodeRepulsion: () => 6500,
            edgeElasticity: () => 0.45,
            nestingFactor: 0.1,
            gravity: 0.25,
            gravityRange: 3.8,
            gravityCompound: 1.0,
            gravityRangeCompound: 1.5,
            numIter: 2500,
            tile: true,
            tilingPaddingVertical: 40,
            tilingPaddingHorizontal: 40,
            fit: true,
            padding: 60,
            uniformNodeDimensions: false,
          };

      const layoutKey = `files-${drillDownFileId || 'overview'}-${elements.length}`;
      if (layoutKey !== layoutKeyRef.current) {
        layoutKeyRef.current = layoutKey;
        cy.layout(layout).run();
        setViewportZoom(Number(cy.zoom().toFixed(2)));
      }
      return;
    }

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
  }, [graphMode, fileCyElements, drillDownFileId, displayGraph, scope, perspective]);

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
    setDrillDownFileId(null);
    setExpandedFolders(new Set());
    setExpandedFiles(new Set());
    setHiddenClusters(new Set());
    setHideSingletons(false);
    setSearchText('');
    cyRef.current?.fit(undefined, 30);
  };
  const handleSearchFocus = () => {
    const match = searchMatches[0];
    if (!match) return;
    if (graphMode === 'files' && fileGraph) {
      dispatch(setSelectedNode({
        id: match,
        graphData: {
          nodes: fileGraph.fileNodes,
          edges: fileGraph.fileEdges,
        },
      }));
      return;
    }

    dispatch(setSelectedNode({ id: match, graphData }));
    if (graphNodeIds.has(match)) setScope('local');
  };

  const shownNodesCount = graphMode === 'files'
    ? (fileCyElements || []).filter((item) => item?.data && !item?.data?.source && !item?.data?.target && item?.data?.type !== 'cluster').length
    : displayGraph.nodes.length;

  const shownEdgesCount = graphMode === 'files'
    ? (fileCyElements || []).filter((item) => item?.data?.source && item?.data?.target).length
    : displayGraph.links.length;

  return (
    <div className="flex flex-col gap-3 relative" style={{ height: 'calc(100vh - 7rem)' }}>
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
          <button onClick={handleZoomIn} className="p-1.5 rounded-md transition-colors" title="Zoom in" style={{ color: 'var(--text-muted)' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-muted)'; e.currentTarget.style.color = 'var(--text)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}><ZoomIn size={15} /></button>
          <button onClick={handleZoomOut} className="p-1.5 rounded-md transition-colors" title="Zoom out" style={{ color: 'var(--text-muted)' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-muted)'; e.currentTarget.style.color = 'var(--text)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}><ZoomOut size={15} /></button>
          <button onClick={handleFit} className="p-1.5 rounded-md transition-colors" title="Fit" style={{ color: 'var(--text-muted)' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-muted)'; e.currentTarget.style.color = 'var(--text)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}><Maximize2 size={15} /></button>
          <button onClick={handleReset} className="p-1.5 rounded-md transition-colors" title="Reset" style={{ color: 'var(--text-muted)' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-muted)'; e.currentTarget.style.color = 'var(--text)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}><RefreshCw size={15} /></button>
        </div>

        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {['files', 'legacy'].map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setGraphMode(mode);
                dispatch(clearSelection());
                setDrillDownFileId(null);
              }}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium"
              style={{
                background: graphMode === mode ? 'rgba(59,130,246,0.12)' : 'transparent',
                color: graphMode === mode ? '#3b82f6' : 'var(--text-muted)',
              }}
            >
              {mode === 'files' ? 'File Graph ✦' : 'Legacy'}
            </button>
          ))}
        </div>

        {graphMode === 'legacy' && (
          <>
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
          </>
        )}

        {graphMode === 'files' && (
          <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            {drillDownFileId && (
              <button
                onClick={() => { setDrillDownFileId(null); dispatch(clearSelection()); }}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
              >
                ← All files
              </button>
            )}
            <button
              onClick={() => setHideSingletons((value) => !value)}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium"
              style={{
                background: hideSingletons ? 'rgba(59,130,246,0.12)' : 'transparent',
                color: hideSingletons ? '#3b82f6' : 'var(--text-muted)',
              }}
            >
              {hideSingletons ? 'Show isolated' : 'Hide isolated'}
            </button>
          </div>
        )}

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
          <span>{shownNodesCount} shown</span>
          <span>{shownEdgesCount} edges</span>
          <span>{graphData.nodes.length} raw</span>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card flex flex-wrap items-center gap-2 py-3">
          {graphMode === 'legacy' ? (
            <>
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
            </>
          ) : (
            <>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Clusters:</span>
              {Object.keys(CLUSTER_CONFIG).map((cluster) => {
                const active = !hiddenClusters.has(cluster);
                const cfg = CLUSTER_CONFIG[cluster] || CLUSTER_CONFIG.Other;
                return (
                  <button
                    key={cluster}
                    onClick={() => {
                      setHiddenClusters((current) => {
                        const next = new Set(current);
                        if (next.has(cluster)) next.delete(cluster);
                        else next.add(cluster);
                        return next;
                      });
                    }}
                    className="text-xs px-2.5 py-1 rounded-full font-medium transition-all"
                    style={{ background: active ? `${cfg.border}20` : 'var(--bg-muted)', color: active ? cfg.border : 'var(--text-muted)', border: `1px solid ${active ? `${cfg.border}60` : 'var(--border)'}` }}
                  >
                    {cluster}
                  </button>
                );
              })}
              {hiddenClusters.size > 0 && (
                <button
                  onClick={() => setHiddenClusters(new Set())}
                  className="text-xs px-2 py-1 rounded-full transition-all"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                >
                  Reset clusters
                </button>
              )}
            </>
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
      {showLegend && graphMode === 'legacy' && (
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

      {showLegend && graphMode === 'files' && (
        <div className="card flex flex-wrap gap-3 py-3">
          {Object.entries(CLUSTER_CONFIG).map(([name, cfg]) => (
            <div key={name} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="w-3 h-3 rounded-sm border-2 inline-block" style={{ borderColor: cfg.border, background: cfg.bg }} />
              {name}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="inline-block w-5" style={{ borderTop: '2px solid #3b82f6' }} /> Imports
          </div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="inline-block w-5" style={{ borderTop: '2px dashed #f97316' }} /> Importers
          </div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="w-3 h-3 rounded-sm border-2 inline-block" style={{ borderColor: '#a855f7' }} /> Bidirectional
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
          {graphMode === 'files' && selectedData.type === 'file' ? (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
              background: (CLUSTER_CONFIG[selectedData.cluster] || CLUSTER_CONFIG.Other).bg,
              color: (CLUSTER_CONFIG[selectedData.cluster] || CLUSTER_CONFIG.Other).border,
            }}>
              {selectedData.cluster}
            </span>
          ) : null}
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {selectedData.lang || selectedData.language || 'mixed'} · {selectedData.type}
            {graphMode === 'files' && selectedData.type === 'file' && fileGraph
              ? ` · ${(fileGraph.fileFunctions.get(selectedData.id) || []).length} functions`
              : ''}
          </span>
          <span className="text-xs flex-1 truncate hidden sm:block" style={{ color: 'var(--text-muted)' }}>{selectedData.path || selectedData.name}</span>

          {graphMode === 'files' && selectedData?.type === 'file' && (
            <button
              onClick={() => setDrillDownFileId(drillDownFileId === selectedData.id ? null : selectedData.id)}
              className="text-xs font-medium px-3 py-1 rounded-lg transition-all shrink-0"
              style={{ background: drillDownFileId === selectedData.id ? '#15803d' : '#0369a1', color: '#fff' }}
            >
              {drillDownFileId === selectedData.id ? '← Back to overview' : 'Drill into file →'}
            </button>
          )}

          {graphMode === 'legacy' && selectedIsFolder && (
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
          {graphMode === 'legacy' && selectedIsFile && (
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
          {graphMode === 'legacy' && !selectedIsFolder && (
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

      {chatOpen && (
        <div
          className="fixed bottom-24 right-4 z-[70] w-[360px] max-w-[calc(100vw-1.5rem)]"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '0.9rem',
            boxShadow: themeMode === 'dark' ? '0 16px 40px rgba(2,6,23,0.65)' : '0 14px 32px rgba(15,23,42,0.20)',
          }}
        >
          <DependencyChatPanel repoId={currentRepoId} scanId={currentScanId} onClose={() => setChatOpen(false)} />
        </div>
      )}

      <button
        type="button"
        aria-label={chatOpen ? 'Close AI chat' : 'Open AI chat'}
        onClick={() => setChatOpen((v) => !v)}
        className="fixed bottom-5 right-4 z-[71] flex h-12 w-12 items-center justify-center rounded-full transition-transform hover:scale-105"
        style={{
          background: 'var(--card)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          boxShadow: themeMode === 'dark' ? '0 10px 24px rgba(2,6,23,0.55)' : '0 10px 24px rgba(15,23,42,0.16)',
        }}
      >
        {chatOpen ? <X size={20} /> : <MessageCircle size={20} />}
      </button>
    </div>
  );
};

export default GraphView;
