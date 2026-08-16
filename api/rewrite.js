/**
 * Vercel Serverless Function: /api/rewrite
 * Securely proxies AI rewrite requests using GEMINI_API_KEY environment variable.
 * Includes smart model filtering (ignores TTS/audio/embeddings) and friendly error messages.
 */

const SYSTEM_INSTRUCTION = `You are a world-class social media copywriter and growth strategist for Marvellous Adepoju, specializing in Real Estate, Business Technology, and PropTech.
Your goal: Rewrite the user's input text to be punchier, more engaging, high-retention, and optimized for social media platforms (LinkedIn, X, Instagram, Facebook).
Rules:
1. Preserve the core truth, factual claims, and exact message.
2. Make hooks more captivating and eliminate fluff/waffle.
3. For card text, support and utilize **bold** and ++big++ markup for emphasis where appropriate.
4. Keep the tone authentic, sharp, authoritative, and accessible.
5. Return ONLY the rewritten text without conversational preamble, quotes, or markdown code fences.`;

// Filter only text-generating chat models (excludes TTS, audio, embeddings, imagen)
function isValidTextModel(modelName) {
  const name = (modelName || '').toLowerCase();
  if (
    name.includes('tts') ||
    name.includes('embedding') ||
    name.includes('imagen') ||
    name.includes('aqa') ||
    name.includes('realtime')
  ) {
    return false;
  }
  return name.includes('gemini') || name.includes('flash') || name.includes('pro');
}

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

  // Get API key from Vercel Environment Variable, or fallback to request header
  const apiKey = (process.env.GEMINI_API_KEY || req.headers['x-gemini-key'] || '').trim();

  if (!apiKey) {
    return res.status(400).json({
      error: {
        code: 'NO_API_KEY',
        message: 'No GEMINI_API_KEY found in Vercel Environment Variables. Please add it in your Vercel Dashboard.'
      }
    });
  }

  const { inputText, contextType = 'General Social Content', model = 'gemini-2.0-flash' } = req.body || {};

  if (!inputText || typeof inputText !== 'string') {
    return res.status(400).json({ error: { message: 'Missing or empty input text.' } });
  }

  // 1. Dynamic Model Discovery: Query Google's ListModels endpoint
  let discoveredTextModels = [];
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (listRes.ok) {
      const listData = await listRes.json();
      if (Array.isArray(listData.models)) {
        discoveredTextModels = listData.models
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace(/^models\//, ''))
          .filter(isValidTextModel);
      }
    }
  } catch (discoveryErr) {
    console.warn('[Vercel Serverless] ListModels query skipped:', discoveryErr.message);
  }

  // Prioritized fallback list of proven text generation models
  const standardTextModels = [
    model,
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite-preview-02-05',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-2.0-flash-exp',
    'gemini-1.5-pro-latest',
    'gemini-1.5-pro'
  ].filter(isValidTextModel);

  const modelsToTry = [...new Set([...discoveredTextModels, ...standardTextModels].filter(Boolean))];
  let lastErrorDetail = null;

  for (const currentModel of modelsToTry) {
    const cleanModel = currentModel.replace(/^models\//, '');
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        const rawMsg = errData?.error?.message || `HTTP ${response.status}`;
        
        // Categorize error
        if (response.status === 429) {
          throw new Error(`Rate limit exceeded on model ${cleanModel}. ${rawMsg}`);
        } else if (response.status === 400 || response.status === 403) {
          throw new Error(`Auth/Parameter error (${cleanModel}): ${rawMsg}`);
        } else {
          throw new Error(`Model ${cleanModel} error: ${rawMsg}`);
        }
      }

      const data = await response.json();
      const candidate = data?.candidates?.[0];
      const textOutput = candidate?.content?.parts?.[0]?.text;

      if (!textOutput) {
        throw new Error(`No text returned by ${cleanModel}`);
      }

      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: true,
        modelUsed: cleanModel,
        rewrittenText: textOutput.trim()
      });
    } catch (err) {
      lastErrorDetail = err.message;
      console.warn(`[Vercel Serverless] Model ${cleanModel} attempt failed, trying fallback:`, err.message);
    }
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(500).json({
    error: {
      message: `Gemini rewrite failed. Detail: ${lastErrorDetail || 'Unknown error'}`
    }
  });
}
