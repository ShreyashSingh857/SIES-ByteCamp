import React, { useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Github, Plus, GitBranch, Loader2, CheckCircle2, Trash2, AlertCircle } from 'lucide-react';
import { addRepo, removeRepo, updateRepoStatus, setScanStatus, setScanProgress } from '../store/index';

const LANG_COLORS = {
  Java:       '#f59e0b',
  'Node.js':  '#22c55e',
  Python:     '#3b82f6',
  Go:         '#06b6d4',
  TypeScript: '#a855f7',
  Scala:      '#ef4444',
  HCL:        '#94a3b8',
};

const LangBadge = ({ lang }) => (
  <span
    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
    style={{
      background: `${LANG_COLORS[lang] || '#94a3b8'}18`,
      color: LANG_COLORS[lang] || '#94a3b8',
      border: `1px solid ${LANG_COLORS[lang] || '#94a3b8'}40`,
    }}
  >
    {lang}
  </span>
);

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const UploadRepo = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const repos = useSelector((s) => s.graph.repos);
  const scanStatus = useSelector((s) => s.graph.scanStatus);

  const [url, setUrl]     = useState('');
  const [branch, setBranch] = useState('main');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const isValidGitUrl = (u) => /^(https?:\/\/)?(github\.com|gitlab\.com|bitbucket\.org)\/.+\/.+/.test(u.trim());

  const handleAdd = () => {
    setError('');
    const trimmed = url.trim();
    if (!trimmed) { setError('Please enter a repository URL.'); return; }
    if (!isValidGitUrl(trimmed)) { setError('Enter a valid GitHub / GitLab / Bitbucket URL.'); return; }
    if (repos.some((r) => r.url === trimmed)) { setError('This repository has already been added.'); return; }

    const name = trimmed.split('/').slice(-1)[0].replace(/\.git$/, '');
    dispatch(addRepo({
      id: Date.now(),
      name,
      url: trimmed,
      branch: branch || 'main',
      langs: [],
      status: 'pending',
      nodes: 0,
      edges: 0,
      services: 0,
      schemas: 0,
      scannedAt: null,
    }));
    setUrl('');
    setBranch('main');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleAdd(); };

  const handleRemove = (id) => {
    // Only remove pending repos — scanned repos keep their graph data
    dispatch(removeRepo(id));
  };

  const simulateScan = async () => {
    const pending = repos.filter((r) => r.status === 'pending');
    if (pending.length === 0) { navigate('/graph'); return; }

    dispatch(setScanStatus('scanning'));
    dispatch(setScanProgress(0));

    for (let p = 0; p <= 100; p += 4) {
      await delay(120);
      dispatch(setScanProgress(p));
    }

    for (const repo of pending) {
      dispatch(updateRepoStatus({ id: repo.id, status: 'scanned' }));
    }

    dispatch(setScanStatus('done'));
    navigate('/graph');
  };

  const pendingCount = repos.filter((r) => r.status === 'pending').length;
  const scanning     = scanStatus === 'scanning';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Add repo form */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <Github size={18} style={{ color: 'var(--text-muted)' }} />
          <h2 className="font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>
            Connect Repository
          </h2>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Repository URL
            </label>
            <input
              ref={inputRef}
              type="text"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
              placeholder="https://github.com/org/repo"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all code-text"
              style={{
                background: 'var(--bg)',
                border: `1px solid ${error ? '#ef4444' : 'var(--border)'}`,
                color: 'var(--text)',
              }}
            />
            {error && (
              <p className="mt-1.5 text-xs flex items-center gap-1" style={{ color: '#ef4444' }}>
                <AlertCircle size={12} /> {error}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Branch
            </label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all code-text"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>

          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: '#1e3a8a', color: '#93c5fd' }}
          >
            <Plus size={15} />
            Add Repository
          </button>
        </div>
      </div>

      {/* Repo list */}
      {repos.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Queued Repositories ({repos.length})
          </h3>
          {repos.map((repo) => (
            <div key={repo.id} className="repo-card flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm code-text" style={{ color: 'var(--text)' }}>
                    {repo.name}
                  </span>
                  <span
                    className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full"
                    style={{
                      background:
                        repo.status === 'scanned'  ? 'rgba(34,197,94,0.12)'  :
                        repo.status === 'scanning' ? 'rgba(59,130,246,0.12)' : 'rgba(148,163,184,0.12)',
                      color:
                        repo.status === 'scanned'  ? '#22c55e' :
                        repo.status === 'scanning' ? '#3b82f6' : '#94a3b8',
                    }}
                  >
                    {repo.status}
                  </span>
                </div>
                <p className="text-xs code-text mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                  {repo.url} · {repo.branch}
                </p>
                {repo.langs.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {repo.langs.map((l) => <LangBadge key={l} lang={l} />)}
                  </div>
                )}
              </div>

              {repo.status === 'scanned' && (
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>{repo.nodes} nodes</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{repo.edges} edges</p>
                </div>
              )}

              {repo.status === 'scanned' ? (
                <CheckCircle2 size={16} className="flex-shrink-0" style={{ color: '#22c55e' }} />
              ) : repo.status === 'scanning' ? (
                <Loader2 size={16} className="flex-shrink-0 animate-spin" style={{ color: '#3b82f6' }} />
              ) : (
                <button
                  onClick={() => handleRemove(repo.id)}
                  className="flex-shrink-0 p-1 rounded transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {pendingCount > 0
            ? `${pendingCount} repo${pendingCount > 1 ? 's' : ''} ready to scan`
            : repos.length > 0
            ? 'All repos scanned — view graph'
            : 'Add at least one repository to continue'}
        </p>
        <button
          onClick={simulateScan}
          disabled={scanning || repos.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
          style={{ background: '#1e3a8a', color: '#93c5fd' }}
        >
          {scanning ? (
            <><Loader2 size={15} className="animate-spin" /> Scanning…</>
          ) : (
            <><GitBranch size={15} /> {pendingCount > 0 ? 'Scan & Build Graph' : 'View Graph'}</>
          )}
        </button>
      </div>
    </div>
  );
};

export default UploadRepo;
