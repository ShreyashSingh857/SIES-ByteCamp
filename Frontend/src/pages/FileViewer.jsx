import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import {
  ArrowLeft,
  Github,
  Copy,
  CheckCheck,
  Loader2,
  AlertCircle,
  FileCode2,
  ExternalLink,
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

const parseRepoInfo = (repoUrl = '') => {
  try {
    const url = new URL(repoUrl);
    const [, owner, repo] = url.pathname.replace(/\.git$/, '').split('/');
    return { owner, repo };
  } catch {
    return { owner: '', repo: '' };
  }
};

const buildRawUrl = (repoUrl, branch, filePath) => {
  const { owner, repo } = parseRepoInfo(repoUrl);
  if (!owner || !repo) return null;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
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
  const isDark            = useSelector((s) => s.theme?.isDark ?? true);

  const [code, setCode]     = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]    = useState('');
  const [copied, setCopied]  = useState(false);

  const rawUrl = useMemo(
    () => buildRawUrl(currentRepoUrl, currentRepoBranch, filePath),
    [currentRepoUrl, currentRepoBranch, filePath],
  );

  const githubFileUrl = useMemo(() => {
    if (!currentRepoUrl || !filePath) return null;
    return `${currentRepoUrl}/blob/${currentRepoBranch}/${filePath}`;
  }, [currentRepoUrl, currentRepoBranch, filePath]);

  useEffect(() => {
    if (!rawUrl) {
      setError('Cannot build GitHub raw URL — no repository URL stored.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setCode('');

    fetch(rawUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`GitHub returned ${res.status} for this file.`);
        return res.text();
      })
      .then((text) => {
        setCode(text);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch file from GitHub.');
        setLoading(false);
      });
  }, [rawUrl]);

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
      <div
        className="card"
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
            Fetching from GitHub…
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
    </div>
  );
};

export default FileViewer;
