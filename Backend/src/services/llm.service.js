import 'dotenv/config';
import OpenAI from 'openai';

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL,
});

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4-mini';

/**
 * Analyze dependencies using LLM to understand relationships and impact
 * @param {string} selectedText The highlighted/selected symbol or code
 * @param {Object} graphContext The graph context from Neo4j (nodes, edges)
 * @param {Array} occurrences The occurrences found in the codebase
 * @returns {Object} LLM analysis with insights about dependencies
 */
export async function analyzeDependenciesWithLLM(selectedText, graphContext, occurrences) {
    if (!process.env.OPENAI_API_KEY) {
        return {
            status: 'skipped',
            message: 'OpenAI API key not configured',
            analysis: null,
        };
    }

    try {
        // Prepare context for LLM
        const nodesSummary = (graphContext.nodes || [])
            .slice(0, 50)
            .map(n => `${n.name || n.id} (${n.type})`)
            .join(', ');

        const edgesSummary = (graphContext.edges || [])
            .slice(0, 30)
            .map(e => `${e.source} --${e.type}--> ${e.target}`)
            .join(', ');

        const occurrencesSummary = (occurrences || [])
            .slice(0, 10)
            .map(o => `${o.displayName || o.id} (${o.type}): ${o.filePath}:${o.lineNumber}`)
            .join(', ');

        const prompt = `You are a code dependency analyzer. Analyze the selected symbol and its dependencies in the codebase.

SELECTED SYMBOL/CODE:
"${selectedText}"

OCCURRENCES IN CODEBASE:
${occurrencesSummary}

RELATED GRAPH NODES:
${nodesSummary}

DEPENDENCY RELATIONSHIPS:
${edgesSummary}

Please provide:
1. **Dependency Type**: Is this a static dependency (imports, requires), runtime dependency (function calls, object properties), or data dependency (database reads/writes)?
2. **Dependency Scope**: Analyze if this symbol is used locally, across files, or across services.
3. **Impact Analysis**: What would happen if this code/symbol changes?
4. **Critical Dependencies**: Identify the most critical parts that depend on this symbol.
5. **Access Patterns**: How is this symbol typically used (read, write, call, etc.)?
6. **Risk Assessment**: What is the risk level of making changes to this code?
7. **Recommendations**: Suggest improvements or cautions for this dependency.

Format your response as a structured JSON object with these exact keys: dependencyType, dependencyScope, impactAnalysis, criticalDependencies, accessPatterns, riskAssessment, recommendations.`;

        const response = await client.messages.create({
            model: DEFAULT_MODEL,
            max_tokens: 1500,
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        });

        // Extract the analysis from the response
        const content = response.content[0]?.text || '';

        // Try to parse as JSON, otherwise return raw text
        let analysis;
        try {
            // Extract JSON from the response (it might be wrapped in markdown code blocks)
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: content };
        } catch (e) {
            analysis = { raw: content };
        }

        return {
            status: 'completed',
            message: 'LLM analysis completed successfully',
            analysis,
            model: DEFAULT_MODEL,
            usageTokens: {
                input: response.usage?.input_tokens || 0,
                output: response.usage?.output_tokens || 0,
            },
        };
    } catch (error) {
        console.error('LLM Service Error:', error);
        return {
            status: 'error',
            message: error.message || 'Failed to analyze dependencies with LLM',
            error: error.message,
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

        const response = await client.messages.create({
            model: DEFAULT_MODEL,
            max_tokens: 800,
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        });

        const summary = response.content[0]?.text || '';

        return {
            status: 'completed',
            message: 'Architecture summary generated',
            summary,
            model: DEFAULT_MODEL,
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

        const response = await client.messages.create({
            model: DEFAULT_MODEL,
            max_tokens: 1000,
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        });

        const content = response.content[0]?.text || '';
        let inferred;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            inferred = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: content };
        } catch (e) {
            inferred = { raw: content };
        }

        return {
            status: 'completed',
            inferredDependencies: inferred,
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
    generateArchitectureSummary,
    inferImplicitDependencies,
};
