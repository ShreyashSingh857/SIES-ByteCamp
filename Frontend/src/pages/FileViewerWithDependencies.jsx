import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
    Search,
    X,
    ChevronDown,
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

// ─── DependencySnippet ───────────────────────────────────────────────────────

const DependencySnippet = ({ file, snippet, isDark, selectedText }) => {
    const [expanded, setExpanded] = useState(true);
    const lang = getLanguage(file.path);

    // Render code with highlighted matches
    const renderHighlightedCode = () => {
        if (!selectedText || !snippet) {
            return snippet;
        }

        try {
            // Split snippet into lines
            const lines = snippet.split('\n');

            return lines.map((line, idx) => {
                const escapedText = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(${escapedText})`, 'gi');
                const parts = line.split(regex);

                return (
                    <div key={idx} style={{ wordBreak: 'break-word' }}>
                        {parts.map((part, i) => {
                            if (regex.test(part)) {
                                return (
                                    <span
                                        key={i}
                                        style={{
                                            backgroundColor: '#fbbf24',
                                            color: '#000',
                                            padding: '0 2px',
                                            borderRadius: '2px',
                                            fontWeight: 500,
                                        }}
                                    >
                                        {part}
                                    </span>
                                );
                            }
                            return <span key={i}>{part}</span>;
                        })}
                    </div>
                );
            }).flat();
        } catch {
            return snippet;
        }
    };

    return (
        <div
            className="border-l-2 transition-all"
            style={{
                borderColor: '#3b82f6',
                background: 'var(--bg-muted)',
                borderRadius: '0.375rem',
                overflow: 'hidden',
                marginBottom: '1rem',
            }}
        >
            {/* File header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-4 py-2 flex items-center justify-between"
                style={{
                    background: 'var(--card)',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-muted)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--card)'; }}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <FileCode2 size={14} style={{ color: '#3b82f6', flexShrink: 0 }} />
                    <code className="text-xs truncate" style={{ color: 'var(--text)', fontFamily: "'JetBrains Mono'" }}>
                        {file.path}
                    </code>
                    {file.lineNumber && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-muted)', color: '#3b82f6' }}>
                            L{file.lineNumber}
                        </span>
                    )}
                </div>
                <ChevronDown
                    size={14}
                    style={{
                        color: 'var(--text-muted)',
                        transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                        transition: 'transform 0.2s',
                        flexShrink: 0,
                    }}
                />
            </button>

            {/* Snippet code */}
            {expanded && (
                <div
                    className="code-text"
                    style={{
                        fontSize: '0.75rem',
                        lineHeight: '1.5',
                        overflow: 'auto',
                        maxHeight: '250px',
                        background: 'var(--card)',
                    }}
                >
                    <pre
                        style={{
                            margin: 0,
                            padding: '0.75rem',
                            color: 'var(--text)',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                        }}
                    >
                        {renderHighlightedCode()}
                    </pre>
                </div>
            )}
        </div>
    );
};

// ─── DependencyPanel ───────────────────────────────────────────────────────────

const DependencyPanel = ({
    selectedText,
    dependencies,
    loading,
    error,
    isDark,
    onClear,
}) => {
    return (
        <div
            className="card"
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                padding: 0,
                overflow: 'hidden',
            }}
        >
            {/* Header */}
            <div
                className="flex-shrink-0 border-b flex items-center justify-between px-4 py-3"
                style={{ borderColor: 'var(--border)' }}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <Search size={14} style={{ color: '#3b82f6', flexShrink: 0 }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        Dependencies
                    </span>
                    {selectedText && (
                        <span
                            className="text-xs px-2 py-1 rounded code-text truncate"
                            style={{
                                background: '#1e3a8a',
                                color: '#93c5fd',
                                maxWidth: '200px',
                            }}
                            title={selectedText}
                        >
                            {selectedText}
                        </span>
                    )}
                </div>
                {selectedText && (
                    <button
                        onClick={onClear}
                        className="p-1 rounded hover:bg-opacity-80 transition-all flex-shrink-0"
                        style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)' }}
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto px-4 py-3" style={{ color: 'var(--text)' }}>
                {!selectedText && (
                    <div className="text-center py-8">
                        <Search size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            Select text in the code to find dependencies
                        </p>
                    </div>
                )}

                {selectedText && loading && (
                    <div className="flex items-center justify-center gap-2 py-8">
                        <Loader2 size={16} className="animate-spin" style={{ color: '#3b82f6' }} />
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            Analyzing dependencies…
                        </span>
                    </div>
                )}

                {selectedText && error && (
                    <div className="flex flex-col items-center gap-2 py-8">
                        <AlertCircle size={20} style={{ color: '#ef4444' }} />
                        <p className="text-sm" style={{ color: '#ef4444' }}>
                            {error}
                        </p>
                    </div>
                )}

                {selectedText && !loading && dependencies.length === 0 && !error && (
                    <div className="text-center py-8">
                        <AlertCircle size={20} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            No dependencies found for this selection
                        </p>
                    </div>
                )}

                {selectedText && !loading && dependencies.length > 0 && (
                    <div>
                        <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                            Found in {dependencies.length} location{dependencies.length > 1 ? 's' : ''}
                        </div>
                        {dependencies.map((dep, idx) => (
                            <DependencySnippet
                                key={idx}
                                file={dep}
                                snippet={dep.snippet}
                                isDark={isDark}
                                selectedText={selectedText}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── FileViewerWithDependencies ──────────────────────────────────────────────

const FileViewerWithDependencies = () => {
    const navigate = useNavigate();
    const { dirName, '*': splat } = useParams();
    const filePath = splat || '';
    const fileName = filePath.split('/').pop();
    const lang = getLanguage(fileName);

    const currentRepoUrl = useSelector((s) => s.graph.currentRepoUrl);
    const currentRepoBranch = useSelector((s) => s.graph.currentRepoBranch || 'main');
    const currentRepoId = useSelector((s) => s.graph.currentRepoId);
    const isDark = useSelector((s) => s.theme?.isDark ?? true);

    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [selectedText, setSelectedText] = useState('');
    const [dependencies, setDependencies] = useState([]);
    const [depLoading, setDepLoading] = useState(false);
    const [depError, setDepError] = useState('');
    const codeEditorRef = useRef(null);

    const rawUrl = useMemo(
        () => buildRawUrl(currentRepoUrl, currentRepoBranch, filePath),
        [currentRepoUrl, currentRepoBranch, filePath],
    );

    const githubFileUrl = useMemo(() => {
        if (!currentRepoUrl || !filePath) return null;
        return `${currentRepoUrl}/blob/${currentRepoBranch}/${filePath}`;
    }, [currentRepoUrl, currentRepoBranch, filePath]);

    // Fetch file code
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

    // Handle text selection in code editor
    useEffect(() => {
        const handleTextSelection = () => {
            const selected = window.getSelection().toString().trim();

            // Only set if selection is within the code editor
            if (selected && codeEditorRef.current) {
                const range = window.getSelection().getRangeAt(0);
                const container = range?.commonAncestorContainer?.parentElement;

                if (codeEditorRef.current.contains(container)) {
                    setSelectedText(selected);
                }
            }
        };

        document.addEventListener('mouseup', handleTextSelection);
        return () => document.removeEventListener('mouseup', handleTextSelection);
    }, []);

    // Query dependencies when text is selected
    useEffect(() => {
        if (!selectedText || !currentRepoId) {
            setDependencies([]);
            setDepError('');
            return;
        }

        const queryDependencies = async () => {
            setDepLoading(true);
            setDepError('');

            try {
                const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

                // Query the backend to find where this text appears
                const response = await fetch(`${API_URL}/analyze/dependencies`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        repoId: currentRepoId,
                        currentFile: filePath,
                        selectedText: selectedText,
                        context: 'file-analysis',
                    }),
                });

                if (!response.ok) {
                    throw new Error('Failed to analyze dependencies');
                }

                const result = await response.json();
                const deps = result.data?.dependencies || [];

                // Format dependencies for display
                const formatted = deps.map((dep) => ({
                    path: dep.filePath,
                    lineNumber: dep.lineNumber,
                    snippet: dep.codeSnippet || '',
                }));

                setDependencies(formatted);
            } catch (err) {
                setDepError(err.message || 'Error analyzing dependencies');
                setDependencies([]);
            } finally {
                setDepLoading(false);
            }
        };

        const timer = setTimeout(queryDependencies, 300); // debounce
        return () => clearTimeout(timer);
    }, [selectedText, currentRepoId, filePath]);

    const handleCopy = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleClearSelection = () => {
        setSelectedText('');
        setDependencies([]);
    };

    const lineCount = code.split('\n').length;
    const sizeKb = (new Blob([code]).size / 1024).toFixed(1);

    // Add global mouse up listener for text selection
    React.useEffect(() => {
        const handleMouseUp = () => {
            const selected = window.getSelection().toString().trim();
            if (selected) {
                // Check if selection is within the code editor
                const range = window.getSelection().getRangeAt(0);
                if (codeEditorRef.current && codeEditorRef.current.contains(range.commonAncestorContainer)) {
                    setSelectedText(selected);
                }
            }
        };

        document.addEventListener('mouseup', handleMouseUp);
        return () => document.removeEventListener('mouseup', handleMouseUp);
    }, []);

    return (
        <div className="max-w-full mx-auto space-y-4" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs flex-wrap px-4 pt-4" style={{ color: 'var(--text-muted)' }}>
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
                <span className="font-semibold code-text" style={{ color: 'var(--text)' }}>
                    {fileName}
                </span>
            </div>

            {/* Header bar */}
            <div className="flex-shrink-0 px-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
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

            {/* Split pane container */}
            <div
                className="flex-1 flex overflow-hidden px-4 pb-4 gap-4"
                style={{ minHeight: 0 }}
            >
                {/* Left: Code editor */}
                <div
                    className="card flex-1"
                    style={{
                        padding: 0,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: '50%',
                    }}
                >
                    {/* Language badge bar */}
                    <div
                        className="flex-shrink-0 flex items-center justify-between px-4 py-2"
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
                        <div className="flex-1 flex items-center justify-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                            <Loader2 size={16} className="animate-spin" />
                            Fetching from GitHub…
                        </div>
                    )}

                    {/* Error */}
                    {!loading && error && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
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
                        <div className="flex-1 overflow-auto" ref={codeEditorRef}>
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

                {/* Right: Dependency panel */}
                <div style={{ flex: '0 0 35%', minWidth: '300px' }}>
                    <DependencyPanel
                        selectedText={selectedText}
                        dependencies={dependencies}
                        loading={depLoading}
                        error={depError}
                        isDark={isDark}
                        onClear={handleClearSelection}
                    />
                </div>
            </div>
        </div>
    );
};

export default FileViewerWithDependencies;
