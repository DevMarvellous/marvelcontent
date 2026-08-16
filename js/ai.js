/**
 * Marvel Content — Client-Side Gemini AI Rewrite Module
 * Zero-backend client fetch for "Improve for Socials" with side-by-side diff preview.
 */

const GEMINI_SYSTEM_INSTRUCTION = `You are a world-class social media copywriter and growth strategist for Marvellous Adepoju, specializing in Real Estate, Business Technology, and PropTech.
Your goal: Rewrite the user's input text to be punchier, more engaging, high-retention, and optimized for social media platforms (LinkedIn, X, Instagram, Facebook).
Rules:
1. Preserve the core truth, factual claims, and exact message.
2. Make hooks more captivating and eliminate fluff/waffle.
3. For card text, support and utilize **bold** and ++big++ markup for emphasis where appropriate.
4. Keep the tone authentic, sharp, authoritative, and accessible.
5. Return ONLY the rewritten text without conversational preamble, quotes, or markdown code fences unless specified.`;

/**
 * Check if the browser is online
 */
function isOnline() {
  return typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
}

/**
 * Call Google Gemini API directly from the client
 */
async function improveTextWithGemini(inputText, options = {}) {
  if (!isOnline()) {
    throw new Error('OFFLINE: AI rewrite requires an active internet connection.');
  }

  const settings = await window.MarvelDB.getSetting('app_settings') || window.MarvelDB.DEFAULT_SETTINGS;
  const apiKey = (settings.geminiApiKey || '').trim();

  if (!apiKey) {
    const error = new Error('NO_API_KEY: Please add your Google Gemini API key in Settings.');
    error.code = 'NO_API_KEY';
    throw error;
  }

  const model = options.model || settings.geminiModel || 'gemini-1.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: `${GEMINI_SYSTEM_INSTRUCTION}\n\nContext type: ${options.contextType || 'General Social Content'}\n\nOriginal Text to improve:\n${inputText}` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 1000
    }
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData?.error?.message || `Gemini API returned status ${response.status}`;
      throw new Error(msg);
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const textOutput = candidate?.content?.parts?.[0]?.text;

    if (!textOutput) {
      throw new Error('No output returned from Gemini AI.');
    }

    return textOutput.trim();
  } catch (err) {
    console.error('Gemini AI call failed:', err);
    throw err;
  }
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

  window.MarvelDB.getSetting('app_settings').then(settings => {
    const apiKey = (settings?.geminiApiKey || '').trim();
    if (!apiKey) {
      const goToSettings = confirm('🔑 No Gemini API Key found.\n\nWould you like to open Settings now to enter your Google Gemini API key?');
      if (goToSettings && typeof window.switchView === 'function') {
        window.switchView('view-settings');
        const keyInput = document.getElementById('setting-gemini-key');
        if (keyInput) keyInput.focus();
      }
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

    // Trigger API call
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
        resultBox.value = `❌ Error: ${err.message}`;
        acceptBtn.disabled = true;
      });
  });
}

function acceptAIRewrite() {
  const resultBox = document.getElementById('ai-rewritten-text');
  const modal = document.getElementById('modal-ai-rewrite');
  if (resultBox && activeAIRewriteCallback) {
    const text = resultBox.value;
    if (text && !text.startsWith('❌ Error:')) {
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
  improveTextWithGemini,
  openAIRewriteModal,
  acceptAIRewrite,
  closeAIRewriteModal
};
