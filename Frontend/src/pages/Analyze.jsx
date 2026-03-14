import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderTree, Loader2 } from 'lucide-react';
import { useGetGraphQuery } from '../store/slices/apiSlice';

const MAX_TREE_LINES = 14;
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
    const isDir = Object.keys(child.children || {}).length > 0;
    
    lines.push({ prefix: `${prefix}${connector}`, name, isDir });
    buildTreePreviewLines(child, depth + 1, `${prefix}${isLast ? '    ' : '│   '}`, lines);
  });

  if (depth === 0 && entries.length === 0) {
    lines.push({ prefix: '└── ', name: '(empty)', isDir: false });
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
        treePreview: clipped ? [...lines.slice(0, MAX_TREE_LINES - 1), { prefix: '└── ', name: '…', isDir: false }] : lines,
      };
    });
};

export default function Analyze() {
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
    <div className="min-h-screen bg-[#FCFCFC] text-slate-900 font-sans -m-4 sm:-m-6">
      <div className="max-w-6xl mx-auto py-12 px-4 flex flex-col gap-10">
        
        {/* The Header Area */}
        <div className="flex flex-col items-center text-center space-y-4">
          <button
            onClick={() => navigate('/upload')}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Upload
          </button>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Analyze Repository Structure</h1>
            <p className="text-base text-slate-600 font-medium">Top-level directories from your scanned repository</p>
          </div>
        </div>

        {/* Loading / Empty States */}
        {!currentRepoId && (
          <div className="bg-white border border-slate-200 rounded-lg py-16 px-4 text-center max-w-2xl mx-auto w-full">
            <p className="text-base font-semibold text-slate-900 mb-2">No repository active</p>
            <p className="text-sm text-slate-500 mb-6">Upload and scan a repository to start analyzing the dependency graph.</p>
            <button
              onClick={() => navigate('/upload')}
              className="inline-flex items-center justify-center bg-indigo-700 hover:bg-indigo-800 text-white px-6 py-2.5 rounded text-sm font-medium transition-colors"
            >
              Go to Upload
            </button>
          </div>
        )}

        {currentRepoId && isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
            <p className="text-sm font-medium">Extracting directory structure...</p>
          </div>
        )}

        {currentRepoId && !isLoading && cards.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-lg py-16 px-4 text-center max-w-2xl mx-auto w-full">
            <p className="text-base font-semibold text-slate-900 mb-2">No directory data found</p>
            <p className="text-sm text-slate-500">
              The scan completed but did not output structured file paths. Try re-scanning.
            </p>
          </div>
        )}

        {/* The Three-Column Grid */}
        {currentRepoId && !isLoading && cards.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 w-full max-w-7xl mx-auto">
            {cards.map((card) => (
              <button
                key={card.root}
                onClick={() => navigate(`/analyze/dir/${encodeURIComponent(card.root)}`)}
                className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col text-left relative transition-all duration-300 ease-out hover:scale-[1.03] hover:z-10 hover:border-indigo-600 hover:shadow-md will-change-transform outline-none"
              >
                {/* Status Badge */}
                <div className="absolute top-6 right-6">
                  <span className="inline-flex items-center px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold tracking-wider uppercase border border-emerald-200 rounded">
                    Ready
                  </span>
                </div>

                <div className="mb-4 pr-16 w-full">
                  <div className="flex items-center gap-2 mb-1.5 w-full">
                    <FolderTree className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                    <h3 className="text-lg font-bold text-slate-900 truncate">
                      {card.root}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">
                    {card.fileCount} file{card.fileCount !== 1 ? 's' : ''} • click to explore
                  </p>
                </div>

                <div className="w-full bg-slate-50 border border-slate-200 rounded-md p-4 overflow-hidden mt-auto">
                  <div className="text-[13px] font-mono leading-relaxed whitespace-pre overflow-x-auto min-h-[5rem]">
                    <div className="font-bold text-slate-900">{card.root}/</div>
                    {card.treePreview.map((line, idx) => (
                      <div key={idx} className="flex min-w-full">
                        <span className="text-slate-400 select-none pointer-events-none pr-1">{line.prefix.replace(/ /g, '\u00A0')}</span>
                        <span className={`${line.isDir ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                          {line.name}{line.isDir ? '/' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}