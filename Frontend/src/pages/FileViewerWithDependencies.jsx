import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { useGetFileRelationsQuery } from '../store/slices/apiSlice';
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
    Link2,
    ArrowRight,
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

const buildSelectionContext = (fullCode, selectedValue) => {
    const selectedSnippet = String(selectedValue || '').trim();
    const source = String(fullCode || '');

    if (!selectedSnippet) {
        return {
            selectedSnippet: '',
            surroundingContext: '',
            lineRange: null,
        };
    }

    const selectedIndex = source.indexOf(selectedSnippet);
    if (selectedIndex < 0) {
        return {
            selectedSnippet,
            surroundingContext: selectedSnippet,
            lineRange: null,
        };
    }

    const before = source.slice(0, selectedIndex);
    const selectedLineCount = selectedSnippet.split('\n').length;
    const startLine = before.split('\n').length;
    const endLine = startLine + selectedLineCount - 1;

    const contextStart = Math.max(0, selectedIndex - 320);
    const contextEnd = Math.min(source.length, selectedIndex + selectedSnippet.length + 320);

    return {
        selectedSnippet,
        surroundingContext: source.slice(contextStart, contextEnd),
        lineRange: {
            start: startLine,
            end: endLine,
        },
    };
};

// ─── DependencySnippet ───────────────────────────────────────────────────────

const DependencySnippet = ({ file, snippet, isDark, selectedText }) => {
    const [expanded, setExpanded] = useState(true);
    const lang = getLanguage(file.path || '');
    const normalizedSnippet = useMemo(() => {
        if (typeof snippet === 'string') return snippet;
        if (snippet && typeof snippet === 'object') {
            try {
                return JSON.stringify(snippet, null, 2);
            } catch {
                return String(snippet);
            }
        }
        return '';
    }, [snippet]);
    const parsedLlmSnippet = useMemo(() => {
        if (file.type !== 'llm-insight') return null;
        if (!snippet) return null;
        if (snippet && typeof snippet === 'object') return snippet;
        if (typeof snippet !== 'string') return null;

        try {
            const parsed = JSON.parse(snippet);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    }, [file.type, snippet]);
    const personalizedInsight = file.personalizedInsight || null;

    const personalizedStatic = Array.isArray(personalizedInsight?.staticDependencies)
        ? personalizedInsight.staticDependencies
        : [];
    const personalizedRuntime = Array.isArray(personalizedInsight?.runtimeDependencies)
        ? personalizedInsight.runtimeDependencies
        : [];
    const personalizedActions = Array.isArray(personalizedInsight?.recommendedActions)
        ? personalizedInsight.recommendedActions
        : [];

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
        if (!selectedText || !normalizedSnippet) {
            return normalizedSnippet;
        }

        try {
            const lines = normalizedSnippet.split('\n');

            return lines.map((line, idx) => {
                const escapedText = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(${escapedText})`, 'i');
                const parts = line.split(regex);

                return (
                    <div key={idx} style={{ wordBreak: 'break-word' }}>
                        {parts.map((part, i) => {
                            if (part.toLowerCase() === selectedText.toLowerCase()) {
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
            return normalizedSnippet;
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
                        {file.type === 'llm-insight' && parsedLlmSnippet ? (
                            <div style={{ color: 'var(--text)' }}>
                                {Object.entries(parsedLlmSnippet).map(([key, value]) => (
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

                    {personalizedInsight && file.type !== 'llm-insight' && (
                        <div
                            style={{
                                margin: '0 0.75rem 0.75rem',
                                padding: '0.65rem',
                                borderRadius: '0.375rem',
                                border: '1px solid var(--border)',
                                background: 'var(--bg-muted)',
                            }}
                        >
                            <div style={{ color: '#3b82f6', fontSize: '0.72rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                Personalized Impact for this File
                            </div>

                            {personalizedInsight.whyRelated && (
                                <div style={{ color: 'var(--text)', fontSize: '0.76rem', marginBottom: '0.4rem' }}>
                                    {personalizedInsight.whyRelated}
                                </div>
                            )}

                            {personalizedInsight.impactSummary && (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.4rem' }}>
                                    {personalizedInsight.impactSummary}
                                </div>
                            )}

                            {personalizedStatic.length > 0 && (
                                <div style={{ color: 'var(--text)', fontSize: '0.72rem', marginBottom: '0.3rem' }}>
                                    Static: {personalizedStatic.slice(0, 3).join(' • ')}
                                </div>
                            )}

                            {personalizedRuntime.length > 0 && (
                                <div style={{ color: 'var(--text)', fontSize: '0.72rem', marginBottom: '0.3rem' }}>
                                    Runtime: {personalizedRuntime.slice(0, 3).join(' • ')}
                                </div>
                            )}

                            {personalizedActions.length > 0 && (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                    Next step: {personalizedActions[0]}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── LLM Insights Card ─────────────────────────────────────────────────────

const LLMInsightCard = ({ insight, meta, isDark }) => {
    const analysis = useMemo(() => {
        if (!insight) return null;
        if (typeof insight === 'object') return insight;

        try {
            return JSON.parse(insight);
        } catch {
            return { impactAnalysis: String(insight) };
        }
    }, [insight]);

    if (!analysis) {
        return null;
    }

    const getRiskColor = (risk) => {
        const colors = {
            LOW: '#10b981',
            MEDIUM: '#f59e0b',
            HIGH: '#ef4444',
            UNKNOWN: '#6b7280',
        };
        return colors[String(risk || '').toUpperCase()] || '#6b7280';
    };

    const listOrFallback = (value) => {
        if (Array.isArray(value)) {
            return value.map((item) => String(item).trim()).filter(Boolean);
        }
        if (typeof value === 'string' && value.trim()) {
            return [value.trim()];
        }
        return [];
    };

    const recommendations = listOrFallback(analysis.recommendations);
    const criticalDependencies = listOrFallback(analysis.criticalDependencies);
    const accessPatterns = listOrFallback(analysis.accessPatterns);

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
            <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#3b82f6', fontSize: '1.25rem' }}>🤖</span>
                    <h3 style={{ margin: 0, color: '#3b82f6', fontWeight: 600, fontSize: '0.95rem' }}>
                        AI Dependency Analysis
                    </h3>
                </div>
                {meta?.model && (
                    <span
                        className="code-text"
                        style={{
                            fontSize: '0.68rem',
                            color: '#bfdbfe',
                            background: '#1e3a8a',
                            padding: '0.25rem 0.45rem',
                            borderRadius: '0.25rem',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {meta.model}
                    </span>
                )}
            </div>

            {meta?.status && (
                <div style={{ marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    Analysis quality: {meta?.status || 'unknown'}
                </div>
            )}

            <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Type:</span>
                    <span style={{ color: 'var(--text)', fontWeight: 500, textAlign: 'right' }}>{analysis.dependencyType || 'Unknown'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Scope:</span>
                    <span style={{ color: 'var(--text)', fontWeight: 500, textAlign: 'right' }}>{analysis.dependencyScope || analysis.scope || 'Unknown'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Risk:</span>
                    <span
                        style={{
                            background: getRiskColor(analysis.riskLevel || analysis.riskAssessment),
                            color: '#fff',
                            padding: '0.2rem 0.45rem',
                            borderRadius: '0.25rem',
                            fontWeight: 600,
                            fontSize: '0.72rem',
                            textTransform: 'uppercase',
                        }}
                    >
                        {analysis.riskLevel || 'UNKNOWN'}
                    </span>
                </div>

                {analysis.impactAnalysis && (
                    <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                        <p style={{ margin: '0 0 0.4rem 0', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                            Impact Analysis
                        </p>
                        <p style={{ margin: 0, color: 'var(--text)', fontSize: '0.8rem', lineHeight: '1.45' }}>
                            {analysis.impactAnalysis}
                        </p>
                    </div>
                )}

                {criticalDependencies.length > 0 && (
                    <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                        <p style={{ margin: '0 0 0.4rem 0', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                            Critical Dependencies
                        </p>
                        <div style={{ display: 'grid', gap: '0.25rem' }}>
                            {criticalDependencies.slice(0, 5).map((item, idx) => (
                                <div key={`${item}-${idx}`} style={{ color: 'var(--text)', fontSize: '0.8rem' }}>
                                    • {item}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {accessPatterns.length > 0 && (
                    <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                        <p style={{ margin: '0 0 0.4rem 0', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                            Access Patterns
                        </p>
                        <div style={{ color: 'var(--text)', fontSize: '0.8rem' }}>
                            {accessPatterns.join(' • ')}
                        </div>
                    </div>
                )}

                {recommendations.length > 0 && (
                    <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                        <p style={{ margin: '0 0 0.4rem 0', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                            Recommendations
                        </p>
                        <div style={{ display: 'grid', gap: '0.25rem' }}>
                            {recommendations.slice(0, 5).map((item, idx) => (
                                <div key={`${item}-${idx}`} style={{ color: 'var(--text)', fontSize: '0.8rem' }}>
                                    • {item}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

// ─── DependencyPanel ───────────────────────────────────────────────────────────

const DependencyPanel = ({
    selectedText,
    dependencies,
    llmMeta,
    loading,
    error,
    isDark,
    fileRelations,
    relationsLoading,
    relationsError,
    staticRuntimeSummary,
    onClear,
}) => {
    // Separate LLM insights from regular dependencies
    const llmInsight = dependencies.find(dep => dep.type === 'llm-insight');
    const otherDeps = dependencies.filter(dep => dep.type !== 'llm-insight');
    const incomingFileDeps = fileRelations?.incoming || [];
    const outgoingFileDeps = fileRelations?.outgoing || [];
    const staticIncoming = fileRelations?.staticIncoming || [];
    const staticOutgoing = fileRelations?.staticOutgoing || [];
    const runtimeIncoming = fileRelations?.runtimeIncoming || [];
    const runtimeOutgoing = fileRelations?.runtimeOutgoing || [];
    const hasLiveFileData = Boolean(fileRelations?.hasLiveData);

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
                        Dependency Intelligence
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
                <div
                    style={{
                        border: '1px solid var(--border)',
                        borderRadius: '0.5rem',
                        padding: '0.75rem',
                        marginBottom: '1rem',
                        background: 'var(--bg-muted)',
                    }}
                >
                    <div className="flex items-center gap-2" style={{ marginBottom: '0.6rem' }}>
                        <Link2 size={14} style={{ color: '#3b82f6' }} />
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#3b82f6' }}>
                            File-Level Dependencies
                        </span>
                        {relationsLoading && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
                    </div>

                    {!hasLiveFileData && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)', margin: 0 }}>
                            Live graph relationships appear here once a scan and graph seed are available.
                        </p>
                    )}

                    {relationsError && (
                        <p className="text-xs" style={{ color: '#ef4444', margin: '0 0 0.5rem 0' }}>
                            Could not load file-level relationships.
                        </p>
                    )}

                    {hasLiveFileData && !relationsLoading && (
                        <div style={{ display: 'grid', gap: '0.65rem' }}>
                            <div>
                                <div className="text-xs" style={{ color: '#f97316', fontWeight: 600, marginBottom: '0.35rem' }}>
                                    Files depending on this ({incomingFileDeps.length})
                                </div>
                                {incomingFileDeps.length === 0 ? (
                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>No incoming dependencies.</div>
                                ) : (
                                    <div style={{ display: 'grid', gap: '0.25rem', maxHeight: '120px', overflowY: 'auto' }}>
                                        {incomingFileDeps.slice(0, 40).map((item) => (
                                            <div key={`in-${item}`} className="flex items-start gap-1" style={{ color: 'var(--text)', fontSize: '0.72rem' }}>
                                                <ArrowRight size={11} style={{ marginTop: '2px', color: '#f97316', flexShrink: 0 }} />
                                                <span style={{ wordBreak: 'break-word' }}>{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="text-xs" style={{ color: 'var(--text)', fontWeight: 600, marginBottom: '0.35rem' }}>
                                    Static relations ({staticIncoming.length + staticOutgoing.length})
                                </div>
                                {staticIncoming.length === 0 && staticOutgoing.length === 0 ? (
                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>No static relationships.</div>
                                ) : (
                                    <div style={{ display: 'grid', gap: '0.25rem', maxHeight: '120px', overflowY: 'auto' }}>
                                        {staticIncoming.slice(0, 20).map((item) => (
                                            <div key={`static-in-${item}`} className="flex items-start gap-1" style={{ color: 'var(--text)', fontSize: '0.72rem' }}>
                                                <ArrowRight size={11} style={{ marginTop: '2px', color: '#f97316', flexShrink: 0 }} />
                                                <span style={{ wordBreak: 'break-word' }}>IN: {item}</span>
                                            </div>
                                        ))}
                                        {staticOutgoing.slice(0, 20).map((item) => (
                                            <div key={`static-out-${item}`} className="flex items-start gap-1" style={{ color: 'var(--text)', fontSize: '0.72rem' }}>
                                                <ArrowRight size={11} style={{ marginTop: '2px', color: '#3b82f6', flexShrink: 0 }} />
                                                <span style={{ wordBreak: 'break-word' }}>OUT: {item}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="text-xs" style={{ color: 'var(--text)', fontWeight: 600, marginBottom: '0.35rem' }}>
                                    Runtime relations ({runtimeIncoming.length + runtimeOutgoing.length})
                                </div>
                                {runtimeIncoming.length === 0 && runtimeOutgoing.length === 0 ? (
                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>No runtime relationships.</div>
                                ) : (
                                    <div style={{ display: 'grid', gap: '0.25rem', maxHeight: '120px', overflowY: 'auto' }}>
                                        {runtimeIncoming.slice(0, 20).map((item) => (
                                            <div key={`runtime-in-${item}`} className="flex items-start gap-1" style={{ color: 'var(--text)', fontSize: '0.72rem' }}>
                                                <ArrowRight size={11} style={{ marginTop: '2px', color: '#22c55e', flexShrink: 0 }} />
                                                <span style={{ wordBreak: 'break-word' }}>IN: {item}</span>
                                            </div>
                                        ))}
                                        {runtimeOutgoing.slice(0, 20).map((item) => (
                                            <div key={`runtime-out-${item}`} className="flex items-start gap-1" style={{ color: 'var(--text)', fontSize: '0.72rem' }}>
                                                <ArrowRight size={11} style={{ marginTop: '2px', color: '#22c55e', flexShrink: 0 }} />
                                                <span style={{ wordBreak: 'break-word' }}>OUT: {item}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="text-xs" style={{ color: '#3b82f6', fontWeight: 600, marginBottom: '0.35rem' }}>
                                    Files this depends on ({outgoingFileDeps.length})
                                </div>
                                {outgoingFileDeps.length === 0 ? (
                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>No outgoing dependencies.</div>
                                ) : (
                                    <div style={{ display: 'grid', gap: '0.25rem', maxHeight: '120px', overflowY: 'auto' }}>
                                        {outgoingFileDeps.slice(0, 40).map((item) => (
                                            <div key={`out-${item}`} className="flex items-start gap-1" style={{ color: 'var(--text)', fontSize: '0.72rem' }}>
                                                <ArrowRight size={11} style={{ marginTop: '2px', color: '#3b82f6', flexShrink: 0 }} />
                                                <span style={{ wordBreak: 'break-word' }}>{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {!selectedText && (
                    <div className="text-center py-8">
                        <Search size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            Select any line or symbol to run deep cross-repository dependency analysis.
                        </p>
                    </div>
                )}

                {selectedText && loading && (
                    <div className="flex items-center justify-center gap-2 py-8">
                        <Loader2 size={16} className="animate-spin" style={{ color: '#3b82f6' }} />
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            Analyzing selected code across the repository…
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
                        {staticRuntimeSummary && (
                            <div
                                style={{
                                    border: '1px solid var(--border)',
                                    borderRadius: '0.5rem',
                                    padding: '0.65rem 0.75rem',
                                    marginBottom: '0.9rem',
                                    background: 'var(--bg-muted)',
                                }}
                            >
                                <div className="text-xs" style={{ color: 'var(--text)', fontWeight: 600, marginBottom: '0.3rem' }}>
                                    Static vs Runtime Coverage
                                </div>
                                <div className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: '1.45' }}>
                                    Files covered: {staticRuntimeSummary.totalFiles || 0} · Static links: {staticRuntimeSummary.staticDependencyCount || 0} · Runtime links: {staticRuntimeSummary.runtimeDependencyCount || 0}
                                </div>
                            </div>
                        )}

                        {/* LLM Insight Section - Shows First & Prominently */}
                        {llmInsight && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <LLMInsightCard insight={llmInsight.snippet} meta={llmMeta} isDark={isDark} />
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
    const [llmMeta, setLlmMeta] = useState(null);
    const [staticRuntimeSummary, setStaticRuntimeSummary] = useState(null);
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

    const {
        data: fileRelationsData,
        isFetching: relationsLoading,
        error: relationsError,
    } = useGetFileRelationsQuery(
        { scanId: currentScanId, filePath },
        {
            skip: !currentScanId || !filePath,
            pollingInterval: 5000,
            refetchOnFocus: true,
            refetchOnReconnect: true,
        }
    );

    const fileRelations = useMemo(() => ({
        incoming: fileRelationsData?.incoming || [],
        outgoing: fileRelationsData?.outgoing || [],
        staticIncoming: fileRelationsData?.staticIncoming || [],
        staticOutgoing: fileRelationsData?.staticOutgoing || [],
        runtimeIncoming: fileRelationsData?.runtimeIncoming || [],
        runtimeOutgoing: fileRelationsData?.runtimeOutgoing || [],
        hasLiveData: Boolean(currentScanId),
    }), [fileRelationsData, currentScanId]);

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
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) {
                return;
            }

            const selected = selection.toString().trim();

            // Only set if selection is within the code editor
            if (selected && codeEditorRef.current) {
                const range = selection.getRangeAt(0);
                const anchorNode = range?.commonAncestorContainer;
                const container = anchorNode?.nodeType === Node.TEXT_NODE
                    ? anchorNode.parentElement
                    : anchorNode;

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
            setLlmMeta(null);
            setStaticRuntimeSummary(null);
            setDepError('');
            return;
        }

        const queryDependencies = async () => {
            setDepLoading(true);
            setDepError('');
            setLlmMeta(null);
            setStaticRuntimeSummary(null);

            try {
                const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                const selectionContext = buildSelectionContext(code, selectedText);

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
                            selectedSnippet: selectionContext.selectedSnippet,
                            surroundingContext: selectionContext.surroundingContext,
                            lineRange: selectionContext.lineRange,
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
                    setLlmMeta({
                        status: 'not-available',
                        model: null,
                        message: 'LLM analysis requires an active scanId.',
                    });
                    setStaticRuntimeSummary(null);
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
                        selectedSnippet: selectionContext.selectedSnippet,
                        surroundingContext: selectionContext.surroundingContext,
                        lineRange: selectionContext.lineRange,
                        withLLM: true,
                    }),
                });

                if (!response.ok) {
                    throw new Error('Failed to analyze dependencies with LLM');
                }

                const result = await response.json();
                const data = result.data || {};
                const llmAnalysis = data.llmAnalysis || null;
                const personalizedInsights = Array.isArray(data.personalizedInsights?.files)
                    ? data.personalizedInsights.files
                    : [];
                const personalizedInsightsMap = new Map(
                    personalizedInsights
                        .filter((item) => item?.filePath)
                        .map((item) => [item.filePath, item])
                );
                const llmMetaState = llmAnalysis
                    ? {
                        status: llmAnalysis.status,
                        model: llmAnalysis.model,
                        contextStats: llmAnalysis.contextStats,
                        summary: data.summary,
                    }
                    : null;

                setLlmMeta(llmMetaState);
                setStaticRuntimeSummary(data.staticRuntimeDependencies || null);

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
                            personalizedInsight: personalizedInsightsMap.get(occ.filePath) || null,
                        }))
                    );
                }

                // Add dependencies
                if (data.dependencies?.perNode) {
                    Object.entries(data.dependencies.perNode).forEach(([nodeId, deps]) => {
                        const incoming = Array.isArray(deps?.incoming) ? deps.incoming : [];
                        const outgoing = Array.isArray(deps?.outgoing) ? deps.outgoing : [];

                        [...incoming, ...outgoing].forEach(dep => {
                            const targetPath = dep.targetName || dep.sourceName || 'unknown';
                            enrichedDeps.push({
                                id: `${nodeId}-${dep.targetId}`,
                                path: targetPath,
                                lineNumber: 0,
                                type: 'dependency',
                                displayName: `${dep.relationshipType}: ${targetPath}`,
                                snippet: `${dep.sourceType} → [${dep.relationshipType}] → ${dep.targetType}`,
                                personalizedInsight: personalizedInsightsMap.get(targetPath) || null,
                            });
                        });
                    });
                }

                // Add LLM insights
                if (llmAnalysis?.analysis) {
                    enrichedDeps.push({
                        id: 'llm-analysis',
                        path: 'AI Analysis',
                        lineNumber: 0,
                        type: 'llm-insight',
                        displayName: llmAnalysis.model
                            ? `LLM Dependency Analysis (${llmAnalysis.model})`
                            : 'LLM Dependency Analysis',
                        snippet: llmAnalysis.analysis,
                    });
                } else if (llmAnalysis && (llmAnalysis.message || llmAnalysis.error)) {
                    enrichedDeps.push({
                        id: 'llm-analysis-status',
                        path: 'AI Analysis',
                        lineNumber: 0,
                        type: 'llm-insight',
                        displayName: llmAnalysis.model
                            ? `LLM Dependency Analysis (${llmAnalysis.model})`
                            : 'LLM Dependency Analysis',
                        snippet: {
                            dependencyType: 'Unavailable',
                            dependencyScope: data.summary?.uniqueFiles > 1 ? 'cross-file' : 'local',
                            impactAnalysis: llmAnalysis.message || llmAnalysis.error,
                            riskLevel: 'UNKNOWN',
                            recommendations: ['Refine selection to a symbol/function name for deeper graph tracing.'],
                        },
                    });
                }

                setDependencies(enrichedDeps);
            } catch (err) {
                setDepError(err.message || 'Error analyzing dependencies');
                setDependencies([]);
                setLlmMeta(null);
                setStaticRuntimeSummary(null);
            } finally {
                setDepLoading(false);
            }
        };

        const timer = setTimeout(queryDependencies, 300);
        return () => clearTimeout(timer);
    }, [selectedText, currentRepoId, currentScanId, filePath, code]);

    const handleCopy = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleClearSelection = () => {
        setSelectedText('');
        setDependencies([]);
        setLlmMeta(null);
        setStaticRuntimeSummary(null);
    };

    const lineCount = code.split('\n').length;
    const sizeKb = (new Blob([code]).size / 1024).toFixed(1);

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
                        llmMeta={llmMeta}
                        fileRelations={fileRelations}
                        relationsLoading={relationsLoading}
                        relationsError={relationsError}
                        staticRuntimeSummary={staticRuntimeSummary}
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
