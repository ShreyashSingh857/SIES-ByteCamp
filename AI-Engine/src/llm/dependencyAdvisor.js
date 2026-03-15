const OpenAI = require('openai');

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

function getPrompt(payload) {
  return [
    'You are a dependency-change advisor for code repositories.',
    'Input is machine-detected dependency deltas after file changes.',
    'Return STRICT JSON only using exactly this schema:',
    '{',
    '  "fileSuggestions": [',
    '    {',
    '      "file": "",',
    '      "problem": "",',
    '      "suggestedEdits": [""],',
    '      "confidence": 0',
    '    }',
    '  ],',
    '  "dependencyFileEdits": [',
    '    {',
    '      "dependencyFile": "",',
    '      "add": [""],',
    '      "remove": [""],',
    '      "reason": ""',
    '    }',
    '  ],',
    '  "riskNotes": [""],',
    '  "assumptions": [""]',
    '}',
    'Use only the provided payload. Do not invent files.',
    'Payload JSON:',
    JSON.stringify(payload),
  ].join('\n');
}

async function runDependencyAdvisor(payload, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return createSkippedResult('OPENAI_API_KEY is not configured');
  }

  const model = options.model ?? process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
  const baseURL = process.env.OPENAI_BASE_URL || undefined;
  const apiMode = process.env.OPENAI_API_MODE ?? 'responses';

  const prompt = getPrompt(payload);
  const client = new OpenAI({
    apiKey,
    baseURL,
  });

  let text = null;
  let modeUsed = apiMode;

  if (apiMode === 'chat') {
    try {
      const response = await client.chat.completions.create({
        model,
        max_tokens: 2000,
        messages: [
          {
            role: 'system',
            content: 'Return strict JSON only. No markdown.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      });
      text = extractTextFromChatCompletion(response);
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
                text: 'Return strict JSON only. No markdown.',
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
        max_output_tokens: 2000,
      });
      text = extractTextResponse(response);
    } catch (error) {
      modeUsed = 'chat-fallback';
      try {
        const fallbackResponse = await client.chat.completions.create({
          model,
          max_tokens: 2000,
          messages: [
            {
              role: 'system',
              content: 'Return strict JSON only. No markdown.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        });
        text = extractTextFromChatCompletion(fallbackResponse);
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
  runDependencyAdvisor,
};
