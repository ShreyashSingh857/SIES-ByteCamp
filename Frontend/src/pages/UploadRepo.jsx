import React, { useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Github, Plus, GitBranch, Loader2, CheckCircle2, Trash2, AlertCircle, FolderOpen, Info } from 'lucide-react';
import { addRepo, removeRepo, updateRepoStatus, setScanStatus, setScanProgress, setCurrentRepoInfo } from '../store/index';
import { useScanRepoMutation, useSeedGraphMutation, useScanLocalRepoMutation } from '../store/slices/apiSlice';
import { normalizeRepoUrl } from '../lib/utils';

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
  const [scanLocalRepo] = useScanLocalRepoMutation();

  const [url, setUrl]       = useState('');
  const [branch, setBranch] = useState('main');
  const [error, setError]   = useState('');
  const [mode, setMode]           = useState('github'); // 'github' | 'local'
  const [localPath, setLocalPath] = useState('');
  const inputRef = useRef(null);

  const isValidGitUrl = (u) =>
    /^(https?:\/\/)?(github\.com|gitlab\.com|bitbucket\.org)\/.+\/.+/.test(u.trim());

  const handleAdd = () => {
    setError('');
    const trimmed = url.trim();
    const normalizedUrl = normalizeRepoUrl(trimmed);
    if (!trimmed)                         { setError('Please enter a repository URL.'); return; }
    if (!isValidGitUrl(trimmed))          { setError('Enter a valid GitHub / GitLab / Bitbucket URL.'); return; }
    if (repos.some((r) => normalizeRepoUrl(r.url) === normalizedUrl)) { setError('This repository has already been added.'); return; }

    const name = normalizedUrl.split('/').slice(-1)[0].replace(/\.git$/, '');
    dispatch(addRepo({
      id: Date.now(),
      name,
      url: normalizedUrl,
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

  const scanLocalRepos = async () => {
    const trimmedPath = localPath.trim();
    if (!trimmedPath) { setError('Please enter an absolute path to a local repository.'); return; }

    // Basic absolute-path check on the client side.
    const isAbsolute = trimmedPath.startsWith('/') || /^[A-Za-z]:\\/.test(trimmedPath);
    if (!isAbsolute) {
      setError('Path must be absolute (e.g. /home/user/myproject or C:\\Users\\user\\myproject).');
      return;
    }

    dispatch(setScanStatus('scanning'));
    dispatch(setScanProgress(10));
    setError('');

    try {
      dispatch(setScanProgress(30));

      // Single call — backend runs AI Engine + Neo4j seed + watcher registration.
      const result = await scanLocalRepo({ localPath: trimmedPath }).unwrap();

      dispatch(setScanProgress(80));

      const repoId = result.repoId;
      const scanId = result.scanId || null;
      const name = trimmedPath.split(/[\\/]/).filter(Boolean).pop() || 'local-repo';

      // Register in Redux list so existing repo-card UI stays reusable.
      dispatch(addRepo({
        id: Date.now(),
        name,
        url: trimmedPath,
        branch: 'local',
        langs: [],
        status: 'scanned',
        nodes: result.parserSummary?.nodes || 0,
        edges: result.parserSummary?.edges || 0,
        services: 0,
        schemas: 0,
        scannedAt: new Date().toISOString(),
        isLocal: true,
      }));

      dispatch(setCurrentRepoInfo({ repoId, scanId, repoUrl: trimmedPath, branch: 'local' }));
      dispatch(setScanProgress(100));
      dispatch(setScanStatus('done'));

      navigate('/analyze');
    } catch (err) {
      console.error('Local scan error:', err);
      setError(err?.data?.message || err?.message || 'Failed to scan local repository.');
      dispatch(setScanStatus('error'));
    }
  };

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
        const scanResult = await scanRepo({
          repoUrl: repo.url,
          branch: repo.branch || 'main',
          githubToken: import.meta.env.VITE_GITHUB_TOKEN || '',
        }).unwrap();
        const repoId = scanResult.repoId;
        let scanId = scanResult.scanId || null;

        currentProgress += perRepoProgress * 0.4;
        dispatch(setScanProgress(currentProgress));

        // Step 2: Seed parsed graph into Neo4j
        try {
          const seedResult = await seedGraph({ repoId, scanId, repoUrl: repo.url }).unwrap();
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
      {/* Mode tab switcher */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
        <button
          onClick={() => { setMode('github'); setError(''); }}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all"
          style={{
            background: mode === 'github' ? 'var(--card)' : 'transparent',
            color: mode === 'github' ? 'var(--text)' : 'var(--text-muted)',
            boxShadow: mode === 'github' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          <Github size={15} />
          GitHub URL
        </button>
        <button
          onClick={() => { setMode('local'); setError(''); }}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all"
          style={{
            background: mode === 'local' ? 'var(--card)' : 'transparent',
            color: mode === 'local' ? 'var(--text)' : 'var(--text-muted)',
            boxShadow: mode === 'local' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          <FolderOpen size={15} />
          Local Path
        </button>
      </div>

      {/* GitHub mode */}
      {mode === 'github' && (
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
      )}

      {/* Local path mode */}
      {mode === 'local' && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <FolderOpen size={18} style={{ color: 'var(--text-muted)' }} />
            <h2 className="font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>
              Scan Local Repository
            </h2>
          </div>

          <div
            className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs"
            style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: 'var(--text-muted)' }}
          >
            <Info size={13} className="mt-0.5 shrink-0" style={{ color: '#3b82f6' }} />
            <span>
              Enter an absolute path to a local repo on this machine. After the initial scan,
              any file you save will automatically update the dependency graph in real time.
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Absolute path to repository
              </label>
              <input
                type="text"
                value={localPath}
                onChange={(e) => { setLocalPath(e.target.value); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') scanLocalRepos(); }}
                placeholder={navigator.platform.startsWith('Win') ? 'C:\\Users\\you\\myproject' : '/home/you/myproject'}
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
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                The backend server must have read access to this path.
              </p>
            </div>

            <button
              onClick={scanLocalRepos}
              disabled={scanning || !localPath.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              style={{ background: '#1e3a8a', color: '#93c5fd' }}
            >
              {scanning ? (
                <><Loader2 size={15} className="animate-spin" /> Scanning...</>
              ) : (
                <><FolderOpen size={15} /> Scan & Watch</>
              )}
            </button>
          </div>
        </div>
      )}

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
                  {repo.isLocal && (
                    <span
                      className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}
                    >
                      local · live
                    </span>
                  )}
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
                <div className="text-right shrink-0">
                  <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>{repo.nodes ?? 0} nodes</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{repo.edges ?? 0} edges</p>
                </div>
              )}

              {repo.status === 'scanned' ? (
                <CheckCircle2 size={16} className="shrink-0" style={{ color: '#22c55e' }} />
              ) : repo.status === 'scanning' ? (
                <Loader2 size={16} className="shrink-0 animate-spin" style={{ color: '#3b82f6' }} />
              ) : (
                <button
                  onClick={() => handleRemove(repo.id)}
                  className="shrink-0 p-1 rounded transition-colors"
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
      {mode === 'github' && (
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
              <><Loader2 size={15} className="animate-spin" /> Scanning...</>
            ) : (
              <><GitBranch size={15} /> {pendingCount > 0 ? 'Scan & Build Graph' : 'View Analyze'}</>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default UploadRepo;
