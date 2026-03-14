import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderTree, Loader2 } from 'lucide-react';
import { useGetGraphQuery } from '../store/slices/apiSlice';

const MAX_TREE_LINES = 16;
const MAX_TREE_DEPTH = 4;

const normalizePath = (value) => (value || '').replace(/\\/g, '/').replace(/^\/+/, '');

const buildTreePreviewLines = (node, depth = 0, prefix = '', lines = []) => {
  if (depth >= MAX_TREE_DEPTH || lines.length >= MAX_TREE_LINES) {
    return lines;
  }

  const entries = Object.entries(node.children || {}).sort(([a], [b]) => a.localeCompare(b));

  entries.forEach(([name, child], index) => {
    if (lines.length >= MAX_TREE_LINES) return;
    const isLast = index === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    lines.push(`${prefix}${connector}${name}${Object.keys(child.children || {}).length > 0 ? '/' : ''}`);
    buildTreePreviewLines(child, depth + 1, `${prefix}${isLast ? '    ' : '│   '}`, lines);
  });

  if (depth === 0 && entries.length === 0) {
    lines.push('└── (empty)');
  }

  return lines;
};

const buildDirectoryCards = (nodes = []) => {
  const rootMap = {};

  nodes.forEach((node) => {
    const rawPath = node?.type === 'FILE' ? node?.name : node?.file;
    const normalized = normalizePath(rawPath);
    if (!normalized.includes('/')) return;

    const parts = normalized.split('/').filter(Boolean);
    if (parts.length < 2) return;

    const root = parts[0];
    const rest = parts.slice(1);
    if (!rootMap[root]) {
      rootMap[root] = {
        root,
        fileCount: 0,
        tree: { children: {} },
      };
    }

    rootMap[root].fileCount += 1;

    let cursor = rootMap[root].tree;
    rest.forEach((part) => {
      if (!cursor.children[part]) cursor.children[part] = { children: {} };
      cursor = cursor.children[part];
    });
  });

  return Object.values(rootMap)
    .sort((a, b) => a.root.localeCompare(b.root))
    .map((entry) => {
      const lines = buildTreePreviewLines(entry.tree);
      const clipped = lines.length >= MAX_TREE_LINES;

      return {
        root: entry.root,
        fileCount: entry.fileCount,
        treePreview: clipped ? [...lines.slice(0, MAX_TREE_LINES - 1), '└── …'] : lines,
      };
    });
};

const Analyze = () => {
  const navigate = useNavigate();
  const currentRepoId = useSelector((s) => s.graph.currentRepoId);

  const { data: fetchedGraphData, isLoading } = useGetGraphQuery(currentRepoId, {
    skip: !currentRepoId,
  });

  const cards = useMemo(() => {
    const nodes = fetchedGraphData?.nodes || [];
    return buildDirectoryCards(nodes);
  }, [fetchedGraphData]);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <button
        onClick={() => navigate('/upload')}
        className="flex items-center gap-1.5 text-xs transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={13} /> Back to Upload
      </button>

      <div className="card">
        <div className="flex items-center gap-2">
          <FolderTree size={16} style={{ color: '#3b82f6' }} />
          <h2 className="font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>
            Analyze Repository Structure
          </h2>
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Top-level directories from your scanned repository with tree previews.
        </p>
      </div>

      {!currentRepoId && (
        <div className="card text-center py-8">
          <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>No repository scanned yet</p>
          <button onClick={() => navigate('/upload')} className="text-xs mt-2" style={{ color: '#3b82f6' }}>
            Upload and scan a repo →
          </button>
        </div>
      )}

      {currentRepoId && isLoading && (
        <div className="card flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={14} className="animate-spin" /> Loading directory structure…
        </div>
      )}

      {currentRepoId && !isLoading && cards.length === 0 && (
        <div className="card text-center py-8">
          <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>No directory data found</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Scan output does not include file paths yet.
          </p>
        </div>
      )}

      {currentRepoId && !isLoading && cards.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <div key={card.root} className="card space-y-2">
              <div>
                <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>
                  {card.root}
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {card.fileCount} file{card.fileCount > 1 ? 's' : ''}
                </p>
              </div>
              <pre
                className="text-xs code-text rounded-lg p-2 overflow-auto"
                style={{
                  background: 'var(--bg-muted)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  maxHeight: '16rem',
                }}
              >
{card.root}/
{card.treePreview.join('\n')}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Analyze;