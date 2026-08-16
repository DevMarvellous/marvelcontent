/**
 * Vercel Serverless Function: /api/rewrite
 * Securely proxies AI rewrite requests using GEMINI_API_KEY environment variable.
 * Includes dynamic ModelService discovery & fallback.
 */

const SYSTEM_INSTRUCTION = `You are a world-class social media copywriter and growth strategist for Marvellous Adepoju, specializing in Real Estate, Business Technology, and PropTech.
Your goal: Rewrite the user's input text to be punchier, more engaging, high-retention, and optimized for social media platforms (LinkedIn, X, Instagram, Facebook).
Rules:
1. Preserve the core truth, factual claims, and exact message.
2. Make hooks more captivating and eliminate fluff/waffle.
3. For card text, support and utilize **bold** and ++big++ markup for emphasis where appropriate.
4. Keep the tone authentic, sharp, authoritative, and accessible.
5. Return ONLY the rewritten text without conversational preamble, quotes, or markdown code fences.`;

export default async function handler(req, res) {
  // CORS & method check
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-key');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed' } });
  }

  // Get API key from Vercel Environment Variable, or fallback to header
  const apiKey = (process.env.GEMINI_API_KEY || req.headers['x-gemini-key'] || '').trim();

  if (!apiKey) {
    return res.status(400).json({
      error: {
        code: 'NO_API_KEY',
        message: 'No GEMINI_API_KEY set in Vercel environment variables or provided in request.'
      }
    });
  }

  const { inputText, contextType = 'General Social Content', model = 'gemini-2.0-flash' } = req.body || {};

  if (!inputText || typeof inputText !== 'string') {
    return res.status(400).json({ error: { message: 'Missing or invalid inputText parameter.' } });
  }

  // 1. Dynamic Model Discovery: Query Google's ListModels endpoint
  let availableModels = [];
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (listRes.ok) {
      const listData = await listRes.json();
      if (Array.isArray(listData.models)) {
        availableModels = listData.models
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace(/^models\//, ''));
      }
    }
  } catch (discoveryErr) {
    console.warn('[Vercel Serverless] ListModels query skipped:', discoveryErr.message);
  }

  // Build prioritized models list
  const fallbackList = [
    model,
    'gemini-2.0-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash-8b',
    'gemini-1.0-pro'
  ];

  const modelsToTry = [...new Set([...availableModels, ...fallbackList].filter(Boolean))];
  let lastError = null;

  for (const currentModel of modelsToTry) {
    const cleanModel = currentModel.replace(/^models\//, '');
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `${SYSTEM_INSTRUCTION}\n\nContext type: ${contextType}\n\nOriginal Text to improve:\n${inputText}`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            maxOutputTokens: 1000
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMessage = errData?.error?.message || `Status ${response.status}`;
        throw new Error(`${cleanModel}: ${errMessage}`);
      }

      const data = await response.json();
      const candidate = data?.candidates?.[0];
      const textOutput = candidate?.content?.parts?.[0]?.text;

      if (!textOutput) {
        throw new Error(`Empty response from ${cleanModel}`);
      }

      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: true,
        modelUsed: cleanModel,
        rewrittenText: textOutput.trim()
      });
    } catch (err) {
      lastError = err;
      console.warn(`[Vercel Serverless] Model ${cleanModel} failed, trying next available model:`, err.message);
    }
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(500).json({
    error: {
      message: lastError ? lastError.message : 'All available Gemini model endpoints failed.'
    }
  });
}
