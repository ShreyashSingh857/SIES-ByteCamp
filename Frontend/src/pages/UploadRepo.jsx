import React, { useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Github, Plus, GitBranch, Loader2, CheckCircle2, Trash2, AlertCircle } from 'lucide-react';
import { addRepo, removeRepo, updateRepoStatus, setScanStatus, setScanProgress, setCurrentRepoInfo } from '../store/index';
import { useScanRepoMutation, useSeedGraphMutation } from '../store/slices/apiSlice';

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

const UploadRepo = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const repos = useSelector((s) => s.graph.repos);
  const scanStatus = useSelector((s) => s.graph.scanStatus);
  const [scanRepo] = useScanRepoMutation();
  const [seedGraph] = useSeedGraphMutation();

  const [url, setUrl]       = useState('');
  const [branch, setBranch] = useState('main');
  const [error, setError]   = useState('');
  const inputRef = useRef(null);

  const isValidGitUrl = (u) =>
    /^(https?:\/\/)?(github\.com|gitlab\.com|bitbucket\.org)\/.+\/.+/.test(u.trim());

  const handleAdd = () => {
    setError('');
    const trimmed = url.trim();
    if (!trimmed)                   { setError('Please enter a repository URL.'); return; }
    if (!isValidGitUrl(trimmed))    { setError('Enter a valid GitHub / GitLab / Bitbucket URL.'); return; }
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

  const handleRemove = (id) => dispatch(removeRepo(id));

  const scanRepos = async () => {
    const pending = repos.filter((r) => r.status === 'pending');
    if (pending.length === 0) { navigate('/analyze'); return; }

    dispatch(setScanStatus('scanning'));
    dispatch(setScanProgress(0));

    try {
      const perRepoProgress = 100 / pending.length;
      let currentProgress = 0;

      for (const repo of pending) {
        dispatch(updateRepoStatus({ id: repo.id, status: 'scanning' }));

        currentProgress += perRepoProgress * 0.2;
        dispatch(setScanProgress(currentProgress));

        // Step 1: Clone & parse via AI Engine
        const scanResult = await scanRepo({ repoUrl: repo.url }).unwrap();
        const repoId = scanResult.repoId;

        currentProgress += perRepoProgress * 0.4;
        dispatch(setScanProgress(currentProgress));

        // Step 2: Seed parsed graph into Neo4j
        let scanId = null;
        try {
          const seedResult = await seedGraph({ repoId, repoUrl: repo.url }).unwrap();
          scanId = seedResult.scanId;
        } catch (seedErr) {
          // Neo4j may not be available — continue anyway, impact will be degraded
          console.warn('Neo4j seed failed (impact analysis may be unavailable):', seedErr?.data?.message || seedErr?.message);
        }

        // Store the active context for Graph/Impact panels to use
        dispatch(setCurrentRepoInfo({ repoId, scanId, repoUrl: repo.url, branch: repo.branch || 'main' }));

        currentProgress += perRepoProgress * 0.4;
        dispatch(setScanProgress(currentProgress));
        dispatch(updateRepoStatus({
          id: repo.id,
          status: 'scanned',
          nodes: scanResult.parserSummary?.nodes,
          edges: scanResult.parserSummary?.edges,
        }));
      }

      dispatch(setScanStatus('done'));
      navigate('/analyze');
    } catch (err) {
      console.error('Scan error:', err);
      setError(err?.data?.message || err?.message || 'Failed to scan repository.');
      dispatch(setScanStatus('error'));
    }
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
                {repo.langs?.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {repo.langs.map((l) => <LangBadge key={l} lang={l} />)}
                  </div>
                )}
              </div>

              {repo.status === 'scanned' && (
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>{repo.nodes ?? 0} nodes</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{repo.edges ?? 0} edges</p>
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
          onClick={scanRepos}
          disabled={scanning || repos.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
          style={{ background: '#1e3a8a', color: '#93c5fd' }}
        >
          {scanning ? (
            <><Loader2 size={15} className="animate-spin" /> Scanning…</>
          ) : (
            <><GitBranch size={15} /> {pendingCount > 0 ? 'Scan & Build Graph' : 'View Analyze'}</>
          )}
        </button>
      </div>
    </div>
  );
};

export default UploadRepo;
