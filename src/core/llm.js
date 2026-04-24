require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function getExplanation(command, context, riskScore) {
  const fallback = {
    explanation: "API key missing or AI unavailable. Using rule-based fallback.",
    consequences: "Cannot predict exact consequences without AI, but pattern matches dangerous behavior.",
    saferAlternative: "Review the command carefully and check documentation.",
    safeWhen: "You are absolutely sure about the environment and parameters.",
    impact: "Potential unexpected system modifications.",
    confidence: "LOW"
  };

  if (!process.env.GEMINI_API_KEY) {
    return fallback;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `
You are an expert Developer Safety Agent.
Analyze the following shell command.

Command: ${command}
OS Type: ${context.osPlatform}
Current Working Directory: ${context.cwd}
Risk Score: ${riskScore}/100
Git Context: ${JSON.stringify(context.git)}
Docker Context: ${JSON.stringify(context.docker)}

Provide a concise, developer-friendly analysis strictly in JSON format with these exact keys:
- "explanation": Briefly explain what the command does and why it is risky in this specific context.
- "consequences": What is the worst-case scenario if it goes wrong?
- "saferAlternative": Provide a safer alternative command or flag (give OS-specific alternative if needed, e.g. PowerShell vs Bash).
- "safeWhen": Explain the exact conditions where running this command is considered safe.
- "impact": A single-line human readable summary of the potential damage.
- "confidence": Your confidence in this assessment based on the context ("HIGH", "MEDIUM", or "LOW").
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    try {
      // Clean up markdown wrapping if present
      const rawText = response.text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(rawText);
      return {
        ...parsed,
        confidence: parsed.confidence || 'HIGH'
      };
    } catch (parseError) {
      console.error("Failed to parse AI JSON response.");
      return fallback;
    }
  } catch (error) {
    fallback.explanation = `AI unavailable (Error: ${error.message}). Using rule-based fallback.`;
    return fallback;
  }
}

module.exports = { getExplanation };
