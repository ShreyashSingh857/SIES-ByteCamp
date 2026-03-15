import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { buildGitHubBlobUrl, buildGitHubRawUrl, normalizeRepoUrl } from '../lib/utils';
import {
    useGetFileRelationsQuery,
    useGetEditableFileQuery,
    usePreviewEditorImpactMutation,
    useSaveEditedFileMutation,
} from '../store/slices/apiSlice';
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
    Pencil,
    Save,
    AlertTriangle,
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

const DependencySnippet = ({ file, snippet, selectedText }) => {
    const [expanded, setExpanded] = useState(true);
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

    const riskLevel = String(personalizedInsight?.riskLevel || '').toUpperCase() || 'UNKNOWN';
    const impactCategoryRaw = String(personalizedInsight?.impactCategory || '').toUpperCase().replace(/\s+/g, '_');
    const impactCategory = impactCategoryRaw === 'IMPACT_JAIL' ? 'IMPACT_JAIL' : '';
    const getRiskColor = (risk) => {
        const colors = {
            LOW: '#10b981',
            MEDIUM: '#f59e0b',
            HIGH: '#ef4444',
            UNKNOWN: '#3b82f6',
        };
        return colors[String(risk || '').toUpperCase()] || '#3b82f6';
    };

    const accentColor = impactCategory === 'IMPACT_JAIL' ? '#ef4444' : getRiskColor(riskLevel);

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
                borderColor: accentColor,
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
                    <FileCode2 size={14} style={{ color: accentColor, flexShrink: 0 }} />
                    <code className="text-xs truncate" style={{ color: 'var(--text)', fontFamily: "'JetBrains Mono'" }}>
                        {file.displayName || file.path}
                    </code>
                    {file.lineNumber > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-muted)', color: accentColor }}>
                            L{file.lineNumber}
                        </span>
                    )}
                    {personalizedInsight?.riskLevel && (
                        <span
                            className="text-[0.65rem] px-2 py-0.5 rounded font-mono"
                            style={{
                                background: accentColor,
                                color: '#fff',
                                textTransform: 'uppercase',
                                flexShrink: 0,
                            }}
                        >
                            {impactCategory === 'IMPACT_JAIL' ? 'IMPACT JAIL' : riskLevel}
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

                    {personalizedInsight && (
                        <div
                            style={{
                                margin: '0 0.75rem 0.75rem',
                                padding: '0.65rem',
                                borderRadius: '0.375rem',
                                border: '1px solid var(--border)',
                                background: 'var(--bg-muted)',
                            }}
                        >
                            <div style={{ color: '#3b82f6', fontSize: '0.72rem', fontWeight: 600, marginBottom: '0.4rem' }}>Impact in this file</div>

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

const FileConnectionsSection = React.memo(({
    fileRelations,
    relationsLoading,
    relationsError,
}) => {
    const incomingFileDeps = fileRelations?.incoming || [];
    const outgoingFileDeps = fileRelations?.outgoing || [];
    const staticIncoming = fileRelations?.staticIncoming || [];
    const staticOutgoing = fileRelations?.staticOutgoing || [];
    const runtimeIncoming = fileRelations?.runtimeIncoming || [];
    const runtimeOutgoing = fileRelations?.runtimeOutgoing || [];
    const hasLiveFileData = Boolean(fileRelations?.hasLiveData);

    return (
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
                    This file connects to
                </span>
                {relationsLoading && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
            </div>

            {!hasLiveFileData && (
                <p className="text-xs" style={{ color: 'var(--text-muted)', margin: 0 }}>
                    File connections appear here once a scan is available.
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
                            Used by ({incomingFileDeps.length})
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
                            Static links ({staticIncoming.length + staticOutgoing.length})
                        </div>
                        {staticIncoming.length === 0 && staticOutgoing.length === 0 ? (
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>No static relationships.</div>
                        ) : (
                            <div style={{ display: 'grid', gap: '0.25rem', maxHeight: '120px', overflowY: 'auto' }}>
                                {staticIncoming.slice(0, 20).map((item) => (
                                    <div key={`static-in-${item}`} className="flex items-start gap-1" style={{ color: 'var(--text)', fontSize: '0.72rem' }}>
                                        <ArrowRight size={11} style={{ marginTop: '2px', color: '#f97316', flexShrink: 0 }} />
                                        <span style={{ wordBreak: 'break-word' }}>{item}</span>
                                    </div>
                                ))}
                                {staticOutgoing.slice(0, 20).map((item) => (
                                    <div key={`static-out-${item}`} className="flex items-start gap-1" style={{ color: 'var(--text)', fontSize: '0.72rem' }}>
                                        <ArrowRight size={11} style={{ marginTop: '2px', color: '#3b82f6', flexShrink: 0 }} />
                                        <span style={{ wordBreak: 'break-word' }}>{item}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <div className="text-xs" style={{ color: 'var(--text)', fontWeight: 600, marginBottom: '0.35rem' }}>
                            Runtime links ({runtimeIncoming.length + runtimeOutgoing.length})
                        </div>
                        {runtimeIncoming.length === 0 && runtimeOutgoing.length === 0 ? (
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>No runtime relationships.</div>
                        ) : (
                            <div style={{ display: 'grid', gap: '0.25rem', maxHeight: '120px', overflowY: 'auto' }}>
                                {runtimeIncoming.slice(0, 20).map((item) => (
                                    <div key={`runtime-in-${item}`} className="flex items-start gap-1" style={{ color: 'var(--text)', fontSize: '0.72rem' }}>
                                        <ArrowRight size={11} style={{ marginTop: '2px', color: '#22c55e', flexShrink: 0 }} />
                                        <span style={{ wordBreak: 'break-word' }}>{item}</span>
                                    </div>
                                ))}
                                {runtimeOutgoing.slice(0, 20).map((item) => (
                                    <div key={`runtime-out-${item}`} className="flex items-start gap-1" style={{ color: 'var(--text)', fontSize: '0.72rem' }}>
                                        <ArrowRight size={11} style={{ marginTop: '2px', color: '#22c55e', flexShrink: 0 }} />
                                        <span style={{ wordBreak: 'break-word' }}>{item}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <div className="text-xs" style={{ color: '#3b82f6', fontWeight: 600, marginBottom: '0.35rem' }}>
                            Uses ({outgoingFileDeps.length})
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
    );
});

// ─── DependencyPanel ───────────────────────────────────────────────────────────

const DependencyPanel = ({
    selectedText,
    dependencies,
    loading,
    error,
    fileRelations,
    relationsLoading,
    relationsError,
    staticRuntimeSummary,
    agentPreview,
    previewLoading,
    activityEvents,
    lastSaveResult,
    onClear,
}) => {
    const impactedFiles = Array.isArray(dependencies) ? dependencies : [];
    const detailedPlan = agentPreview?.llmDetailedImpact?.plan || null;
    const renameCandidates = Array.isArray(detailedPlan?.renameCandidates) ? detailedPlan.renameCandidates : [];
    const detailedFileEdits = Array.isArray(detailedPlan?.fileEdits) ? detailedPlan.fileEdits : [];
    const autoApplySummary = lastSaveResult?.relatedAutoApply || null;
    const appliedAutoEdits = Array.isArray(autoApplySummary?.appliedEdits) ? autoApplySummary.appliedEdits : [];
    const skippedAutoEdits = Array.isArray(autoApplySummary?.skippedEdits) ? autoApplySummary.skippedEdits : [];

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
                className="shrink-0 border-b flex items-center justify-between px-4 py-3"
                style={{ borderColor: 'var(--border)' }}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <Search size={14} style={{ color: '#3b82f6', flexShrink: 0 }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        Related impact
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
                        className="p-1 rounded hover:bg-opacity-80 transition-all shrink-0"
                        style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)' }}
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto px-4 py-3" style={{ color: 'var(--text)' }}>
                <FileConnectionsSection
                    fileRelations={fileRelations}
                    relationsLoading={relationsLoading}
                    relationsError={relationsError}
                />

                <div
                    style={{
                        border: '1px solid var(--border)',
                        borderRadius: '0.5rem',
                        padding: '0.75rem',
                        marginBottom: '1rem',
                        background: 'var(--bg-muted)',
                    }}
                >
                    <div className="flex items-center gap-2" style={{ marginBottom: '0.5rem' }}>
                        <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#f59e0b' }}>
                            Agentic AI impact preview
                        </span>
                        {previewLoading && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
                    </div>

                    {!agentPreview && !previewLoading && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)', margin: 0 }}>
                            Preview code impact to view changed-line stats, affected files, and dependency-agent recommendations.
                        </p>
                    )}

                    {agentPreview && (
                        <div style={{ display: 'grid', gap: '0.35rem' }}>
                            <div className="text-xs" style={{ color: 'var(--text)' }}>
                                Changed lines: <strong>{agentPreview.diffStats?.changedLineCount || 0}</strong> ·
                                Related files: <strong>{agentPreview.relationSummary?.totalRelatedFiles || 0}</strong>
                            </div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                Static links: {agentPreview.relationSummary?.staticIncomingCount || 0}/{agentPreview.relationSummary?.staticOutgoingCount || 0} ·
                                Runtime links: {agentPreview.relationSummary?.runtimeIncomingCount || 0}/{agentPreview.relationSummary?.runtimeOutgoingCount || 0}
                            </div>
                            {agentPreview.agentRecommendations?.summary && (
                                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    Missing deps: {agentPreview.agentRecommendations.summary.missingDependencies || 0} ·
                                    Removal candidates: {agentPreview.agentRecommendations.summary.removableCandidates || 0}
                                </div>
                            )}

                            {renameCandidates.length > 0 && (
                                <div style={{ marginTop: '0.35rem' }}>
                                    <div className="text-xs" style={{ color: '#3b82f6', fontWeight: 600 }}>
                                        Rename propagation candidates
                                    </div>
                                    <div style={{ display: 'grid', gap: '0.25rem', marginTop: '0.25rem' }}>
                                        {renameCandidates.slice(0, 8).map((candidate, index) => (
                                            <div key={`${candidate.oldName}-${candidate.newName}-${index}`} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                <span style={{ color: 'var(--text)' }}>{candidate.oldName}</span> → <span style={{ color: '#22c55e' }}>{candidate.newName}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {detailedFileEdits.length > 0 && (
                                <div style={{ marginTop: '0.35rem' }}>
                                    <div className="text-xs" style={{ color: '#3b82f6', fontWeight: 600 }}>
                                        Detailed line changes
                                    </div>
                                    <div style={{ display: 'grid', gap: '0.3rem', maxHeight: '170px', overflowY: 'auto', marginTop: '0.25rem' }}>
                                        {detailedFileEdits.slice(0, 20).map((edit, index) => (
                                            <div key={`${edit.filePath}-${edit.lineNumber}-${index}`} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                <div style={{ color: 'var(--text)' }}>{edit.filePath}{edit.lineNumber ? `:L${edit.lineNumber}` : ''}</div>
                                                <div>Old: {String(edit.oldText || '').slice(0, 80) || '—'}</div>
                                                <div style={{ color: '#22c55e' }}>New: {String(edit.newText || '').slice(0, 80) || '—'}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {autoApplySummary?.enabled && (
                    <div
                        style={{
                            border: '1px solid var(--border)',
                            borderRadius: '0.5rem',
                            padding: '0.75rem',
                            marginBottom: '1rem',
                            background: 'var(--bg-muted)',
                        }}
                    >
                        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#22c55e', marginBottom: '0.35rem' }}>
                            Auto-applied related changes
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Applied: {autoApplySummary.appliedCount || 0} · Skipped: {autoApplySummary.skippedCount || 0}
                        </div>

                        {appliedAutoEdits.length > 0 && (
                            <div style={{ marginTop: '0.45rem' }}>
                                <div className="text-xs" style={{ color: '#22c55e', fontWeight: 600, marginBottom: '0.25rem' }}>
                                    Applied changes
                                </div>
                                <div style={{ display: 'grid', gap: '0.3rem', maxHeight: '150px', overflowY: 'auto' }}>
                                    {appliedAutoEdits.slice(0, 20).map((edit, index) => (
                                        <div key={`${edit.filePath || 'file'}-${edit.lineNumber || 0}-${index}`} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                            <div style={{ color: 'var(--text)' }}>
                                                {edit.filePath || 'unknown'}{edit.lineNumber ? `:L${edit.lineNumber}` : ''}
                                            </div>
                                            <div>Old: {String(edit.oldText || '').slice(0, 90) || '—'}</div>
                                            <div style={{ color: '#22c55e' }}>New: {String(edit.newText || '').slice(0, 90) || '—'}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {skippedAutoEdits.length > 0 && (
                            <div style={{ marginTop: '0.45rem' }}>
                                <div className="text-xs" style={{ color: '#f59e0b', fontWeight: 600, marginBottom: '0.25rem' }}>
                                    Skipped changes
                                </div>
                                <div style={{ display: 'grid', gap: '0.25rem', maxHeight: '110px', overflowY: 'auto' }}>
                                    {skippedAutoEdits.slice(0, 10).map((edit, index) => (
                                        <div key={`skipped-${edit.filePath || 'file'}-${index}`} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                            {(edit.filePath || 'unknown')} · {edit.reason || 'Skipped'}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div
                    style={{
                        border: '1px solid var(--border)',
                        borderRadius: '0.5rem',
                        padding: '0.75rem',
                        marginBottom: '1rem',
                        background: 'var(--bg-muted)',
                    }}
                >
                    <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#3b82f6', marginBottom: '0.5rem' }}>
                        Agent activity
                    </div>
                    {(!activityEvents || activityEvents.length === 0) ? (
                        <p className="text-xs" style={{ color: 'var(--text-muted)', margin: 0 }}>
                            Waiting for webhook/agent events…
                        </p>
                    ) : (
                        <div style={{ display: 'grid', gap: '0.35rem', maxHeight: '140px', overflowY: 'auto' }}>
                            {activityEvents.slice(0, 10).map((eventItem) => (
                                <div key={eventItem.id} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    <span style={{ color: 'var(--text)' }}>{eventItem.type}</span>
                                    {eventItem.filePath ? ` · ${eventItem.filePath}` : ''}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {!selectedText && (
                    <div className="text-center py-8">
                        <Search size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            Select code to see where it matters across the repo.
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

                {selectedText && !loading && impactedFiles.length > 0 && (
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

                        <div>
                            <div className="text-xs mb-3" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                                Affected files: {impactedFiles.length}
                            </div>
                            {impactedFiles.map((dep, idx) => (
                                <DependencySnippet
                                    key={dep.id || idx}
                                    file={dep}
                                    snippet={dep.snippet}
                                    selectedText={selectedText}
                                />
                            ))}
                        </div>
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
    const normalizedRepoUrl = useMemo(() => normalizeRepoUrl(currentRepoUrl), [currentRepoUrl]);

    const [code, setCode] = useState('');
    const [draftCode, setDraftCode] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [selectedText, setSelectedText] = useState('');
    const [dependencies, setDependencies] = useState([]);
    const [staticRuntimeSummary, setStaticRuntimeSummary] = useState(null);
    const [depLoading, setDepLoading] = useState(false);
    const [depError, setDepError] = useState('');
    const [isEditMode, setIsEditMode] = useState(false);
    const [agentPreview, setAgentPreview] = useState(null);
    const [impactAcknowledged, setImpactAcknowledged] = useState(false);
    const [autoApplyRelatedChanges, setAutoApplyRelatedChanges] = useState(true);
    const [lastSaveResult, setLastSaveResult] = useState(null);
    const [editorError, setEditorError] = useState('');
    const [activityEvents, setActivityEvents] = useState([]);
    const codeEditorRef = useRef(null);
    const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

    const {
        data: editableFileData,
        isFetching: editableFileLoading,
        error: editableFileError,
    } = useGetEditableFileQuery(
        { repoId: currentRepoId, filePath },
        {
            skip: !currentRepoId || !filePath,
            refetchOnFocus: true,
            refetchOnReconnect: true,
        }
    );

    const [previewEditorImpact, { isLoading: previewImpactLoading }] = usePreviewEditorImpactMutation();
    const [saveEditedFile, { isLoading: saveEditedFileLoading }] = useSaveEditedFileMutation();

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
    } = useGetFileRelationsQuery(
        { scanId: currentScanId, filePath },
        {
            skip: !currentScanId || !filePath,
            refetchOnFocus: false,
            refetchOnReconnect: false,
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

    // Fetch editable file from backend first, then fallback to GitHub raw if needed
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


    useEffect(() => {
        if (!currentRepoId) {
            setActivityEvents([]);
            return undefined;
        }

        const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
        const eventSource = new EventSource(`${API_URL}/events/${currentRepoId}`);

        eventSource.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data || '{}');
                setActivityEvents((prev) => [
                    {
                        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        type: payload.type || 'EVENT',
                        filePath: payload.filePath || '',
                        timestamp: payload.timestamp || new Date().toISOString(),
                    },
                    ...prev,
                ].slice(0, 20));
            } catch {
                // ignore malformed event payloads
            }
        };

        return () => eventSource.close();
    }, [currentRepoId]);

    // Handle text selection in code editor
    useEffect(() => {
        const handleTextSelection = () => {
            if (isEditMode) {
                return;
            }

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
    }, [isEditMode]);

    // Query dependencies when text is selected
    useEffect(() => {
        if (!selectedText || !currentRepoId) {
            setDependencies([]);
            setStaticRuntimeSummary(null);
            setDepError('');
            return;
        }

        const queryDependencies = async () => {
            setDepLoading(true);
            setDepError('');
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
                    throw new Error('Failed to analyze selected code');
                }

                const result = await response.json();
                const data = result.data || {};
                const personalizedInsights = Array.isArray(data.personalizedInsights?.files)
                    ? data.personalizedInsights.files
                    : [];
                const personalizedInsightsMap = new Map(
                    personalizedInsights
                        .filter((item) => item?.filePath)
                        .map((item) => [item.filePath, item])
                );
                setStaticRuntimeSummary(data.staticRuntimeDependencies || null);

                const occurrences = Array.isArray(data.symbolOccurrences) ? data.symbolOccurrences : [];
                const references = Array.isArray(data.references) ? data.references : [];
                const occurrencesByFile = new Map();
                for (const occ of occurrences) {
                    const occPath = String(occ?.filePath || '').trim() || 'unknown';
                    if (!occurrencesByFile.has(occPath)) occurrencesByFile.set(occPath, []);
                    occurrencesByFile.get(occPath).push(occ);
                }
                const referencesByFile = new Map(
                    references
                        .filter((ref) => ref?.filePath)
                        .map((ref) => [ref.filePath, ref])
                );

                const buildEvidenceSnippet = (filePathValue) => {
                    const lines = [];
                    const fileOccurrences = occurrencesByFile.get(filePathValue) || [];
                    const fileRef = referencesByFile.get(filePathValue);

                    if (fileOccurrences.length > 0) {
                        lines.push('Where it shows up');
                        fileOccurrences
                            .slice(0, 6)
                            .forEach((o) => {
                                const label = o.displayName || o.type || 'match';
                                const ln = o.lineNumber ? `L${o.lineNumber}` : '';
                                lines.push(`- ${label}${ln ? ` (${ln})` : ''}`);
                            });
                    }

                    const funcs = Array.isArray(fileRef?.functions) ? fileRef.functions : [];
                    if (funcs.length > 0) {
                        if (lines.length > 0) lines.push('');
                        lines.push('Related functions');
                        funcs
                            .slice(0, 6)
                            .forEach((fn) => {
                                const name = fn.qualifiedName || fn.name || 'function';
                                const ln = fn.lineStart ? `L${fn.lineStart}` : '';
                                lines.push(`- ${name}${ln ? ` (${ln})` : ''}`);
                            });
                    }

                    return lines.join('\n');
                };

                const fileInsightList = Array.isArray(personalizedInsights) && personalizedInsights.length > 0
                    ? personalizedInsights
                    : [...new Set(occurrences.map((o) => o?.filePath).filter(Boolean))].map((filePathValue) => ({
                        filePath: filePathValue,
                    }));

                const fileCards = fileInsightList
                    .filter((item) => item?.filePath)
                    .map((item) => {
                        const insight = personalizedInsightsMap.get(item.filePath) || null;
                        const fileOccurrences = occurrencesByFile.get(item.filePath) || [];
                        const firstLine = fileOccurrences.find((o) => Number(o?.lineNumber) > 0)?.lineNumber || 0;

                        return {
                            id: `impact-${item.filePath}`,
                            path: item.filePath,
                            lineNumber: firstLine,
                            type: 'file-impact',
                            displayName: item.filePath,
                            snippet: buildEvidenceSnippet(item.filePath),
                            personalizedInsight: insight,
                        };
                    });

                setDependencies(fileCards);
            } catch (err) {
                setDepError(err.message || 'Error analyzing dependencies');
                setDependencies([]);
                setStaticRuntimeSummary(null);
            } finally {
                setDepLoading(false);
            }
        };

        const timer = setTimeout(queryDependencies, 300);
        return () => clearTimeout(timer);
    }, [selectedText, currentRepoId, currentScanId, filePath, code]);

    const handleCopy = () => {
        navigator.clipboard.writeText(isEditMode ? draftCode : code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleEditModeToggle = () => {
        setIsEditMode(true);
        setDraftCode(code);
        setSelectedText('');
        setDependencies([]);
        setStaticRuntimeSummary(null);
        setAgentPreview(null);
        setImpactAcknowledged(false);
        setLastSaveResult(null);
        setEditorError('');
    };

    const handleCancelEdit = () => {
        setDraftCode(code);
        setIsEditMode(false);
        setSelectedText('');
        setDependencies([]);
        setStaticRuntimeSummary(null);
        setAgentPreview(null);
        setImpactAcknowledged(false);
        setLastSaveResult(null);
        setEditorError('');
    };

    const handlePreviewImpact = async () => {
        if (!currentRepoId || !filePath) {
            setEditorError('Repository context is missing. Please rescan and try again.');
            return;
        }

        if (draftCode === code) {
            setEditorError('No editor changes detected.');
            return;
        }

        try {
            setEditorError('');
            const preview = await previewEditorImpact({
                repoId: currentRepoId,
                scanId: currentScanId || undefined,
                filePath,
                updatedContent: draftCode,
                withLlm: true,
            }).unwrap();

            setAgentPreview(preview);
            setImpactAcknowledged(false);
        } catch (err) {
            setAgentPreview(null);
            setImpactAcknowledged(false);
            setEditorError(err?.data?.message || err?.message || 'Failed to preview impact.');
        }
    };

    const handleSaveEditedFile = async () => {
        if (!isEditMode) {
            return;
        }

        if (draftCode === code) {
            setEditorError('No changes to save.');
            return;
        }

        if (!agentPreview?.acknowledgementToken) {
            setEditorError('Preview impact before saving.');
            return;
        }

        if (!impactAcknowledged) {
            setEditorError('Please acknowledge impact before saving.');
            return;
        }

        try {
            setEditorError('');
            const response = await saveEditedFile({
                repoId: currentRepoId,
                scanId: currentScanId || undefined,
                filePath,
                updatedContent: draftCode,
                acknowledged: true,
                acknowledgementToken: agentPreview.acknowledgementToken,
                withLlm: true,
                autoApplyRelatedChanges,
            }).unwrap();

            if (response?.saved) {
                setLastSaveResult(response);
                setCode(draftCode);
                setIsEditMode(false);
                setAgentPreview(null);
                setImpactAcknowledged(false);
                setSelectedText('');
                setDependencies([]);
                setStaticRuntimeSummary(null);
            }
        } catch (err) {
            setEditorError(err?.data?.message || err?.message || 'Failed to save file.');
        }
    };

    const handleClearSelection = () => {
        setSelectedText('');
        setDependencies([]);
        setStaticRuntimeSummary(null);
    };

    useEffect(() => {
        if (!isEditMode) {
            return;
        }

        setAgentPreview(null);
        setImpactAcknowledged(false);
    }, [draftCode, isEditMode]);

    const displayCode = isEditMode ? draftCode : code;
    const lineCount = displayCode.split('\n').length;
    const sizeKb = (new Blob([displayCode]).size / 1024).toFixed(1);

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
            <div className="shrink-0 px-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
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

                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {!loading && !error && !isEditMode && (
                        <button
                            onClick={handleEditModeToggle}
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-all"
                            style={{
                                background: 'rgba(59,130,246,0.1)',
                                color: '#3b82f6',
                                border: '1px solid rgba(59,130,246,0.3)',
                            }}
                        >
                            <Pencil size={12} /> Edit
                        </button>
                    )}

                    {!loading && !error && isEditMode && (
                        <>
                            <button
                                onClick={handleCancelEdit}
                                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-all"
                                style={{
                                    background: 'var(--bg-muted)',
                                    color: 'var(--text-muted)',
                                    border: '1px solid var(--border)',
                                }}
                            >
                                <X size={12} /> Cancel
                            </button>

                            <button
                                onClick={handlePreviewImpact}
                                disabled={previewImpactLoading || saveEditedFileLoading || draftCode === code}
                                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-all disabled:opacity-50"
                                style={{
                                    background: 'rgba(245,158,11,0.1)',
                                    color: '#f59e0b',
                                    border: '1px solid rgba(245,158,11,0.3)',
                                }}
                            >
                                {previewImpactLoading ? <Loader2 size={12} className="animate-spin" /> : <AlertTriangle size={12} />}
                                Preview Impact
                            </button>

                            <button
                                onClick={handleSaveEditedFile}
                                disabled={saveEditedFileLoading || previewImpactLoading || !impactAcknowledged || !agentPreview?.acknowledgementToken}
                                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-all disabled:opacity-50"
                                style={{
                                    background: '#1e3a8a',
                                    color: '#93c5fd',
                                    border: '1px solid rgba(59,130,246,0.3)',
                                }}
                            >
                                {saveEditedFileLoading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                Save
                            </button>
                        </>
                    )}

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

            {editorError && (
                <div className="px-4">
                    <div
                        className="text-xs px-3 py-2 rounded-md"
                        style={{
                            background: 'rgba(239,68,68,0.1)',
                            color: '#ef4444',
                            border: '1px solid rgba(239,68,68,0.3)',
                        }}
                    >
                        {editorError}
                    </div>
                </div>
            )}

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
                        className="shrink-0 flex items-center justify-between px-4 py-2"
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
                        <div className="flex items-center gap-2">
                            {isEditMode && (
                                <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
                                    Editing
                                </span>
                            )}
                            {rawUrl && (
                                <span className="text-xs code-text truncate max-w-xs hidden sm:block" style={{ color: 'var(--text-muted)' }}>
                                    {rawUrl}
                                </span>
                            )}
                        </div>
                    </div>

                    {isEditMode && (
                        <div
                            className="shrink-0 px-4 py-2"
                            style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}
                        >
                            <label className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                                <input
                                    type="checkbox"
                                    checked={impactAcknowledged}
                                    disabled={!agentPreview?.acknowledgementToken}
                                    onChange={(event) => setImpactAcknowledged(event.target.checked)}
                                    style={{ marginTop: '2px' }}
                                />
                                <span>
                                    I acknowledge the predicted impact before applying this code change.
                                    {!agentPreview?.acknowledgementToken ? ' (Run “Preview Impact” first)' : ''}
                                </span>
                            </label>

                            <label className="flex items-start gap-2 text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                                <input
                                    type="checkbox"
                                    checked={autoApplyRelatedChanges}
                                    onChange={(event) => setAutoApplyRelatedChanges(event.target.checked)}
                                    style={{ marginTop: '2px' }}
                                />
                                <span>
                                    Auto-apply related call-site updates suggested by LLM after save.
                                </span>
                            </label>
                        </div>
                    )}

                    {/* Loading */}
                    {loading && (
                        <div className="flex-1 flex items-center justify-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                            <Loader2 size={16} className="animate-spin" />
                            Loading file content...
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
                        isEditMode ? (
                            <div className="flex-1" style={{ background: 'var(--card)' }}>
                                <textarea
                                    value={draftCode}
                                    onChange={(event) => {
                                        setDraftCode(event.target.value);
                                        setEditorError('');
                                    }}
                                    className="w-full h-full resize-none p-4 code-text"
                                    style={{
                                        background: 'var(--card)',
                                        color: 'var(--text)',
                                        border: 'none',
                                        outline: 'none',
                                        fontSize: '0.8125rem',
                                        lineHeight: 1.6,
                                        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                                    }}
                                    spellCheck={false}
                                />
                            </div>
                        ) : (
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
                        )
                    )}
                </div>

                {/* Right: Dependency panel */}
                <div style={{ flex: '0 0 35%', minWidth: '300px' }}>
                    <DependencyPanel
                        selectedText={selectedText}
                        dependencies={dependencies}
                        fileRelations={fileRelations}
                        relationsLoading={relationsLoading}
                        relationsError={relationsError}
                        staticRuntimeSummary={staticRuntimeSummary}
                        agentPreview={agentPreview}
                        previewLoading={previewImpactLoading || saveEditedFileLoading}
                        activityEvents={activityEvents}
                        lastSaveResult={lastSaveResult}
                        loading={depLoading}
                        error={depError}
                        onClear={handleClearSelection}
                    />
                </div>
            </div>
        </div>
    );
};

export default FileViewerWithDependencies;
