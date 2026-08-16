/**
 * Marvel Content — Client-Side Gemini AI Rewrite Module
 * Uses fine-tuned, specialized prompts for Cards, Social Posts, and Video Scripts.
 * Prevents conversational fluff, limits word counts, and optimizes for social retention.
 */

// Specialized Prompts by context
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

let cachedActiveTextModels = null;

function isOnline() {
  return typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
}

async function discoverAvailableGeminiModels(apiKey) {
  if (cachedActiveTextModels && cachedActiveTextModels.length > 0) {
    return cachedActiveTextModels;
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.models)) {
        cachedActiveTextModels = data.models
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace(/^models\//, ''))
          .filter(isValidTextModel);
        return cachedActiveTextModels;
      }
    }
  } catch (err) {
    console.warn('[Model Discovery] ListModels skipped:', err.message);
  }

  return [];
}

async function improveTextWithGemini(inputText, options = {}) {
  if (!isOnline()) {
    throw new Error('OFFLINE: You are currently offline. Connect to the internet to run AI rewrite.');
  }

  const settings = await window.MarvelDB.getSetting('app_settings') || window.MarvelDB.DEFAULT_SETTINGS;
  const preferredModel = options.model || settings.geminiModel || 'gemini-2.0-flash';
  const contextType = options.contextType || 'post';
  const systemPrompt = getPromptForContext(contextType);

  // -------------------------------------------------------------
  // Mode 1: Attempt Vercel Serverless Endpoint (/api/rewrite)
  // -------------------------------------------------------------
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (settings.geminiApiKey) {
      headers['x-gemini-key'] = settings.geminiApiKey;
    }

    const apiResponse = await fetch('./api/rewrite', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        inputText,
        contextType,
        model: preferredModel
      })
    });

    if (apiResponse.ok) {
      const data = await apiResponse.json();
      if (data && data.rewrittenText) {
        return data.rewrittenText.trim();
      }
    } else if (apiResponse.status !== 404 && apiResponse.status !== 405) {
      const errData = await apiResponse.json().catch(() => ({}));
      if (errData?.error?.message && !errData.error.message.includes('No GEMINI_API_KEY')) {
        console.warn('Serverless endpoint error, attempting client fallback:', errData.error.message);
      }
    }
  } catch (apiErr) {
    console.log('Serverless API unavailable (local mode), using client fetch:', apiErr.message);
  }

  // -------------------------------------------------------------
  // Mode 2: Client-side direct Google Gemini API call
  // -------------------------------------------------------------
  const clientKey = (settings.geminiApiKey || '').trim();
  if (!clientKey) {
    const error = new Error('NO_API_KEY: No Gemini API Key found. Set GEMINI_API_KEY in Vercel environment variables or enter your API key in Settings.');
    error.code = 'NO_API_KEY';
    throw error;
  }

  const discoveredModels = await discoverAvailableGeminiModels(clientKey);

  const fallbackList = [
    preferredModel,
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite-preview-02-05',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-2.0-flash-exp',
    'gemini-1.5-pro-latest',
    'gemini-1.5-pro'
  ].filter(isValidTextModel);

  const modelsToTry = [...new Set([...discoveredModels, ...fallbackList].filter(Boolean))];
  let lastClientError = null;

  for (const rawModel of modelsToTry) {
    const currentModel = rawModel.replace(/^models\//, '');
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${clientKey}`;

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
        const rawMsg = errData?.error?.message || `Status ${response.status}`;

        if (response.status === 429) {
          throw new Error(`Rate limit reached on ${currentModel}. Please wait a few seconds.`);
        } else if (response.status === 400 || response.status === 403) {
          throw new Error(`API key authorization issue with ${currentModel}: ${rawMsg}`);
        } else {
          throw new Error(`${currentModel}: ${rawMsg}`);
        }
      }

      const data = await response.json();
      const candidate = data?.candidates?.[0];
      let textOutput = candidate?.content?.parts?.[0]?.text || '';

      // Strip accidental markdown code blocks
      textOutput = textOutput.replace(/^```[a-z]*\n/i, '').replace(/\n```$/, '').trim();

      if (!textOutput) {
        throw new Error(`Empty response from ${currentModel}`);
      }

      return textOutput;
    } catch (err) {
      lastClientError = err;
      console.warn(`[Client Direct] Model ${currentModel} skipped:`, err.message);
    }
  }

  throw new Error(lastClientError ? lastClientError.message : 'All available Gemini model endpoints failed.');
}

let activeAIRewriteCallback = null;

function openAIRewriteModal(currentText, contextType, onAcceptCallback) {
  if (!isOnline()) {
    alert('⚠️ You are currently offline. AI Rewrite requires an internet connection.');
    return;
  }

  activeAIRewriteCallback = onAcceptCallback;

  const modal = document.getElementById('modal-ai-rewrite');
  const origBox = document.getElementById('ai-original-text');
  const resultBox = document.getElementById('ai-rewritten-text');
  const loadingEl = document.getElementById('ai-loading-state');
  const acceptBtn = document.getElementById('btn-ai-accept');

  if (!modal) return;

  origBox.value = currentText;
  resultBox.value = '';
  resultBox.style.display = 'none';
  loadingEl.style.display = 'flex';
  acceptBtn.disabled = true;

  modal.classList.add('active');

  improveTextWithGemini(currentText, { contextType })
    .then(rewrittenText => {
      loadingEl.style.display = 'none';
      resultBox.style.display = 'block';
      resultBox.value = rewrittenText;
      acceptBtn.disabled = false;
    })
    .catch(err => {
      loadingEl.style.display = 'none';
      resultBox.style.display = 'block';

      if (err.code === 'NO_API_KEY') {
        resultBox.value = '⚠️ No Gemini API Key Configured\n\nTo activate AI Rewrite, please either:\n1. Set GEMINI_API_KEY in your Vercel Project Environment Variables, or\n2. Open Settings in this app and paste your Google Gemini API key.';
        acceptBtn.disabled = true;

        const goToSettings = confirm('🔑 No Gemini API key detected.\n\nWould you like to open Settings now to enter your Google Gemini API key?');
        if (goToSettings && typeof window.switchView === 'function') {
          closeAIRewriteModal();
          window.switchView('view-settings');
          const keyInput = document.getElementById('setting-gemini-key');
          if (keyInput) keyInput.focus();
        }
      } else {
        resultBox.value = `❌ AI Rewrite Error\n\nReason: ${err.message}\n\n💡 Troubleshooting:\n• If quota is exceeded (429), please wait a few seconds.\n• Check your key in Google AI Studio or Vercel Environment Variables.`;
        acceptBtn.disabled = true;
      }
    });
}

function acceptAIRewrite() {
  const resultBox = document.getElementById('ai-rewritten-text');
  const modal = document.getElementById('modal-ai-rewrite');
  if (resultBox && activeAIRewriteCallback) {
    const text = resultBox.value;
    if (text && !text.startsWith('❌') && !text.startsWith('⚠️')) {
      activeAIRewriteCallback(text);
    }
  }
  if (modal) modal.classList.remove('active');
  activeAIRewriteCallback = null;
}

function closeAIRewriteModal() {
  const modal = document.getElementById('modal-ai-rewrite');
  if (modal) modal.classList.remove('active');
  activeAIRewriteCallback = null;
}

window.MarvelAI = {
  isOnline,
  PROMPTS,
  discoverAvailableGeminiModels,
  improveTextWithGemini,
  openAIRewriteModal,
  acceptAIRewrite,
  closeAIRewriteModal
};
