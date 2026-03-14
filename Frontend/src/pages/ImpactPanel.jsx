import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Zap, GitBranch, Database, Code2, Globe, ChevronRight, Search, ArrowLeft } from 'lucide-react';
import { setSelectedNode, clearSelection } from '../store/index';
import { NODE_TYPE_CONFIG } from '../assets/mockdata';

const TYPE_ICONS = {
  service:  GitBranch,
  schema:   Database,
  api:      Globe,
  frontend: Code2,
};

const ImpactBadge = ({ level }) => {
  const config = {
    selected:    { label: 'Origin',    bg: 'rgba(239,68,68,0.12)',   color: '#ef4444' },
    direct:      { label: 'Direct',    bg: 'rgba(249,115,22,0.12)',  color: '#f97316' },
    transitive:  { label: 'Transitive',bg: 'rgba(234,179,8,0.12)',   color: '#eab308' },
  }[level] || {};
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
      style={{ background: config.bg, color: config.color }}
    >
      {config.label}
    </span>
  );
};

const NodeRow = ({ node, level, onSelect, isSelected }) => {
  const Icon = TYPE_ICONS[node.type] || Code2;
  const cfg  = NODE_TYPE_CONFIG[node.type] || {};

  return (
    <button
      onClick={() => onSelect(node.id)}
      className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
      style={{
        background: isSelected ? `${cfg.border || '#3b82f6'}10` : 'transparent',
        border: `1px solid ${isSelected ? (cfg.border || '#3b82f6') + '40' : 'transparent'}`,
      }}
    >
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: `${cfg.border || '#3b82f6'}18`, color: cfg.border || '#3b82f6' }}
      >
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium code-text truncate" style={{ color: 'var(--text)' }}>
          {node.label}
        </p>
        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
          {node.lang} · {node.path}
        </p>
      </div>
      <ImpactBadge level={level} />
      <ChevronRight size={14} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
    </button>
  );
};

const ImpactPanel = () => {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();

  const graphData        = useSelector((s) => s.graph.graphData);
  const selectedNodeId   = useSelector((s) => s.graph.selectedNode);
  const directImpact     = useSelector((s) => s.graph.directImpact);
  const transitiveImpact = useSelector((s) => s.graph.transitiveImpact);

  const [search, setSearch] = useState('');

  const getNode = (id) => graphData.nodes.find((n) => n.id === id);

  const selectedData     = selectedNodeId ? getNode(selectedNodeId) : null;
  const directNodes      = directImpact.map(getNode).filter(Boolean);
  const transitiveNodes  = transitiveImpact.map(getNode).filter(Boolean);

  const filterNodes = (nodes) =>
    search
      ? nodes.filter((n) =>
          n.label.toLowerCase().includes(search.toLowerCase()) ||
          n.lang.toLowerCase().includes(search.toLowerCase()) ||
          n.type.toLowerCase().includes(search.toLowerCase())
        )
      : nodes;

  const handleNodeClick = (id) => {
    if (id === selectedNodeId) dispatch(clearSelection());
    else dispatch(setSelectedNode(id));
  };

  // Node picker — shown when nothing selected
  const allNodes = graphData.nodes;
  const filteredAll = filterNodes(allNodes);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Back to graph */}
      <button
        onClick={() => navigate('/graph')}
        className="flex items-center gap-1.5 text-xs transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={13} /> Back to Graph View
      </button>

      {/* Search */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <Search size={14} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nodes by name, language or type…"
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--text)' }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            Clear
          </button>
        )}
      </div>

      {!selectedNodeId ? (
        /* ── Node picker ── */
        <div className="card space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={15} style={{ color: '#f59e0b' }} />
            <h2 className="font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>
              Select a node to simulate impact
            </h2>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            Click any node below to see what changes in your codebase when you modify it.
          </p>
          <div className="space-y-0.5 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
            {filteredAll.map((node) => (
              <NodeRow
                key={node.id}
                node={node}
                level="direct"
                onSelect={handleNodeClick}
                isSelected={false}
              />
            ))}
            {filteredAll.length === 0 && (
              <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
                No nodes match "{search}"
              </p>
            )}
          </div>
        </div>
      ) : (
        /* ── Impact results ── */
        <div className="space-y-4">
          {/* Selected origin */}
          <div
            className="card"
            style={{ borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.04)' }}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: '#ef444418', color: '#ef4444' }}>
                <Zap size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold code-text" style={{ color: 'var(--text)' }}>
                    {selectedData?.label}
                  </p>
                  <ImpactBadge level="selected" />
                </div>
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                  {selectedData?.lang} · {selectedData?.type} · {selectedData?.path}
                </p>
                <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                  {selectedData?.description}
                </p>
              </div>
              <button
                onClick={() => dispatch(clearSelection())}
                className="text-xs px-2 py-1 rounded flex-shrink-0"
                style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)' }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Impact summary bar */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Direct Impacts',     value: directNodes.length,     color: '#f97316' },
              { label: 'Transitive Impacts', value: transitiveNodes.length,  color: '#eab308' },
              { label: 'Total Affected',     value: directNodes.length + transitiveNodes.length, color: '#ef4444' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card py-3 text-center">
                <p className="text-xl font-display font-bold" style={{ color }}>{value}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Direct impacts */}
          {directNodes.length > 0 && (
            <div className="card space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#f97316' }}>
                Direct Impacts ({directNodes.length})
              </h3>
              <div className="space-y-0.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                {filterNodes(directNodes).map((node) => (
                  <NodeRow
                    key={node.id}
                    node={node}
                    level="direct"
                    onSelect={handleNodeClick}
                    isSelected={node.id === selectedNodeId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Transitive impacts */}
          {transitiveNodes.length > 0 && (
            <div className="card space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#eab308' }}>
                Transitive Impacts ({transitiveNodes.length})
              </h3>
              <div className="space-y-0.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                {filterNodes(transitiveNodes).map((node) => (
                  <NodeRow
                    key={node.id}
                    node={node}
                    level="transitive"
                    onSelect={handleNodeClick}
                    isSelected={node.id === selectedNodeId}
                  />
                ))}
              </div>
            </div>
          )}

          {directNodes.length === 0 && transitiveNodes.length === 0 && (
            <div className="card text-center py-8">
              <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>No downstream impacts found</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                This node has no outgoing dependencies in the current graph.
              </p>
            </div>
          )}

          {/* CTA to graph */}
          <button
            onClick={() => navigate('/graph')}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            <GitBranch size={14} />
            View highlighted in Graph
          </button>
        </div>
      )}
    </div>
  );
};

export default ImpactPanel;
