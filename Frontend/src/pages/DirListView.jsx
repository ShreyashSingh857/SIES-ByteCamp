import React, { useMemo, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Folder,
  FolderOpen,
  FileCode2,
  FileText,
  FileJson,
  File,
  ChevronRight,
  ChevronDown,
  Github,
  Loader2,
} from 'lucide-react';
import { useGetGraphQuery } from '../store/slices/apiSlice';
import { buildGitHubTreeUrl, normalizeRepoUrl, parseGitHubRepoInfo } from '../lib/utils';

// ─── helpers ────────────────────────────────────────────────────────────────

const normalizePath = (v) => (v || '').replace(/\\/g, '/').replace(/^\/+/, '');

/** Pick an icon for a file based on its extension */
const FileIcon = ({ name, size = 15 }) => {
  const ext = name?.split('.').pop()?.toLowerCase();
  const iconProps = { size, style: { flexShrink: 0 } };

  if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'go', 'rb', 'rs', 'cpp', 'c', 'cs'].includes(ext))
    return <FileCode2 {...iconProps} style={{ ...iconProps.style, color: '#3b82f6' }} />;
  if (['json', 'yaml', 'yml', 'toml', 'env'].includes(ext))
    return <FileJson {...iconProps} style={{ ...iconProps.style, color: '#f59e0b' }} />;
  if (['md', 'txt', 'rst'].includes(ext))
    return <FileText {...iconProps} style={{ ...iconProps.style, color: '#94a3b8' }} />;
  return <File {...iconProps} style={{ ...iconProps.style, color: '#94a3b8' }} />;
};

/** Build a nested tree from flat file paths, rooted under `rootDir` */
const buildTree = (nodes, rootDir) => {
  const tree = {};

  nodes.forEach((node) => {
    const rawPath = node?.type === 'FILE' ? node?.name : node?.file;
    const full = normalizePath(rawPath);
    if (!full.startsWith(`${rootDir}/`) && full !== rootDir) return;

    const relative = full.slice(rootDir.length + 1); // strip "rootDir/"
    if (!relative) return;

    const parts = relative.split('/').filter(Boolean);
    let cursor = tree;
    parts.forEach((part, i) => {
      if (!cursor[part]) {
        cursor[part] = { __isDir: i < parts.length - 1, __children: {}, __fullPath: `${rootDir}/${parts.slice(0, i + 1).join('/')}` };
      }
      if (i < parts.length - 1) cursor[part].__isDir = true;
      cursor = cursor[part].__children;
    });
  });

  return tree;
};

// ─── TreeNode ────────────────────────────────────────────────────────────────

const TreeNode = ({ name, node, depth, dirName, onFileClick }) => {
  const [open, setOpen] = useState(depth < 2); // top 2 levels auto-expanded

  const sortedChildren = useMemo(() => {
    const entries = Object.entries(node.__children || {});
    // dirs first, then files, both alphabetical
    return entries.sort(([aName, aNode], [bName, bNode]) => {
      if (aNode.__isDir !== bNode.__isDir) return aNode.__isDir ? -1 : 1;
      return aName.localeCompare(bName);
    });
  }, [node.__children]);

  const indent = depth * 16;

  if (node.__isDir) {
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-1.5 py-1 px-2 rounded text-left transition-all hover:bg-opacity-80"
          style={{
            paddingLeft: `${8 + indent}px`,
            color: 'var(--text)',
            background: 'transparent',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-muted)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
          {open
            ? <FolderOpen size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
            : <Folder size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />}
          <span className="text-sm font-medium truncate">{name}</span>
        </button>

        {open && (
          <div style={{ borderLeft: '1px solid var(--border)', marginLeft: `${14 + indent}px` }}>
            {sortedChildren.map(([childName, childNode]) => (
              <TreeNode
                key={childName}
                name={childName}
                node={childNode}
                depth={depth + 1}
                dirName={dirName}
                onFileClick={onFileClick}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File row
  return (
    <button
      onClick={() => onFileClick(node.__fullPath)}
      className="w-full flex items-center gap-1.5 py-1 px-2 rounded text-left transition-all"
      style={{
        paddingLeft: `${8 + indent}px`,
        color: 'var(--text-muted)',
        background: 'transparent',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-muted)';
        e.currentTarget.style.color = 'var(--text)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'var(--text-muted)';
      }}
    >
      <span style={{ width: 13, flexShrink: 0 }} /> {/* spacer for chevron col */}
      <FileIcon name={name} />
      <span className="text-sm truncate code-text">{name}</span>
    </button>
  );
};

// ─── DirListView page ────────────────────────────────────────────────────────

const DirListView = () => {
  const navigate = useNavigate();
  const { dirName } = useParams();

  const currentRepoId  = useSelector((s) => s.graph.currentRepoId);
  const currentRepoUrl = useSelector((s) => s.graph.currentRepoUrl);
  const currentRepoBranch = useSelector((s) => s.graph.currentRepoBranch || 'main');

  const { data: graphData, isLoading } = useGetGraphQuery(currentRepoId, {
    skip: !currentRepoId,
  });

  const tree = useMemo(() => {
    const nodes = graphData?.nodes || [];
    return buildTree(nodes, dirName);
  }, [graphData, dirName]);

  const sortedRoot = useMemo(() => {
    const entries = Object.entries(tree);
    return entries.sort(([aName, aNode], [bName, bNode]) => {
      if (aNode.__isDir !== bNode.__isDir) return aNode.__isDir ? -1 : 1;
      return aName.localeCompare(bName);
    });
  }, [tree]);

  const handleFileClick = useCallback((fullPath) => {
    // encode the path so slashes survive as URL segments
    navigate(`/analyze/dir/${encodeURIComponent(dirName)}/file/${fullPath}`);
  }, [navigate, dirName]);

  // extract owner/repo from the GitHub URL for display
  const normalizedRepoUrl = useMemo(() => normalizeRepoUrl(currentRepoUrl), [currentRepoUrl]);
  const repoDisplayName = useMemo(() => {
    const repoInfo = parseGitHubRepoInfo(normalizedRepoUrl);
    return repoInfo ? `${repoInfo.owner}/${repoInfo.repo}` : normalizedRepoUrl || 'repository';
  }, [normalizedRepoUrl]);

  const githubDirUrl = useMemo(() => {
    return buildGitHubTreeUrl(normalizedRepoUrl, currentRepoBranch, dirName);
  }, [normalizedRepoUrl, currentRepoBranch, dirName]);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Breadcrumb nav */}
      <div className="flex items-center gap-2 text-xs flex-wrap" style={{ color: 'var(--text-muted)' }}>
        <button
          onClick={() => navigate('/analyze')}
          className="flex items-center gap-1 hover:text-blue-400 transition-colors"
        >
          <ArrowLeft size={12} /> Analyze
        </button>
        <span>/</span>
        <span className="font-mono font-semibold" style={{ color: 'var(--text)' }}>{dirName}</span>
      </div>

      {/* Header card */}
      <div className="card flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Folder size={16} style={{ color: '#f59e0b' }} />
          <h2 className="font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>
            {dirName}/
          </h2>
          <span className="text-xs code-text" style={{ color: 'var(--text-muted)' }}>
            {repoDisplayName}
          </span>
        </div>
        {githubDirUrl && (
          <a
            href={githubDirUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#3b82f6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <Github size={13} /> View on GitHub
          </a>
        )}
      </div>

      {/* Tree pane */}
      <div
        className="card"
        style={{ padding: '0.5rem 0' }}
      >
        {!currentRepoId && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
            No repository scanned yet.
          </p>
        )}

        {currentRepoId && isLoading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Loader2 size={15} className="animate-spin" /> Loading tree…
          </div>
        )}

        {currentRepoId && !isLoading && sortedRoot.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
            No files found under <span className="code-text">{dirName}/</span>
          </p>
        )}

        {currentRepoId && !isLoading && sortedRoot.length > 0 && (
          <div className="py-1">
            {sortedRoot.map(([childName, childNode]) => (
              <TreeNode
                key={childName}
                name={childName}
                node={childNode}
                depth={0}
                dirName={dirName}
                onFileClick={handleFileClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DirListView;
