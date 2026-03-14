import 'dotenv/config';
import OpenAI from 'openai';

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL,
});

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const DEFAULT_API_MODE = process.env.OPENAI_API_MODE || 'responses';

function truncateText(value, maxLength = 1600) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
}

function toArray(value) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item)).map((item) => item.trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
        return value
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean);
    }
    return [];
}

function extractTextResponse(response) {
    if (typeof response?.output_text === 'string' && response.output_text.trim()) {
        return response.output_text.trim();
    }

    if (!response?.output?.length) {
        return '';
    }

    for (const outputItem of response.output) {
        if (!outputItem?.content?.length) {
            continue;
        }

        for (const contentItem of outputItem.content) {
            if (contentItem?.type === 'output_text' && contentItem?.text) {
                return String(contentItem.text).trim();
            }
        }
    }

    return '';
}

function extractTextFromChatCompletion(response) {
    const firstChoice = response?.choices?.[0];
    const content = firstChoice?.message?.content;

    if (typeof content === 'string') {
        return content.trim();
    }

    if (Array.isArray(content)) {
        return content
            .map((item) => item?.text ?? '')
            .join('')
            .trim();
    }

    return '';
}

function extractFirstJsonObject(text) {
    if (!text || typeof text !== 'string') {
        return null;
    }

    const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = fencedMatch ? fencedMatch[1] : text;
    const direct = candidate.match(/\{[\s\S]*\}/);
    if (!direct) {
        return null;
    }

    try {
        return JSON.parse(direct[0]);
    } catch {
        return null;
    }
}

function normalizeRiskLevel(value) {
    const normalized = String(value ?? '').toUpperCase();
    if (normalized.includes('HIGH')) return 'HIGH';
    if (normalized.includes('MEDIUM')) return 'MEDIUM';
    if (normalized.includes('LOW')) return 'LOW';
    return 'UNKNOWN';
}

function normalizeConfidence(value) {
    const normalized = String(value ?? '').toUpperCase();
    if (normalized === 'HIGH' || normalized === 'MEDIUM' || normalized === 'LOW') {
        return normalized;
    }
    return 'MEDIUM';
}

function normalizeFileInsight(rawInsight, fallbackFilePath = '') {
    const source = rawInsight && typeof rawInsight === 'object' && !Array.isArray(rawInsight)
        ? rawInsight
        : {};

    const filePath = String(
        source.filePath ||
        source.path ||
        fallbackFilePath ||
        ''
    ).trim();

    return {
        filePath,
        whyRelated: truncateText(source.whyRelated || source.relationSummary || source.reason || '', 500),
        staticDependencies: toArray(source.staticDependencies || source.staticDeps),
        runtimeDependencies: toArray(source.runtimeDependencies || source.runtimeDeps),
        impactSummary: truncateText(source.impactSummary || source.impactAnalysis || source.impact || '', 700),
        riskLevel: normalizeRiskLevel(source.riskLevel || source.riskAssessment),
        recommendedActions: toArray(source.recommendedActions || source.recommendations),
        confidence: normalizeConfidence(source.confidence),
    };
}

function buildFallbackFileInsight(fileContext, selectedText, implicitDependencies) {
    const filePath = String(fileContext?.filePath || '').trim();
    const occurrences = Array.isArray(fileContext?.occurrences) ? fileContext.occurrences : [];
    const dependencies = Array.isArray(fileContext?.dependencies) ? fileContext.dependencies : [];

    const staticDependencies = dependencies
        .filter((dep) => dep?.dependencyNature === 'static')
        .slice(0, 6)
        .map((dep) => `${dep.relationshipType || 'RELATED_TO'} ${dep.relatedEntity || dep.relatedId || 'unknown target'}`);

    const runtimeDependencies = dependencies
        .filter((dep) => dep?.dependencyNature === 'runtime')
        .slice(0, 6)
        .map((dep) => `${dep.relationshipType || 'RELATED_TO'} ${dep.relatedEntity || dep.relatedId || 'unknown target'}`);

    const inferredRuntime = toArray(implicitDependencies?.runtime_dependencies).slice(0, 2);
    const mergedRuntimeDependencies = [...new Set([...runtimeDependencies, ...inferredRuntime])].slice(0, 8);

    const selectedLabel = String(selectedText || '').trim() || 'selected code';
    const riskLevel = mergedRuntimeDependencies.length > 0
        ? (staticDependencies.length > 2 ? 'HIGH' : 'MEDIUM')
        : (staticDependencies.length > 2 ? 'MEDIUM' : 'LOW');

    return {
        filePath,
        whyRelated: occurrences.length > 0
            ? `Matches for "${selectedLabel}" were found in this file and connected through graph relationships.`
            : `This file is connected to "${selectedLabel}" through dependency traversal.`,
        staticDependencies,
        runtimeDependencies: mergedRuntimeDependencies,
        impactSummary: mergedRuntimeDependencies.length > 0
            ? 'Runtime and integration flows in this file can amplify downstream impact if the selected code changes.'
            : 'Changes to the selected code can affect compile-time or structural dependencies in this file.',
        riskLevel,
        recommendedActions: [
            'Review symbol usages in this file before refactoring.',
            mergedRuntimeDependencies.length > 0
                ? 'Re-run integration and API-facing tests for this file.'
                : 'Validate import/call graph consistency after updates.',
        ],
        confidence: 'MEDIUM',
    };
}

function normalizeDependencyAnalysis(analysis, fallbackText = '') {
    if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) {
        return {
            dependencyType: 'Unknown',
            dependencyScope: 'Unknown',
            impactAnalysis: truncateText(fallbackText, 1000) || 'No structured analysis returned by the model.',
            criticalDependencies: [],
            accessPatterns: [],
            riskAssessment: 'Unknown',
            recommendations: [],
            confidence: 'MEDIUM',
            neo4jEvidence: {
                note: 'LLM did not return a structured JSON payload.',
            },
            scope: 'Unknown',
            riskLevel: 'UNKNOWN',
            reason: truncateText(fallbackText, 500),
        };
    }

    const dependencyType =
        analysis.dependencyType ||
        analysis.type ||
        analysis.dependency_type ||
        'Unknown';

    const dependencyScope =
        analysis.dependencyScope ||
        analysis.scope ||
        analysis.dependency_scope ||
        'Unknown';

    const impactAnalysis =
        analysis.impactAnalysis ||
        analysis.impact ||
        analysis.impact_prediction ||
        'No explicit impact analysis provided.';

    const riskRaw =
        analysis.riskAssessment ||
        analysis.risk ||
        analysis.riskLevel ||
        analysis.risk_level ||
        'Unknown';

    const recommendations = toArray(analysis.recommendations || analysis.suggestions);
    const criticalDependencies = toArray(analysis.criticalDependencies || analysis.critical_dependencies);
    const accessPatterns = toArray(analysis.accessPatterns || analysis.access_patterns);
    const confidence = String(analysis.confidence || 'MEDIUM').toUpperCase();
    const riskLevel = normalizeRiskLevel(riskRaw);

    return {
        dependencyType,
        dependencyScope,
        impactAnalysis: typeof impactAnalysis === 'string' ? impactAnalysis : JSON.stringify(impactAnalysis),
        criticalDependencies,
        accessPatterns,
        riskAssessment: typeof riskRaw === 'string' ? riskRaw : JSON.stringify(riskRaw),
        recommendations,
        confidence,
        neo4jEvidence: analysis.neo4jEvidence || analysis.evidence || {},
        scope: dependencyScope,
        impact: riskLevel === 'UNKNOWN' ? 'MEDIUM' : riskLevel,
        riskLevel,
        reason: typeof analysis.reason === 'string' ? analysis.reason : truncateText(JSON.stringify(analysis), 500),
    };
}

async function runLlmRequest(prompt, options = {}) {
    const model = options.model || DEFAULT_MODEL;
    const maxOutputTokens = Number(options.maxOutputTokens || 1500);
    const apiMode = options.apiMode || DEFAULT_API_MODE;
    const systemPrompt = options.systemPrompt || 'You produce strict JSON only. No markdown or extra text.';

    let text = '';
    let usageTokens = { input: 0, output: 0 };
    let modeUsed = apiMode;

    if (apiMode === 'chat') {
        const chatResponse = await client.chat.completions.create({
            model,
            max_tokens: maxOutputTokens,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ],
        });
        text = extractTextFromChatCompletion(chatResponse);
        usageTokens = {
            input: chatResponse?.usage?.prompt_tokens || 0,
            output: chatResponse?.usage?.completion_tokens || 0,
        };
        return { text, usageTokens, modeUsed, model };
    }

    try {
        const response = await client.responses.create({
            model,
            input: [
                {
                    role: 'system',
                    content: [
                        {
                            type: 'input_text',
                            text: systemPrompt,
                        },
                    ],
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'input_text',
                            text: prompt,
                        },
                    ],
                },
            ],
            max_output_tokens: maxOutputTokens,
        });

        text = extractTextResponse(response);
        usageTokens = {
            input: response?.usage?.input_tokens || 0,
            output: response?.usage?.output_tokens || 0,
        };
    } catch {
        modeUsed = 'chat-fallback';
        const chatResponse = await client.chat.completions.create({
            model,
            max_tokens: maxOutputTokens,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ],
        });
        text = extractTextFromChatCompletion(chatResponse);
        usageTokens = {
            input: chatResponse?.usage?.prompt_tokens || 0,
            output: chatResponse?.usage?.completion_tokens || 0,
        };
    }

    return { text, usageTokens, modeUsed, model };
}

/**
 * Analyze dependencies using LLM to understand relationships and impact
 * @param {string} selectedText The highlighted/selected symbol or code
 * @param {Object} graphContext The graph context from Neo4j (nodes, edges)
 * @param {Array} occurrences The occurrences found in the codebase
 * @param {Object} options Additional context from the UI and controller
 * @returns {Object} LLM analysis with insights about dependencies
 */
export async function analyzeDependenciesWithLLM(selectedText, graphContext, occurrences, options = {}) {
    if (!process.env.OPENAI_API_KEY) {
        return {
            status: 'skipped',
            message: 'OpenAI API key not configured',
            analysis: null,
            model: DEFAULT_MODEL,
        };
    }

    try {
        const selectedContext = {
            filePath: options.currentFile || null,
            selectedSnippet: truncateText(options.selectedSnippet || selectedText, 1200),
            surroundingContext: truncateText(options.surroundingContext || '', 2000),
            lineRange: options.lineRange || null,
        };

        const contextPayload = {
            selectedContext,
            graphStats: {
                nodes: graphContext?.nodes?.length || 0,
                edges: graphContext?.edges?.length || 0,
                relationshipTypes: [...new Set((graphContext?.edges || []).map((edge) => edge.type))].slice(0, 25),
            },
            dependencySummary: options.dependencySummary || {},
            occurrences: (occurrences || []).slice(0, 60),
            references: (options.references || []).slice(0, 40),
            nodes: (graphContext?.nodes || []).slice(0, 120),
            edges: (graphContext?.edges || []).slice(0, 160),
        };

        const prompt = [
            'You are an expert software dependency analyst.',
            'Analyze the selected code and use the provided Neo4j graph evidence to explain dependencies thoroughly.',
            'Return STRICT JSON only with this exact schema:',
            '{',
            '  "dependencyType": "",',
            '  "dependencyScope": "",',
            '  "impactAnalysis": "",',
            '  "criticalDependencies": [""],',
            '  "accessPatterns": [""],',
            '  "riskAssessment": "",',
            '  "recommendations": [""],',
            '  "confidence": "LOW|MEDIUM|HIGH",',
            '  "neo4jEvidence": {',
            '    "occurrenceCount": 0,',
            '    "referenceCount": 0,',
            '    "nodeCount": 0,',
            '    "edgeCount": 0,',
            '    "topRelationships": [""]',
            '  }',
            '}',
            '',
            'Evidence payload:',
            JSON.stringify(contextPayload),
        ].join('\n');

        const llmResult = await runLlmRequest(prompt, {
            model: options.model || DEFAULT_MODEL,
            maxOutputTokens: 1800,
        });

        const parsed = extractFirstJsonObject(llmResult.text);
        const normalized = normalizeDependencyAnalysis(parsed, llmResult.text);

        return {
            status: 'completed',
            message: 'LLM analysis completed successfully',
            analysis: normalized,
            rawAnalysis: parsed || { raw: llmResult.text },
            model: llmResult.model,
            modeUsed: llmResult.modeUsed,
            usageTokens: llmResult.usageTokens,
            contextStats: {
                occurrences: contextPayload.occurrences.length,
                references: contextPayload.references.length,
                nodes: contextPayload.nodes.length,
                edges: contextPayload.edges.length,
            },
        };
    } catch (error) {
        console.error('LLM Service Error:', error);
        return {
            status: 'error',
            message: error.message || 'Failed to analyze dependencies with LLM',
            error: error.message,
            model: options.model || DEFAULT_MODEL,
        };
    }
}

export async function generatePerFileDependencyInsights(selectedText, fileContexts = [], options = {}) {
    const normalizedContexts = Array.isArray(fileContexts)
        ? fileContexts.filter((item) => item?.filePath)
        : [];

    if (normalizedContexts.length === 0) {
        return {
            status: 'skipped',
            message: 'No file-level dependency contexts available',
            files: [],
            model: options.model || DEFAULT_MODEL,
        };
    }

    const fallbackInsights = normalizedContexts.map((context) =>
        buildFallbackFileInsight(context, selectedText, options.implicitDependencies)
    );

    if (!process.env.OPENAI_API_KEY) {
        return {
            status: 'skipped',
            message: 'OpenAI API key not configured',
            files: fallbackInsights,
            model: options.model || DEFAULT_MODEL,
        };
    }

    try {
        const promptPayload = {
            selectedText: truncateText(selectedText, 1200),
            currentFile: options.currentFile || null,
            files: normalizedContexts.slice(0, 80).map((context) => ({
                filePath: context.filePath,
                occurrenceCount: context.occurrences?.length || 0,
                topOccurrences: (context.occurrences || []).slice(0, 6),
                dependencies: (context.dependencies || []).slice(0, 18),
                referencedFunctions: (context.referencedFunctions || []).slice(0, 12),
            })),
            implicitDependencies: options.implicitDependencies || null,
            staticRuntimeSummary: options.staticRuntimeSummary || null,
        };

        const prompt = [
            'You are an expert dependency analyst.',
            'Produce one personalized insight per file in the payload.',
            'Each file insight must explain why the file is related to the selected text and include both static and runtime dependency details when available.',
            'Return STRICT JSON only using this exact schema:',
            '{',
            '  "fileInsights": [',
            '    {',
            '      "filePath": "",',
            '      "whyRelated": "",',
            '      "staticDependencies": [""],',
            '      "runtimeDependencies": [""],',
            '      "impactSummary": "",',
            '      "riskLevel": "LOW|MEDIUM|HIGH",',
            '      "recommendedActions": [""],',
            '      "confidence": "LOW|MEDIUM|HIGH"',
            '    }',
            '  ]',
            '}',
            '',
            'Important constraints:',
            '- Include every filePath from the payload exactly once.',
            '- Keep recommendations concrete and file-specific.',
            '- Prefer concise but actionable language.',
            '',
            'Evidence payload:',
            JSON.stringify(promptPayload),
        ].join('\n');

        const llmResult = await runLlmRequest(prompt, {
            model: options.model || DEFAULT_MODEL,
            maxOutputTokens: 2600,
        });

        const parsed = extractFirstJsonObject(llmResult.text);
        const rawInsights = Array.isArray(parsed?.fileInsights) ? parsed.fileInsights : [];

        const mergedByPath = new Map();

        for (const fallback of fallbackInsights) {
            if (fallback.filePath) {
                mergedByPath.set(fallback.filePath, fallback);
            }
        }

        for (const rawInsight of rawInsights) {
            const normalized = normalizeFileInsight(rawInsight);
            if (!normalized.filePath) continue;

            const previous = mergedByPath.get(normalized.filePath);
            if (!previous) {
                mergedByPath.set(normalized.filePath, normalized);
                continue;
            }

            mergedByPath.set(normalized.filePath, {
                ...previous,
                ...normalized,
                staticDependencies: normalized.staticDependencies.length > 0
                    ? normalized.staticDependencies
                    : previous.staticDependencies,
                runtimeDependencies: normalized.runtimeDependencies.length > 0
                    ? normalized.runtimeDependencies
                    : previous.runtimeDependencies,
                recommendedActions: normalized.recommendedActions.length > 0
                    ? normalized.recommendedActions
                    : previous.recommendedActions,
                whyRelated: normalized.whyRelated || previous.whyRelated,
                impactSummary: normalized.impactSummary || previous.impactSummary,
                riskLevel: normalized.riskLevel === 'UNKNOWN' ? previous.riskLevel : normalized.riskLevel,
                confidence: normalized.confidence || previous.confidence,
            });
        }

        const files = normalizedContexts.map((context) => {
            const filePath = context.filePath;
            return mergedByPath.get(filePath) || buildFallbackFileInsight(context, selectedText, options.implicitDependencies);
        });

        return {
            status: 'completed',
            message: 'Per-file dependency insights generated successfully',
            files,
            model: llmResult.model,
            modeUsed: llmResult.modeUsed,
            usageTokens: llmResult.usageTokens,
        };
    } catch (error) {
        console.error('Per-file LLM insight generation error:', error);
        return {
            status: 'error',
            message: error.message || 'Failed to generate per-file insights',
            files: fallbackInsights,
            model: options.model || DEFAULT_MODEL,
        };
    }
}

/**
 * Generate natural language description of code structure and dependencies
 */
export async function generateArchitectureSummary(graphData, selectedNode) {
    if (!process.env.OPENAI_API_KEY) {
        return {
            status: 'skipped',
            message: 'OpenAI API key not configured',
            summary: null,
        };
    }

    try {
        const prompt = `Based on this code dependency graph, generate a concise natural language summary of the architecture and the role of the selected node.

SELECTED NODE:
${JSON.stringify(selectedNode, null, 2)}

GRAPH SUMMARY:
- Total Nodes: ${graphData.nodes?.length || 0}
- Total Edges: ${graphData.edges?.length || 0}
- Node Types: ${[...new Set(graphData.nodes?.map(n => n.type) || [])].join(', ')}

Generate a brief (3-4 paragraphs) architectural summary that explains:
1. The role of the selected component in the architecture
2. Its dependencies and what depends on it
3. Key data/control flows involving this component
4. Architectural implications of changes to this component`;

        const response = await runLlmRequest(prompt, {
            model: DEFAULT_MODEL,
            maxOutputTokens: 900,
            systemPrompt: 'You are an architecture analyst. Provide concise but specific explanation text.',
        });

        return {
            status: 'completed',
            message: 'Architecture summary generated',
            summary: response.text,
            model: response.model,
            modeUsed: response.modeUsed,
        };
    } catch (error) {
        console.error('LLM Service Error:', error);
        return {
            status: 'error',
            message: error.message,
        };
    }
}

/**
 * Infer hidden or implicit dependencies that might not be explicitly shown
 */
export async function inferImplicitDependencies(codeSnippet, context) {
    if (!process.env.OPENAI_API_KEY) {
        return {
            status: 'skipped',
            implicitDependencies: null,
        };
    }

    try {
        const prompt = `Analyze this code and infer any implicit dependencies that may not be explicitly visible in the code structure.

CODE:
\`\`\`
${codeSnippet}
\`\`\`

CONTEXT (from graph):
${JSON.stringify(context, null, 2)}

Identify:
1. **Implicit Dependencies**: Dependencies not explicitly imported or called
2. **Runtime Dependencies**: Dependencies that only appear at runtime
3. **Environmental Dependencies**: Dependencies on environment variables, configs, external services
4. **Data Flow Dependencies**: Hidden data flows thru global state, caches, databases
5. **Potential Issues**: Any anti-patterns or problematic dependencies

Format as JSON with these keys: implicit_dependencies, runtime_dependencies, environmental_dependencies, data_flows, potential_issues`;

        const response = await runLlmRequest(prompt, {
            model: DEFAULT_MODEL,
            maxOutputTokens: 1200,
        });

        const inferred = extractFirstJsonObject(response.text) || { raw: response.text };

        return {
            status: 'completed',
            inferredDependencies: inferred,
            model: response.model,
            modeUsed: response.modeUsed,
        };
    } catch (error) {
        console.error('LLM Service Error:', error);
        return {
            status: 'error',
            message: error.message,
        };
    }
}

export default {
    analyzeDependenciesWithLLM,
    generatePerFileDependencyInsights,
    generateArchitectureSummary,
    inferImplicitDependencies,
};
