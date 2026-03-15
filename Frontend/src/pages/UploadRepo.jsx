import React, { useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    Github,
    FolderGit2,
    FolderOpen,
    Trash2,
    Plus,
    GitBranch,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Info,
    Link,
    ChevronRight
} from 'lucide-react';
import { addRepo, removeRepo, updateRepoStatus, setScanStatus, setScanProgress, setCurrentRepoInfo } from '../store/index';
import { useScanRepoMutation, useSeedGraphMutation } from '../store/slices/apiSlice';
import { normalizeRepoUrl } from '../lib/utils';

export default function UploadRepo() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const repos = useSelector((s) => s.graph.repos);
    const scanStatus = useSelector((s) => s.graph.scanStatus);
    const [scanRepo] = useScanRepoMutation();
    const [seedGraph] = useSeedGraphMutation();

    const [url, setUrl] = useState('');
    const [branch, setBranch] = useState('main');
    const [error, setError] = useState('');
    const [mode, setMode] = useState('github'); // 'github' | 'local'
    const [localPath, setLocalPath] = useState('');
    const inputRef = useRef(null);

    const isValidGitUrl = (u) =>
        /^(https?:\/\/)?(github\.com|gitlab\.com|bitbucket\.org)\/.+\/.+/.test(u.trim());

    const handleAdd = () => {
        setError('');
        const trimmed = url.trim();
        const normalizedUrl = normalizeRepoUrl(trimmed);
        if (!trimmed) { setError('Please enter a repository URL.'); return; }
        if (!isValidGitUrl(trimmed)) { setError('Enter a valid GitHub / GitLab / Bitbucket URL.'); return; }
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
        if (!trimmedPath) {
            setError('Please enter an absolute path to a local repository.');
            return;
        }

        // Basic absolute-path check on the client side.
        const isAbsolute = trimmedPath.startsWith('/') || /^[A-Za-z]:\\/.test(trimmedPath);
        if (!isAbsolute) {
            setError('Path must be absolute (e.g. /home/user/myproject or C:\\Users\\user\\myproject).');
            return;
        }

        if (repos.some((r) => (r.isLocal ? String(r.url).trim() === trimmedPath : false))) {
            setError('This local repository has already been added.');
            return;
        }

        dispatch(setScanStatus('scanning'));
        dispatch(setScanProgress(10));
        setError('');

        try {
            dispatch(setScanProgress(30));

            // Uses the existing /scan endpoint — backend already accepts absolute local paths in repoUrl.
            const scanResult = await scanRepo({
                repoUrl: trimmedPath,
                branch: 'local',
                githubToken: '',
            }).unwrap();

            const repoId = scanResult.repoId;
            let scanId = scanResult.scanId || null;

            dispatch(setScanProgress(70));

            // Seed parsed graph into Neo4j (same as GitHub flow)
            try {
                const seedResult = await seedGraph({ repoId, scanId, repoUrl: trimmedPath }).unwrap();
                scanId = seedResult.scanId || scanId;
            } catch (seedErr) {
                console.warn('Neo4j seed failed (impact analysis may be unavailable):', seedErr?.data?.message || seedErr?.message);
            }

            dispatch(setScanProgress(90));

            const name = trimmedPath.split(/[\\/]/).filter(Boolean).pop() || 'local-repo';
            dispatch(addRepo({
                id: Date.now(),
                name,
                url: trimmedPath,
                branch: 'local',
                langs: [],
                status: 'scanned',
                nodes: scanResult.parserSummary?.nodes || 0,
                edges: scanResult.parserSummary?.edges || 0,
                services: 0,
                schemas: 0,
                scannedAt: new Date().toISOString(),
                isLocal: true,
            }));

            dispatch(setCurrentRepoInfo({ repoId, scanId, repoUrl: trimmedPath, branch: 'local' }));
            dispatch(setScanProgress(100));
            dispatch(setScanStatus('done'));

            setLocalPath('');
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
    const scanning = scanStatus === 'scanning';

    return (
        <div className="min-h-screen text-[color:var(--text)] font-sans -m-4 sm:-m-6">
            <div className="max-w-4xl mx-auto py-12 px-4 flex flex-col gap-8">

                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-[color:var(--text)] tracking-tight">Upload Repos</h1>
                    <p className="text-base text-[color:var(--text-muted)] font-medium">Connect GitHub repositories to scan and analyze dependencies</p>
                </div>

                {/* Connect Repository Form */}
                <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-6 md:p-8 flex flex-col gap-6">
                    {/* Mode switcher */}
                    <div className="flex gap-1 p-1 rounded-lg bg-[color:var(--bg)] border border-[color:var(--border)]">
                        <button
                            type="button"
                            onClick={() => { setMode('github'); setError(''); inputRef.current?.focus(); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-colors ${mode === 'github'
                                ? 'bg-indigo-700 text-white'
                                : 'text-[color:var(--text-muted)] hover:bg-[color:var(--bg-muted)]'
                                }`}
                        >
                            <Github className="w-4 h-4" />
                            GitHub URL
                        </button>
                        <button
                            type="button"
                            onClick={() => { setMode('local'); setError(''); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-colors ${mode === 'local'
                                ? 'bg-indigo-700 text-white'
                                : 'text-[color:var(--text-muted)] hover:bg-[color:var(--bg-muted)]'
                                }`}
                        >
                            <FolderOpen className="w-4 h-4" />
                            Local Path
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row gap-6 items-start">
                        {mode === 'github' ? (
                            <>
                                <div className="flex-1 w-full space-y-2">
                                    <label className="block text-sm font-medium text-[color:var(--text)]">
                                        Repository URL
                                    </label>
                                    <div className="relative">
                                        <Link className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={url}
                                            onChange={(e) => { setUrl(e.target.value); setError(''); }}
                                            onKeyDown={handleKeyDown}
                                            placeholder="https://github.com/org/repo"
                                            className="w-full pl-9 pr-4 py-2.5 text-sm bg-[color:var(--card)] border border-[color:var(--border)] rounded-lg focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all font-mono"
                                        />
                                    </div>
                                    {error && (
                                        <p className="text-sm flex items-center gap-1.5 text-red-600 font-medium mt-2">
                                            <AlertCircle className="w-4 h-4" /> {error}
                                        </p>
                                    )}
                                </div>

                                <div className="w-full md:w-48 space-y-2">
                                    <label className="block text-sm font-medium text-[color:var(--text)]">
                                        Branch
                                    </label>
                                    <div className="relative">
                                        <GitBranch className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            value={branch}
                                            onChange={(e) => setBranch(e.target.value)}
                                            placeholder="main"
                                            className="w-full pl-9 pr-4 py-2.5 text-sm bg-[color:var(--card)] border border-[color:var(--border)] rounded-lg focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all font-mono"
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 w-full space-y-3">
                                <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                                    <p className="leading-snug">
                                        Enter an absolute path to a local git repository on this machine.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-[color:var(--text)]">
                                        Absolute path to repository
                                    </label>
                                    <div className="relative">
                                        <FolderOpen className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            value={localPath}
                                            onChange={(e) => { setLocalPath(e.target.value); setError(''); }}
                                            onKeyDown={(e) => { if (e.key === 'Enter') scanLocalRepos(); }}
                                            placeholder={navigator.platform?.startsWith('Win') ? 'C:\\Users\\you\\myproject' : '/home/you/myproject'}
                                            className="w-full pl-9 pr-4 py-2.5 text-sm bg-[color:var(--card)] border border-[color:var(--border)] rounded-lg focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all font-mono"
                                        />
                                    </div>
                                    {error && (
                                        <p className="text-sm flex items-center gap-1.5 text-red-600 font-medium mt-2">
                                            <AlertCircle className="w-4 h-4" /> {error}
                                        </p>
                                    )}
                                    <p className="text-xs text-[color:var(--text-muted)]">
                                        The backend server must have read access to this path.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end">
                        {mode === 'github' ? (
                            <button
                                onClick={handleAdd}
                                className="flex items-center justify-center gap-2 bg-indigo-700 hover:bg-indigo-800 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                Add Repository
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={scanLocalRepos}
                                disabled={scanning || !localPath.trim()}
                                className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${scanning || !localPath.trim()
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-indigo-700 hover:bg-indigo-800 text-white cursor-pointer'
                                    }`}
                            >
                                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
                                {scanning ? 'Scanning…' : 'Scan Local Repo'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Queued Repositories (The List) */}
                {repos.length > 0 && (
                    <div className="flex flex-col gap-4">
                        <h2 className="text-sm font-bold tracking-wide uppercase text-[color:var(--text-muted)]">
                            Queued Repositories ({repos.length})
                        </h2>

                        <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl flex flex-col divide-y divide-slate-200">
                            {repos.map((repo) => (
                                <div key={repo.id} className="p-4 flex items-center justify-between hover:bg-[color:var(--bg-muted)] transition-colors group first:rounded-t-xl last:rounded-b-xl">
                                    <div className="flex items-start gap-4">
                                        <div className="mt-1 bg-[color:var(--bg)] p-2 border border-[color:var(--border)] rounded-lg">
                                            <FolderGit2 className="w-5 h-5 text-[color:var(--text-muted)]" />
                                        </div>
                                        <div className="flex flex-col justify-center min-w-0">
                                            <div className="flex items-center gap-3">
                                                <h4 className="text-base font-semibold text-[color:var(--text)] truncate">
                                                    {repo.name}
                                                </h4>

                                                {repo.isLocal && (
                                                    <span className="inline-flex items-center px-2 py-0.5 bg-slate-50 text-slate-700 text-[10px] font-bold tracking-wider uppercase border border-slate-200 rounded">
                                                        Local
                                                    </span>
                                                )}

                                                {/* Status Badge */}
                                                {repo.status === 'pending' && (
                                                    <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold tracking-wider uppercase border border-amber-200 rounded">
                                                        Pending
                                                    </span>
                                                )}
                                                {repo.status === 'scanning' && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold tracking-wider uppercase border border-blue-200 rounded">
                                                        <Loader2 className="w-3 h-3 animate-spin" /> Scanning
                                                    </span>
                                                )}
                                                {repo.status === 'scanned' && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold tracking-wider uppercase border border-emerald-200 rounded">
                                                        <CheckCircle2 className="w-3 h-3" /> Analyzed
                                                    </span>
                                                )}
                                                {repo.status === 'error' && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 text-[10px] font-bold tracking-wider uppercase border border-red-200 rounded">
                                                        Error
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-sm text-[color:var(--text-muted)] font-mono truncate max-w-md">
                                                    {repo.url}
                                                </p>
                                                <span className="text-slate-300">•</span>
                                                <span className="text-sm text-[color:var(--text-muted)] font-mono flex items-center gap-1">
                                                    <GitBranch className="w-3 h-3" /> {repo.branch}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {/* Delete action */}
                                        {(!scanning || repo.status !== 'scanning') && (
                                            <button
                                                onClick={() => handleRemove(repo.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100"
                                                title="Remove repository"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Primary CTA (Scan & Build Graph) */}
                {mode === 'github' && (
                    <div className="flex justify-end">
                        <button
                            onClick={scanRepos}
                            disabled={scanning || repos.length === 0}
                            className={`flex items-center gap-2 px-8 py-3 text-base font-semibold transition-all border ${scanning || repos.length === 0
                                ? 'bg-slate-100 text-slate-400 border-[color:var(--border)] cursor-not-allowed'
                                : 'bg-indigo-700 hover:bg-indigo-800 text-white border-transparent shadow-sm'
                                }`}
                        >
                            {scanning ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Scanning Repository Queue...</>
                            ) : pendingCount > 0 ? (
                                <>Scan & Build Graph <ChevronRight className="w-5 h-5" /></>
                            ) : (
                                <>View Analysis <ChevronRight className="w-5 h-5" /></>
                            )}
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}
