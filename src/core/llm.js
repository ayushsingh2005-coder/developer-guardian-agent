'use strict';

const { GoogleGenAI } = require('@google/genai');
const { getApiKey } = require('./config');

const FALLBACK = {
  explanation: 'AI unavailable — using rule-based analysis only.',
  consequences: 'Cannot predict exact consequences without AI, but pattern matches risky behavior.',
  saferAlternative: 'Review the command carefully before running.',
  safeWhen: 'You are absolutely sure about the environment and parameters.',
  impact: 'Potential unexpected system modifications.',
  confidence: 'LOW'
};

// Single instance cache — avoids re-creating client on every call
let _client = null;
let _lastKey = null;

function getClient() {
  const key = getApiKey();
  if (!key) return null;
  if (_client && key === _lastKey) return _client;
  _client = new GoogleGenAI({ apiKey: key });
  _lastKey = key;
  return _client;
}

async function getExplanation(command, context, riskScore) {
  const client = getClient();
  if (!client) return FALLBACK;

  const prompt = `You are an expert Developer Safety Agent.
Analyze this shell command and respond ONLY with valid JSON, no markdown, no backticks.

Command: ${command}
OS: ${context.osPlatform}
CWD: ${context.cwd}
Risk Score: ${riskScore}/100
Git: ${JSON.stringify(context.git)}
Docker: ${JSON.stringify(context.docker)}

Return JSON with exactly these keys:
- "explanation": what this command does and why it is risky
- "consequences": worst case if it goes wrong
- "saferAlternative": safer command or flag (OS-specific if needed)
- "safeWhen": exact conditions where this is safe to run
- "impact": one line summary of potential damage
- "confidence": your confidence level — "HIGH", "MEDIUM", or "LOW"`;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const raw = response.text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(raw);

    return {
      explanation: parsed.explanation || FALLBACK.explanation,
      consequences: parsed.consequences || FALLBACK.consequences,
      saferAlternative: parsed.saferAlternative || FALLBACK.saferAlternative,
      safeWhen: parsed.safeWhen || FALLBACK.safeWhen,
      impact: parsed.impact || FALLBACK.impact,
      confidence: ['HIGH', 'MEDIUM', 'LOW'].includes(parsed.confidence)
        ? parsed.confidence
        : 'LOW'
    };

  } catch (err) {
    return {
      ...FALLBACK,
      explanation: `AI error: ${err.message}. Using rule-based fallback.`
    };
  }
}

module.exports = { getExplanation };