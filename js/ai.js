/**
 * Marvel Content — Client-Side Gemini AI Rewrite Module
 * Implements dynamic Google ModelService.ListModels discovery with automatic fallback.
 */

const GEMINI_SYSTEM_INSTRUCTION = `You are a world-class social media copywriter and growth strategist for Marvellous Adepoju, specializing in Real Estate, Business Technology, and PropTech.
Your goal: Rewrite the user's input text to be punchier, more engaging, high-retention, and optimized for social media platforms (LinkedIn, X, Instagram, Facebook).
Rules:
1. Preserve the core truth, factual claims, and exact message.
2. Make hooks more captivating and eliminate fluff/waffle.
3. For card text, support and utilize **bold** and ++big++ markup for emphasis where appropriate.
4. Keep the tone authentic, sharp, authoritative, and accessible.
5. Return ONLY the rewritten text without conversational preamble, quotes, or markdown code fences.`;

// Cached list of discovered active models for this session
let cachedActiveModels = null;

/**
 * Check if the browser is online
 */
function isOnline() {
  return typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
}

/**
 * Dynamically discover models supported by the provided API key
 */
async function discoverAvailableGeminiModels(apiKey) {
  if (cachedActiveModels && cachedActiveModels.length > 0) {
    return cachedActiveModels;
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.models)) {
        cachedActiveModels = data.models
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace(/^models\//, ''));
        return cachedActiveModels;
      }
    }
  } catch (err) {
    console.warn('[Model Discovery] ListModels skipped:', err.message);
  }

  return [];
}

/**
 * Call AI Rewrite with dual-mode (Vercel Serverless API first, client-side fallback second)
 */
async function improveTextWithGemini(inputText, options = {}) {
  if (!isOnline()) {
    throw new Error('OFFLINE: AI rewrite requires an active internet connection.');
  }

  const settings = await window.MarvelDB.getSetting('app_settings') || window.MarvelDB.DEFAULT_SETTINGS;
  const preferredModel = options.model || settings.geminiModel || 'gemini-2.0-flash';
  const contextType = options.contextType || 'General Social Content';

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
    console.log('Serverless API unavailable/local file mode, using client fetch:', apiErr.message);
  }

  // -------------------------------------------------------------
  // Mode 2: Client-side direct Google Gemini API call with dynamic discovery
  // -------------------------------------------------------------
  const clientKey = (settings.geminiApiKey || '').trim();
  if (!clientKey) {
    const error = new Error('NO_API_KEY: Please set GEMINI_API_KEY in Vercel environment variables or enter your Gemini API key in Settings.');
    error.code = 'NO_API_KEY';
    throw error;
  }

  // Discover actual supported models from user's key
  const discoveredModels = await discoverAvailableGeminiModels(clientKey);

  const fallbackList = [
    preferredModel,
    'gemini-2.0-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash-8b',
    'gemini-1.0-pro'
  ];

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
                  text: `${GEMINI_SYSTEM_INSTRUCTION}\n\nContext type: ${contextType}\n\nOriginal Text to improve:\n${inputText}`
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
        const msg = errData?.error?.message || `Status ${response.status}`;
        throw new Error(`${currentModel}: ${msg}`);
      }

      const data = await response.json();
      const candidate = data?.candidates?.[0];
      const textOutput = candidate?.content?.parts?.[0]?.text;

      if (!textOutput) {
        throw new Error(`Empty response from ${currentModel}`);
      }

      return textOutput.trim();
    } catch (err) {
      lastClientError = err;
      console.warn(`[Client Direct] Model ${currentModel} failed, trying next available:`, err.message);
    }
  }

  throw new Error(lastClientError ? lastClientError.message : 'All available Gemini model endpoints failed.');
}

/**
 * Open the AI Rewrite Dialog / Modal
 */
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
        resultBox.value = '⚠️ No API Key configured.\n\nPlease either:\n1. Set GEMINI_API_KEY in your Vercel Project Environment Variables, or\n2. Open Settings in this app and paste your Google Gemini API key.';
        acceptBtn.disabled = true;

        const goToSettings = confirm('🔑 No Gemini API key detected.\n\nWould you like to open Settings now to enter your Google Gemini API key?');
        if (goToSettings && typeof window.switchView === 'function') {
          closeAIRewriteModal();
          window.switchView('view-settings');
          const keyInput = document.getElementById('setting-gemini-key');
          if (keyInput) keyInput.focus();
        }
      } else {
        resultBox.value = `❌ Error: ${err.message}`;
        acceptBtn.disabled = true;
      }
    });
}

function acceptAIRewrite() {
  const resultBox = document.getElementById('ai-rewritten-text');
  const modal = document.getElementById('modal-ai-rewrite');
  if (resultBox && activeAIRewriteCallback) {
    const text = resultBox.value;
    if (text && !text.startsWith('❌ Error:') && !text.startsWith('⚠️')) {
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
  discoverAvailableGeminiModels,
  improveTextWithGemini,
  openAIRewriteModal,
  acceptAIRewrite,
  closeAIRewriteModal
};
