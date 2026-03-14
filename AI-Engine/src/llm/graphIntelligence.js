const OpenAI = require('openai');
const { buildGraphContext } = require('./buildGraphContext');

function createSkippedResult(reason) {
  return {
    status: 'skipped',
    reason,
    generatedAt: new Date().toISOString(),
  };
}

function extractTextResponse(response) {
  if (!response?.output?.length) {
    return null;
  }

  for (const outputItem of response.output) {
    if (!outputItem?.content?.length) {
      continue;
    }

    for (const contentItem of outputItem.content) {
      if (contentItem.type === 'output_text' && contentItem.text) {
        return contentItem.text;
      }
    }
  }

  return null;
}

function getPrompt(context) {
  return [
    'You are an architecture intelligence engine working ONLY on dependency graph JSON (not source code).',
    'Return strictly valid JSON with the exact schema shown below.',
    'Infer hidden dependencies, API contracts, DB lineage, impact predictions, explanations, and architecture summary.',
    'Use only evidence in the graph. If uncertain, include low confidence and explain assumptions.',
    '',
    'Required JSON schema:',
    '{',
    '  "hiddenDependencies": [{"from": "", "to": "", "type": "", "reason": "", "confidence": 0}],',
    '  "apiContracts": [{"consumer": "", "endpoint": "", "provider": "", "reason": "", "confidence": 0}],',
    '  "databaseLineage": [{"apiOrService": "", "dbEntity": "", "field": "", "relationship": "READS|WRITES|USES", "reason": "", "confidence": 0}],',
    '  "impactPredictions": [{"changeNode": "", "impacted": [""], "impact": "", "reason": "", "confidence": 0}],',
    '  "explanations": [{"nodeId": "", "text": ""}],',
    '  "architectureSummary": "",',
    '  "assumptions": [""],',
    '  "suggestedNewEdges": [{"from": "", "to": "", "type": "", "reason": "", "confidence": 0}]',
    '}',
    '',
    'Graph context JSON:',
    JSON.stringify(context),
  ].join('\n');
}

async function runGraphIntelligence(graph, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return createSkippedResult('OPENAI_API_KEY is not configured');
  }

  const model = options.model ?? process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
  const maxNodes = Number(process.env.LLM_MAX_NODES ?? options.maxNodes ?? 500);
  const maxEdges = Number(process.env.LLM_MAX_EDGES ?? options.maxEdges ?? 1000);

  const context = buildGraphContext(graph, { maxNodes, maxEdges });
  const prompt = getPrompt(context);

  const client = new OpenAI({ apiKey });

  let response;
  try {
    response = await client.responses.create({
      model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: 'You produce strict JSON only. No markdown or extra text.',
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
      max_output_tokens: 3000,
    });
  } catch (error) {
    return {
      status: 'failed',
      reason: `OpenAI request failed: ${error.message}`,
      generatedAt: new Date().toISOString(),
      model,
    };
  }

  const text = extractTextResponse(response);
  if (!text) {
    return {
      status: 'failed',
      reason: 'No text output from OpenAI response',
      generatedAt: new Date().toISOString(),
      model,
    };
  }

  try {
    const parsed = JSON.parse(text);
    return {
      status: 'ok',
      generatedAt: new Date().toISOString(),
      model,
      contextMeta: context.metadata,
      ...parsed,
    };
  } catch (error) {
    return {
      status: 'failed',
      reason: `Failed to parse JSON from OpenAI output: ${error.message}`,
      rawOutput: text,
      generatedAt: new Date().toISOString(),
      model,
    };
  }
}

module.exports = {
  runGraphIntelligence,
};
