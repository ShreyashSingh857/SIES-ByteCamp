import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { useGetFileRelationsQuery, useSeedGraphMutation } from '../store/slices/apiSlice';
import { buildGitHubBlobUrl, buildGitHubRawUrl, normalizeRepoUrl } from '../lib/utils';
import {
  ArrowLeft,
  Github,
  Copy,
  CheckCheck,
  Loader2,
  AlertCircle,
  FileCode2,
  ExternalLink,
  Link2,
  ArrowRight,
} from 'lucide-react';

// ─── helpers ────────────────────────────────────────────────────────────────

const EXT_LANG_MAP = {
  js: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python',
  java: 'java',
  go: 'go', mod: 'go',
  rb: 'ruby',
  rs: 'rust',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp',
  c: 'c',
  cs: 'csharp',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  yaml: 'yaml', yml: 'yaml',
  json: 'json',
  toml: 'ini',
  md: 'markdown',
  html: 'html', htm: 'html',
  css: 'css',
  scss: 'scss',
  sql: 'sql',
  xml: 'xml',
  tf: 'hcl',
  env: 'bash',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  gradle: 'groovy',
};

const getLanguage = (filename = '') => {
  const lower = filename.toLowerCase();
  if (lower === 'dockerfile') return 'dockerfile';
  if (lower === 'makefile') return 'makefile';
  const ext = lower.split('.').pop();
  return EXT_LANG_MAP[ext] || 'plaintext';
};

// ─── FileViewer ──────────────────────────────────────────────────────────────

const FileViewer = () => {
  const navigate = useNavigate();
  const { dirName, '*': splat } = useParams(); // splat = full file path after /file/
  const filePath = splat || '';
  const fileName = filePath.split('/').pop();
  const lang = getLanguage(fileName);

  const currentRepoUrl    = useSelector((s) => s.graph.currentRepoUrl);
  const currentRepoBranch = useSelector((s) => s.graph.currentRepoBranch || 'main');
  const currentRepoId     = useSelector((s) => s.graph.currentRepoId);
  const currentScanId     = useSelector((s) => s.graph.currentScanId);
  const isDark            = useSelector((s) => s.theme?.isDark ?? true);

  const [seedGraph, { isLoading: reseedLoading }] = useSeedGraphMutation();
  const [reseedAttempted, setReseedAttempted] = useState(false);

  const [code, setCode]     = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]    = useState('');
  const [copied, setCopied]  = useState(false);
  const normalizedRepoUrl = useMemo(() => normalizeRepoUrl(currentRepoUrl), [currentRepoUrl]);
  const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

  const rawUrl = useMemo(
    () => buildGitHubRawUrl(normalizedRepoUrl, currentRepoBranch, filePath),
    [normalizedRepoUrl, currentRepoBranch, filePath],
  );

  const githubFileUrl = useMemo(() => {
    return buildGitHubBlobUrl(normalizedRepoUrl, currentRepoBranch, filePath);
  }, [normalizedRepoUrl, currentRepoBranch, filePath]);

  const {
    data: fileRelationsData,
    isFetching: relationsLoading,
    error: relationsError,
    refetch: refetchRelations,
  } = useGetFileRelationsQuery(
    { scanId: currentScanId, filePath },
    {
      skip: !currentScanId || !filePath,
      pollingInterval: 5000,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );

  const dependencyInfo = useMemo(() => {
    const incoming = fileRelationsData?.incoming || [];
    const outgoing = fileRelationsData?.outgoing || [];
    return {
      incoming,
      outgoing,
      hasLiveData: Boolean(currentScanId),
    };
  }, [fileRelationsData, currentScanId]);

  useEffect(() => {
    setReseedAttempted(false);
  }, [currentRepoId, currentScanId, filePath]);

  useEffect(() => {
    if (!currentRepoId || !currentScanId || !filePath || reseedAttempted || relationsError) return;
    if (!fileRelationsData) return;

    const incomingCount = fileRelationsData?.incoming?.length || 0;
    const outgoingCount = fileRelationsData?.outgoing?.length || 0;
    const noRelations = incomingCount === 0 && outgoingCount === 0;

    if (!noRelations) return;

    let cancelled = false;
    setReseedAttempted(true);

    seedGraph({
      repoId: currentRepoId,
      scanId: currentScanId,
      repoUrl: normalizedRepoUrl || undefined,
    })
      .unwrap()
      .then(() => {
        if (!cancelled) refetchRelations();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [
    currentRepoId,
    normalizedRepoUrl,
    currentScanId,
    filePath,
    reseedAttempted,
    relationsError,
    fileRelationsData,
    seedGraph,
    refetchRelations,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadFileContent() {
      setLoading(true);
      setError('');
      setCode('');

      try {
        if (rawUrl) {
          const res = await fetch(rawUrl);
          if (!res.ok) throw new Error(`GitHub returned ${res.status} for this file.`);
          const text = await res.text();
          if (!cancelled) setCode(text);
          return;
        }

        if (!currentRepoId || !filePath) {
          throw new Error('Cannot resolve file source for this repository.');
        }

        const localFileUrl = `${API_URL}/scan/local/${encodeURIComponent(currentRepoId)}/file?filePath=${encodeURIComponent(filePath)}`;
        const res = await fetch(localFileUrl);
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload?.message || `Failed to load local file (${res.status})`);
        }

        if (!cancelled) {
          setCode(String(payload?.data?.content || ''));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to fetch file content.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFileContent();
    return () => { cancelled = true; };
  }, [rawUrl, currentRepoId, filePath, API_URL]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const lineCount = code.split('\n').length;
  const sizeKb    = (new Blob([code]).size / 1024).toFixed(1);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs flex-wrap" style={{ color: 'var(--text-muted)' }}>
        <button
          onClick={() => navigate('/analyze')}
          className="flex items-center gap-1 transition-colors hover:text-blue-400"
        >
          <ArrowLeft size={12} /> Analyze
        </button>
        <span>/</span>
        <button
          onClick={() => navigate(`/analyze/dir/${encodeURIComponent(dirName)}`)}
          className="transition-colors hover:text-blue-400"
        >
          {dirName}
        </button>
        <span>/</span>
        {/* intermediate directories */}
        {filePath
          .replace(`${dirName}/`, '')
          .split('/')
          .slice(0, -1)
          .map((seg, i, arr) => (
            <React.Fragment key={i}>
              <span style={{ color: 'var(--text-muted)' }}>{seg}</span>
              <span>/</span>
            </React.Fragment>
          ))}
        <span className="font-semibold code-text" style={{ color: 'var(--text)' }}>{fileName}</span>
      </div>

      {/* Header bar */}
      <div
        className="card flex items-center justify-between gap-3 flex-wrap"
        style={{ padding: '0.75rem 1.25rem' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileCode2 size={15} style={{ color: '#3b82f6', flexShrink: 0 }} />
          <span className="font-semibold code-text text-sm truncate" style={{ color: 'var(--text)' }}>
            {filePath}
          </span>
          {!loading && !error && (
            <span className="text-xs" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
              {lineCount} lines · {sizeKb} KB
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Copy */}
          {!loading && !error && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-all"
              style={{
                background: 'var(--bg-muted)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              {copied ? <CheckCheck size={12} style={{ color: '#22c55e' }} /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}

          {/* View on GitHub */}
          {githubFileUrl && (
            <a
              href={githubFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-all"
              style={{
                background: '#1e3a8a',
                color: '#93c5fd',
                border: '1px solid rgba(59,130,246,0.3)',
              }}
            >
              <Github size={12} /> View on GitHub <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div
          className="card lg:col-span-2"
          style={{ padding: 0, overflow: 'hidden' }}
        >
        {/* Language badge bar */}
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-muted)',
          }}
        >
          <span
            className="text-xs font-semibold uppercase tracking-wider code-text"
            style={{ color: 'var(--text-muted)' }}
          >
            {lang}
          </span>
          {rawUrl && (
            <span className="text-xs code-text truncate max-w-xs hidden sm:block" style={{ color: 'var(--text-muted)' }}>
              {rawUrl}
            </span>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Loader2 size={16} className="animate-spin" />
            Loading file content...
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center gap-3 py-16 text-sm" style={{ color: 'var(--text-muted)' }}>
            <AlertCircle size={28} style={{ color: '#ef4444' }} />
            <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</p>
            {rawUrl && (
              <a
                href={rawUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline"
                style={{ color: '#3b82f6' }}
              >
                Try opening raw URL directly ↗
              </a>
            )}
          </div>
        )}

        {/* Code */}
        {!loading && !error && (
          <div style={{ overflowX: 'auto' }}>
            <SyntaxHighlighter
              language={lang}
              style={isDark ? atomOneDark : atomOneLight}
              showLineNumbers
              lineNumberStyle={{
                minWidth: '3.5em',
                paddingRight: '1.5em',
                color: isDark ? '#4b5563' : '#9ca3af',
                userSelect: 'none',
                fontSize: '0.75rem',
                textAlign: 'right',
              }}
              customStyle={{
                margin: 0,
                padding: '1rem 0',
                background: 'var(--card)',
                fontSize: '0.8125rem',
                lineHeight: '1.6',
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              }}
              wrapLongLines={false}
            >
              {code}
            </SyntaxHighlighter>
          </div>
        )}
        </div>

        <div className="card h-fit space-y-4">
          <div className="flex items-center gap-2">
            <Link2 size={15} style={{ color: '#3b82f6' }} />
            <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>
              Related Files
            </h3>
            {relationsLoading && <Loader2 size={13} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
            {reseedLoading && <Loader2 size={13} className="animate-spin" style={{ color: '#3b82f6' }} />}
          </div>

          {!dependencyInfo.hasLiveData && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Live Neo4j relations unavailable. Scan the repo and seed Neo4j first.
            </p>
          )}

          {relationsError && (
            <p className="text-xs" style={{ color: '#ef4444' }}>
              Failed to load live relations from Neo4j.
            </p>
          )}

          {dependencyInfo.hasLiveData && (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#f97316' }}>
                  Files dependent on this file ({dependencyInfo.incoming.length})
                </p>
                {dependencyInfo.incoming.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    No dependent files found.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {dependencyInfo.incoming.map((dependentPath) => (
                      <button
                        key={dependentPath}
                        onClick={() => navigate(`/analyze/dir/${encodeURIComponent(dependentPath.split('/')[0])}/file/${dependentPath}`)}
                        className="w-full flex items-start gap-1.5 px-2 py-1.5 rounded text-left transition-all"
                        style={{ color: 'var(--text-muted)', background: 'transparent' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--bg-muted)';
                          e.currentTarget.style.color = 'var(--text)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                      >
                        <ArrowRight size={12} style={{ marginTop: '2px', flexShrink: 0 }} />
                        <span className="text-xs code-text break-all">{dependentPath}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#3b82f6' }}>
                  Files this file depends on ({dependencyInfo.outgoing.length})
                </p>
                {dependencyInfo.outgoing.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    No outgoing dependencies found.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {dependencyInfo.outgoing.map((dependencyPath) => (
                      <button
                        key={dependencyPath}
                        onClick={() => navigate(`/analyze/dir/${encodeURIComponent(dependencyPath.split('/')[0])}/file/${dependencyPath}`)}
                        className="w-full flex items-start gap-1.5 px-2 py-1.5 rounded text-left transition-all"
                        style={{ color: 'var(--text-muted)', background: 'transparent' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--bg-muted)';
                          e.currentTarget.style.color = 'var(--text)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                      >
                        <ArrowRight size={12} style={{ marginTop: '2px', flexShrink: 0 }} />
                        <span className="text-xs code-text break-all">{dependencyPath}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileViewer;
