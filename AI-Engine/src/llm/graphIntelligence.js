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

function extractTextFromChatCompletion(response) {
  const firstChoice = response?.choices?.[0];
  const content = firstChoice?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item?.text ?? '')
      .join('')
      .trim();
  }

  return null;
}

function getPrompt(context) {
  return [
    'You are an architecture intelligence engine working ONLY on dependency graph JSON (not source code).',
    'Return strictly valid JSON with the exact schema shown below.',
    'Infer hidden dependencies, API contracts, DB lineage, impact predictions, explanations, and architecture summary.',
    'Prioritize: dependency graph reasoning, architecture explanation, change impact prediction, and service relationship analysis.',
    'Use only evidence in the graph. If uncertain, include low confidence and explain assumptions.',
    '',
    'Required JSON schema:',
    '{',
    '  "hiddenDependencies": [{"from": "", "to": "", "type": "", "reason": "", "confidence": 0}],',
    '  "apiContracts": [{"consumer": "", "endpoint": "", "provider": "", "reason": "", "confidence": 0}],',
    '  "databaseLineage": [{"apiOrService": "", "dbEntity": "", "field": "", "relationship": "READS|WRITES|USES", "reason": "", "confidence": 0}],',
    '  "impactPredictions": [{"changeNode": "", "impacted": [""], "impact": "", "reason": "", "confidence": 0}],',
    '  "serviceRelationshipAnalysis": [{"service": "", "dependsOn": [""], "usedBy": [""], "criticality": "LOW|MEDIUM|HIGH", "reason": ""}],',
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
  const baseURL = process.env.OPENAI_BASE_URL || undefined;
  const apiMode = process.env.OPENAI_API_MODE ?? 'responses';
  const maxNodes = Number(process.env.LLM_MAX_NODES ?? options.maxNodes ?? 500);
  const maxEdges = Number(process.env.LLM_MAX_EDGES ?? options.maxEdges ?? 1000);

  const context = buildGraphContext(graph, { maxNodes, maxEdges });
  const prompt = getPrompt(context);

  const client = new OpenAI({
    apiKey,
    baseURL,
  });

  let text = null;
  let modeUsed = apiMode;

  if (apiMode === 'chat') {
    try {
      const chatResponse = await client.chat.completions.create({
        model,
        max_tokens: 3000,
        messages: [
          {
            role: 'system',
            content: 'You produce strict JSON only. No markdown or extra text.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      });
      text = extractTextFromChatCompletion(chatResponse);
    } catch (error) {
      return {
        status: 'failed',
        reason: `OpenAI chat completion request failed: ${error.message}`,
        generatedAt: new Date().toISOString(),
        model,
        modeUsed,
      };
    }
  } else {
    try {
      const response = await client.responses.create({
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
      text = extractTextResponse(response);
    } catch (error) {
      modeUsed = 'chat-fallback';
      try {
        const chatResponse = await client.chat.completions.create({
          model,
          max_tokens: 3000,
          messages: [
            {
              role: 'system',
              content: 'You produce strict JSON only. No markdown or extra text.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        });
        text = extractTextFromChatCompletion(chatResponse);
      } catch (fallbackError) {
        return {
          status: 'failed',
          reason: `OpenAI request failed: ${error.message}; chat fallback failed: ${fallbackError.message}`,
          generatedAt: new Date().toISOString(),
          model,
          modeUsed,
        };
      }
    }
  }

  if (!text) {
    return {
      status: 'failed',
      reason: 'No text output from OpenAI response',
      generatedAt: new Date().toISOString(),
      model,
      modeUsed,
    };
  }

  try {
    const parsed = JSON.parse(text);
    return {
      status: 'ok',
      generatedAt: new Date().toISOString(),
      model,
      modeUsed,
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
      modeUsed,
    };
  }
}

module.exports = {
  runGraphIntelligence,
};
