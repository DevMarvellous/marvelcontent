/**
 * Vercel Serverless Function: /api/rewrite
 * Securely proxies AI rewrite requests using GEMINI_API_KEY environment variable.
 * Uses fine-tuned, specialized prompts for Cards, Social Posts, and Video Scripts.
 */

// Specialized System Prompts tailored by content format
const PROMPTS = {
  card: `You are an elite visual graphic copywriter for Marvellous Adepoju (Real Estate & PropTech).
Goal: Write an ultra-concise, high-impact hook or counter-intuitive truth for a single visual card graphic.
STRICT RULES:
1. Maximum 20-35 words total.
2. Must fit cleanly on a single visual slide without clutter.
3. Wrap 1-2 core keywords in **bold** and wrap the single punchiest phrase in ++big++ (e.g. ++legal diligence++).
4. No conversational preamble, no quotes, no hashtags, no filler. Return ONLY the exact card text.`,

  post: `You are an elite LinkedIn & X (Twitter) ghostwriter for Marvellous Adepoju (Real Estate, Business Tech & PropTech).
Goal: Rewrite the draft into a crisp, high-retention, non-bloated social post.
STRICT RULES:
1. Keep it punchy and concise (80-140 words max).
2. Structure:
   - Line 1: Strong 1-line hook that stops the scroll.
   - Middle: 2-3 short, scannable value takeaways with clean line breaks.
   - Ending: 1 brief question or call-to-action.
   - 2-3 relevant hashtags (e.g. #RealEstate #PropTech #BusinessTech).
3. No fluffy corporate buzzwords, no conversational filler ("Sure, here is..."). Return ONLY the post text.`,

  script: `You are a viral short-form video director (Reels, TikTok, Shorts) for Marvellous Adepoju.
Goal: Turn the draft into a fast-paced, high-retention 30-45s spoken video script.
STRICT FORMAT:
HOOK (0-3s): [1 punchy pattern-interrupt sentence to grab attention immediately]

BODY (3-35s):
• [Point 1 - direct & spoken naturally]
• [Point 2 - concrete insight or data]
• [Point 3 - key takeaway]

CALL TO ACTION (35-45s): [1 simple call to action: drop a comment or save this video]

STRICT RULES:
1. Total script length: 70-110 words maximum (fast spoken pace).
2. Write for the ear: natural, punchy, direct. No academic waffle.
3. Return ONLY the formatted script with HOOK, BODY, and CALL TO ACTION headers.`,

  idea: `You are a sharp content strategist. Turn this raw thought into a razor-sharp, punchy content angle or contrarian perspective (1-2 sentences maximum, under 30 words). Return ONLY the refined idea.`
};

function getPromptForContext(contextType = '') {
  const c = contextType.toLowerCase();
  if (c.includes('card') || c.includes('graphic') || c.includes('hook')) return PROMPTS.card;
  if (c.includes('script') || c.includes('video') || c.includes('reel')) return PROMPTS.script;
  if (c.includes('idea') || c.includes('concept')) return PROMPTS.idea;
  return PROMPTS.post;
}

function isValidTextModel(modelName) {
  const name = (modelName || '').toLowerCase();
  if (
    name.includes('tts') ||
    name.includes('embedding') ||
    name.includes('imagen') ||
    name.includes('aqa') ||
    name.includes('realtime') ||
    name.includes('audio')
  ) {
    return false;
  }
  return name.includes('gemini') || name.includes('flash') || name.includes('pro');
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-key');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed' } });
  }

  const apiKey = (process.env.GEMINI_API_KEY || req.headers['x-gemini-key'] || '').trim();

  if (!apiKey) {
    return res.status(400).json({
      error: {
        code: 'NO_API_KEY',
        message: 'No GEMINI_API_KEY found in Vercel Environment Variables. Please add it in your Vercel Dashboard.'
      }
    });
  }

  const { inputText, contextType = 'post', model = 'gemini-2.0-flash' } = req.body || {};

  if (!inputText || typeof inputText !== 'string') {
    return res.status(400).json({ error: { message: 'Missing or empty input text.' } });
  }

  const systemPrompt = getPromptForContext(contextType);

  // 1. Dynamic Model Discovery
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
                  text: `${systemPrompt}\n\nDraft content to refine:\n${inputText}`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.6,
            topP: 0.9,
            maxOutputTokens: 600
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const rawMsg = errData?.error?.message || `HTTP ${response.status}`;
        throw new Error(`${cleanModel}: ${rawMsg}`);
      }

      const data = await response.json();
      const candidate = data?.candidates?.[0];
      let textOutput = candidate?.content?.parts?.[0]?.text || '';

      // Strip any accidental wrapping markdown quotes or code blocks
      textOutput = textOutput.replace(/^```[a-z]*\n/i, '').replace(/\n```$/, '').trim();

      if (!textOutput) {
        throw new Error(`No text returned by ${cleanModel}`);
      }

      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: true,
        modelUsed: cleanModel,
        rewrittenText: textOutput
      });
    } catch (err) {
      lastErrorDetail = err.message;
      console.warn(`[Vercel Serverless] Model ${cleanModel} failed, trying fallback:`, err.message);
    }
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(500).json({
    error: {
      message: `Gemini rewrite failed. Detail: ${lastErrorDetail || 'Unknown error'}`
    }
  });
}
