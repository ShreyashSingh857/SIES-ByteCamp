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
    const lang = getLanguage(file.path || '');

    // Get badge color based on dependency type
    const getTypeColor = (type) => {
        const typeColors = {
            'CALLS': '#8b5cf6',
            'IMPORTS': '#06b6d4',
            'USES_TABLE': '#f59e0b',
            'USES_FIELD': '#ec4899',
            'CONSUMES_API': '#10b981',
            'llm-insight': '#3b82f6',
            'file-occurrence': '#6366f1',
            'dependency': '#a78bfa',
        };
        return typeColors[type] || '#6b7280';
    };

    // Render code with highlighted matches
    const renderHighlightedCode = () => {
        if (!selectedText || !snippet) {
            return snippet;
        }

        try {
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
                borderColor: getTypeColor(file.type),
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
                    <FileCode2 size={14} style={{ color: getTypeColor(file.type), flexShrink: 0 }} />
                    <code className="text-xs truncate" style={{ color: 'var(--text)', fontFamily: "'JetBrains Mono'" }}>
                        {file.displayName || file.path}
                    </code>
                    {file.lineNumber > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-muted)', color: getTypeColor(file.type) }}>
                            L{file.lineNumber}
                        </span>
                    )}
                    {file.type && (
                        <span
                            className="text-xs px-2 py-0.5 rounded font-mono"
                            style={{
                                background: getTypeColor(file.type),
                                color: '#fff',
                                fontSize: '0.65rem',
                            }}
                        >
                            {file.type}
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
                            color: file.type === 'llm-insight' ? '#3b82f6' : 'var(--text)',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                        }}
                    >
                        {file.type === 'llm-insight' && snippet.startsWith('{') ? (
                            <div style={{ color: 'var(--text)' }}>
                                {Object.entries(JSON.parse(snippet)).map(([key, value]) => (
                                    <div key={key} style={{ marginBottom: '0.5rem' }}>
                                        <strong style={{ color: '#3b82f6' }}>{key}:</strong>
                                        <div style={{ marginLeft: '1rem', color: 'var(--text-muted)' }}>
                                            {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            renderHighlightedCode()
                        )}
                    </pre>
                </div>
            )}
        </div>
    );
};

// ─── LLM Insights Card ─────────────────────────────────────────────────────

const LLMInsightCard = ({ insight, isDark }) => {
    try {
        const analysis = typeof insight === 'string' ? JSON.parse(insight) : insight;

        const getRiskColor = (risk) => {
            const colors = {
                'LOW': '#10b981',
                'MEDIUM': '#f59e0b',
                'HIGH': '#ef4444',
            };
            return colors[risk?.toUpperCase()] || '#6b7280';
        };

        const getImpactColor = (impact) => {
            const colors = {
                'LOW': '#6b7280',
                'MEDIUM': '#3b82f6',
                'HIGH': '#8b5cf6',
            };
            return colors[impact?.toUpperCase()] || '#6b7280';
        };

        return (
            <div
                style={{
                    background: isDark ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                    border: '2px solid #3b82f6',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    marginBottom: '1rem',
                }}
            >
                <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#3b82f6', fontSize: '1.25rem' }}>🤖</span>
                    <h3 style={{ margin: 0, color: '#3b82f6', fontWeight: 600, fontSize: '0.95rem' }}>
                        AI Dependency Analysis
                    </h3>
                </div>

                <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.85rem' }}>
                    {analysis.dependencyType && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Type:</span>
                            <span
                                style={{
                                    background: '#06b6d4',
                                    color: '#fff',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.25rem',
                                    fontWeight: 500,
                                    fontSize: '0.75rem',
                                    textTransform: 'uppercase',
                                }}
                            >
                                {analysis.dependencyType}
                            </span>
                        </div>
                    )}

                    {analysis.classification && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Classification:</span>
                            <span style={{ color: 'var(--text)' }}>{analysis.classification}</span>
                        </div>
                    )}

                    {analysis.scope && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Scope:</span>
                            <span
                                style={{
                                    background: '#8b5cf6',
                                    color: '#fff',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.25rem',
                                    fontSize: '0.75rem',
                                    textTransform: 'capitalize',
                                }}
                            >
                                {analysis.scope}
                            </span>
                        </div>
                    )}

                    {analysis.impact && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Impact:</span>
                            <span
                                style={{
                                    background: getImpactColor(analysis.impact),
                                    color: '#fff',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.25rem',
                                    fontWeight: 500,
                                    fontSize: '0.75rem',
                                    textTransform: 'uppercase',
                                }}
                            >
                                {analysis.impact}
                            </span>
                        </div>
                    )}

                    {analysis.riskLevel && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Risk:</span>
                            <span
                                style={{
                                    background: getRiskColor(analysis.riskLevel),
                                    color: '#fff',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.25rem',
                                    fontWeight: 500,
                                    fontSize: '0.75rem',
                                    textTransform: 'uppercase',
                                }}
                            >
                                {analysis.riskLevel}
                            </span>
                        </div>
                    )}

                    {analysis.reason && (
                        <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                            <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 500 }}>
                                Reason:
                            </p>
                            <p style={{ margin: 0, color: 'var(--text)', fontSize: '0.8rem', lineHeight: '1.4' }}>
                                {analysis.reason}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    } catch (e) {
        return null;
    }
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
    // Separate LLM insights from regular dependencies
    const llmInsight = dependencies.find(dep => dep.type === 'llm-insight');
    const otherDeps = dependencies.filter(dep => dep.type !== 'llm-insight');

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
                        Dependencies & AI Analysis
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
                            Running AI analysis…
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
                        {/* LLM Insight Section - Shows First & Prominently */}
                        {llmInsight && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <LLMInsightCard insight={llmInsight.snippet} isDark={isDark} />
                            </div>
                        )}

                        {/* Other Dependencies Section */}
                        {otherDeps.length > 0 && (
                            <div>
                                <div className="text-xs mb-3" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                                    📍 Found in {otherDeps.length} location{otherDeps.length > 1 ? 's' : ''}
                                </div>
                                {otherDeps.map((dep, idx) => (
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
    const currentScanId = useSelector((s) => s.graph.currentScanId);
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

                // Prefer Redux scanId, then localStorage fallback.
                const scanId = currentScanId || localStorage.getItem('currentScanId');

                // Persist most recent scanId for page refreshes/navigation.
                if (scanId && localStorage.getItem('currentScanId') !== scanId) {
                    localStorage.setItem('currentScanId', scanId);
                }

                if (!scanId) {
                    // Fallback: use basic file-based analysis
                    const response = await fetch(`${API_URL}/analyze/dependencies`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            repoId: currentRepoId,
                            currentFile: filePath,
                            selectedText: selectedText,
                        }),
                    });

                    if (!response.ok) {
                        throw new Error('Failed to analyze dependencies');
                    }

                    const result = await response.json();
                    const deps = result.data?.dependencies || [];

                    setDependencies(
                        deps.map((dep) => ({
                            path: dep.filePath,
                            lineNumber: dep.lineNumber,
                            snippet: dep.codeSnippet || '',
                            type: 'file-occurrence',
                        }))
                    );
                    return;
                }

                // Use LLM-enhanced analysis with Neo4j
                const response = await fetch(`${API_URL}/analyze/dependencies-llm`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        repoId: currentRepoId,
                        scanId: scanId,
                        currentFile: filePath,
                        selectedText: selectedText,
                        withLLM: true,
                    }),
                });

                if (!response.ok) {
                    throw new Error('Failed to analyze dependencies with LLM');
                }

                const result = await response.json();
                const data = result.data || {};

                // Format enriched dependencies
                const enrichedDeps = [];

                // Add symbol occurrences
                if (data.symbolOccurrences) {
                    enrichedDeps.push(
                        ...data.symbolOccurrences.map((occ) => ({
                            id: occ.id,
                            path: occ.filePath,
                            lineNumber: occ.lineNumber,
                            type: occ.type,
                            displayName: occ.displayName,
                            snippet: `Located at ${occ.context || 'this location'}`,
                        }))
                    );
                }

                // Add dependencies
                if (data.dependencies?.perNode) {
                    Object.entries(data.dependencies.perNode).forEach(([nodeId, deps]) => {
                        [...deps.incoming, ...deps.outgoing].forEach(dep => {
                            enrichedDeps.push({
                                id: `${nodeId}-${dep.targetId}`,
                                path: dep.targetName,
                                lineNumber: 0,
                                type: 'dependency',
                                displayName: `${dep.relationshipType}: ${dep.targetName}`,
                                snippet: `${dep.sourceType} → [${dep.relationshipType}] → ${dep.targetType}`,
                            });
                        });
                    });
                }

                // Add LLM insights
                if (data.llmAnalysis?.analysis) {
                    enrichedDeps.push({
                        id: 'llm-analysis',
                        path: 'AI Analysis',
                        lineNumber: 0,
                        type: 'llm-insight',
                        displayName: 'LLM Dependency Analysis',
                        snippet: JSON.stringify(data.llmAnalysis.analysis, null, 2),
                    });
                }

                setDependencies(enrichedDeps);
            } catch (err) {
                setDepError(err.message || 'Error analyzing dependencies');
                setDependencies([]);
            } finally {
                setDepLoading(false);
            }
        };

        const timer = setTimeout(queryDependencies, 300);
        return () => clearTimeout(timer);
    }, [selectedText, currentRepoId, currentScanId, filePath]);

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
