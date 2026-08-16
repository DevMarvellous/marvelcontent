/**
 * Marvel Content — Master Application Controller
 * Manages view routing, live rendering, Web Share API, batch import, and PWA logic.
 */

let currentAppSettings = null;
let deferredPWAInstallPrompt = null;

// Day of week mapping
const DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const FULL_DAY_NAMES = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday'
};

const PLATFORMS = [
  { key: 'linkedin', label: 'LinkedIn', icon: '💼', class: 'plat-linkedin' },
  { key: 'instagram', label: 'Instagram', icon: '📸', class: 'plat-instagram' },
  { key: 'facebook', label: 'Facebook', icon: '👥', class: 'plat-facebook' },
  { key: 'youtube', label: 'YouTube', icon: '▶️', class: 'plat-youtube' },
  { key: 'x', label: 'X (Twitter)', icon: '𝕏', class: 'plat-x' }
];

/**
 * Initialize Application on DOM Ready
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await window.MarvelDB.openDatabase();
    currentAppSettings = await window.MarvelDB.getSetting('app_settings') || window.MarvelDB.DEFAULT_SETTINGS;

    loadSettingsIntoForm(currentAppSettings);
    await refreshAllViews();

    // Check for offline/online events
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // PWA Install Prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPWAInstallPrompt = e;
      const banner = document.getElementById('pwa-banner');
      const headerBtn = document.getElementById('btn-pwa-install-header');
      if (banner) banner.classList.add('show');
      if (headerBtn) headerBtn.style.display = 'inline-flex';
    });

  } catch (err) {
    console.error('App init failed:', err);
    showToast('Initialization error: ' + err.message, 'error');
  }
});

function getTodayDayCode() {
  const d = new Date().getDay();
  return DAY_CODES[d] || 'MON';
}

function updateOnlineStatus() {
  const isOnline = navigator.onLine;
  if (!isOnline) {
    console.log('App running in offline mode');
  }
}

// -------------------------------------------------------------
// 1. View Navigation
// -------------------------------------------------------------

function switchView(viewId) {
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === viewId);
  });

  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === viewId);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (viewId === 'view-today') renderTodayView();
  else if (viewId === 'view-calendar') renderCalendarView();
  else if (viewId === 'view-ideas') renderIdeaBank();
  else if (viewId === 'view-scripts') renderVideoScripts();
  else if (viewId === 'view-settings') loadSettingsIntoForm(currentAppSettings);
}

// -------------------------------------------------------------
// 2. Global Views Refresh & Badges
// -------------------------------------------------------------

async function refreshAllViews() {
  const items = await window.MarvelDB.getAllContentItems();
  const scripts = await window.MarvelDB.getAllVideoScripts();
  const ideas = await window.MarvelDB.getAllIdeas();

  // Badges
  const todayCode = getTodayDayCode();
  const todayItems = items.filter(i => i.day === todayCode);
  const todayScripts = scripts.filter(s => s.day === todayCode);
  const totalToday = todayItems.length + todayScripts.length;

  document.getElementById('badge-today-count').textContent = totalToday;
  document.getElementById('badge-calendar-count').textContent = items.length;
  document.getElementById('badge-ideas-count').textContent = ideas.length;
  document.getElementById('badge-scripts-count').textContent = scripts.length;

  // Render active view
  renderTodayView();
  renderCalendarView();
  renderIdeaBank();
  renderVideoScripts();
  updateWeeklyProgress(items);
}

// -------------------------------------------------------------
// 3. Today View
// -------------------------------------------------------------

async function renderTodayView() {
  const todayCode = getTodayDayCode();
  const todayName = FULL_DAY_NAMES[todayCode];
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const headingEl = document.getElementById('today-day-heading');
  const subtitleEl = document.getElementById('today-date-subtitle');
  const container = document.getElementById('today-items-container');

  if (headingEl) headingEl.textContent = `Today's Plan (${todayName})`;
  if (subtitleEl) subtitleEl.textContent = `${dateStr} • Direct sharing & multi-platform posting desk`;

  if (!container) return;

  const items = await window.MarvelDB.getAllContentItems();
  const scripts = await window.MarvelDB.getAllVideoScripts();

  const todayItems = items.filter(i => i.day === todayCode);
  const todayScripts = scripts.filter(s => s.day === todayCode);

  if (todayItems.length === 0 && todayScripts.length === 0) {
    container.innerHTML = `
      <div class="empty-day-state">
        <div style="font-size: 2.5rem;">🏖️</div>
        <strong style="color: var(--text-main); font-size: 1rem;">No content scheduled for today (${todayName})</strong>
        <p style="max-width: 420px; line-height: 1.4;">
          Take a break, or add an item / promote an idea from your Idea Bank.
        </p>
        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
          <button class="btn btn-primary btn-sm" onclick="openContentItemModal(null, '${todayCode}')">
            ➕ Schedule for Today
          </button>
          <button class="btn btn-secondary btn-sm" onclick="switchView('view-ideas')">
            💡 Browse Idea Bank
          </button>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  // Render Content Items
  for (const item of todayItems) {
    const cardEl = await createContentItemDOMCard(item, true);
    container.appendChild(cardEl);
  }

  // Render Today's Video Scripts
  for (const script of todayScripts) {
    const scriptEl = createScriptItemDOMCard(script);
    container.appendChild(scriptEl);
  }
}

// -------------------------------------------------------------
// 4. Calendar (Weekly View)
// -------------------------------------------------------------

async function renderCalendarView() {
  const container = document.getElementById('calendar-days-container');
  if (!container) return;

  const items = await window.MarvelDB.getAllContentItems();
  const scripts = await window.MarvelDB.getAllVideoScripts();
  const todayCode = getTodayDayCode();

  container.innerHTML = '';
  const daysOrder = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  for (const dayCode of daysOrder) {
    const dayItems = items.filter(i => i.day === dayCode);
    const dayScripts = scripts.filter(s => s.day === dayCode);
    const isToday = (dayCode === todayCode);

    const daySection = document.createElement('div');
    daySection.className = 'calendar-day-section';

    daySection.innerHTML = `
      <div class="calendar-day-header">
        <div class="calendar-day-title">
          <span>${FULL_DAY_NAMES[dayCode]}</span>
          <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">(${dayItems.length + dayScripts.length} items)</span>
          ${isToday ? '<span class="calendar-day-today-tag">Today</span>' : ''}
        </div>
        <div>
          <button class="btn btn-secondary btn-sm" onclick="openContentItemModal(null, '${dayCode}')">
            ➕ Add
          </button>
        </div>
      </div>
      <div class="day-items-list" id="day-list-${dayCode}"></div>
    `;

    const listEl = daySection.querySelector(`#day-list-${dayCode}`);

    if (dayItems.length === 0 && dayScripts.length === 0) {
      listEl.innerHTML = `
        <div class="empty-day-state" style="padding: 1rem;">
          <span style="font-size: 0.8rem;">No items scheduled for ${FULL_DAY_NAMES[dayCode]}.</span>
        </div>
      `;
    } else {
      for (const item of dayItems) {
        const cardEl = await createContentItemDOMCard(item, false);
        listEl.appendChild(cardEl);
      }
      for (const script of dayScripts) {
        const scriptEl = createScriptItemDOMCard(script);
        listEl.appendChild(scriptEl);
      }
    }

    container.appendChild(daySection);
  }

  updateWeeklyProgress(items);
}

function updateWeeklyProgress(items) {
  const targetBatch = 30; // 30 weekly posts goal
  let postedCount = 0;

  items.forEach(item => {
    const s = item.postedStatus || {};
    // If posted on at least one platform, count towards progress
    if (s.linkedin || s.instagram || s.facebook || s.youtube || s.x) {
      postedCount++;
    }
  });

  const percent = Math.min(100, Math.round((postedCount / targetBatch) * 100));

  const statsEl = document.getElementById('weekly-progress-stats');
  const fillEl = document.getElementById('weekly-progress-fill');

  if (statsEl) statsEl.textContent = `${postedCount} / ${targetBatch} Posted (${percent}%)`;
  if (fillEl) fillEl.style.width = `${percent}%`;
}

// -------------------------------------------------------------
// 5. Content Item DOM Card Builder
// -------------------------------------------------------------

async function createContentItemDOMCard(item, isTodayView = false) {
  const card = document.createElement('div');
  card.className = 'content-item-card';
  card.id = `item-dom-${item.id}`;

  const typeClass = `badge-type-${item.type.toLowerCase()}`;
  const isCardType = item.type === 'CARD' || item.type === 'CARDTEXT';
  const isTextType = item.type === 'TEXT' || item.type === 'CARDTEXT';

  card.innerHTML = `
    <div class="item-top-row">
      <div class="item-meta-badges">
        <span class="badge-day">${item.day}</span>
        <span class="badge-type ${typeClass}">${item.type}</span>
      </div>

      <div class="item-actions">
        ${isCardType ? `
          <button class="btn btn-accent btn-sm" onclick="shareContentItem('${item.id}')" title="Native Share Sheet">
            🚀 Share
          </button>
          <button class="btn btn-secondary btn-sm" onclick="downloadContentItemCard('${item.id}')" title="Download Image PNG">
            📥 Card PNG
          </button>
        ` : `
          <button class="btn btn-accent btn-sm" onclick="shareTextItem('${item.id}')" title="Share Text">
            🚀 Share
          </button>
        `}
        ${isTextType && item.caption ? `
          <button class="btn btn-secondary btn-sm" onclick="copyTextToClipboard(\`${escapeForAttribute(item.caption)}\`, 'Caption copied!')" title="Copy Caption">
            📋 Caption
          </button>
        ` : ''}
        ${isCardType && item.card ? `
          <button class="btn btn-secondary btn-sm" onclick="copyTextToClipboard(\`${escapeForAttribute(item.card)}\`, 'Card text copied!')" title="Copy Raw Card Text">
            📄 Text
          </button>
        ` : ''}
        <button class="btn btn-secondary btn-sm btn-icon-only" onclick="openContentItemModal('${item.id}')" title="Edit Item">
          ✏️
        </button>
        <button class="btn btn-danger btn-sm btn-icon-only" onclick="confirmDeleteContentItem('${item.id}')" title="Delete Item">
          🗑️
        </button>
      </div>
    </div>

    <div class="item-content-body ${!isCardType ? 'text-only' : ''}">
      ${isCardType ? `
        <div class="canvas-preview-wrapper">
          <canvas id="canvas-preview-${item.id}" class="canvas-preview-element" onclick="shareContentItem('${item.id}')" title="Click to share card"></canvas>
        </div>
      ` : ''}

      <div class="item-text-column">
        ${isCardType && item.card ? `
          <div>
            <div class="item-caption-label">🖼️ Card Markup Text</div>
            <div class="item-card-snippet">${escapeHTML(item.card)}</div>
          </div>
        ` : ''}

        ${isTextType && item.caption ? `
          <div>
            <div class="item-caption-label">📝 Social Caption</div>
            <div class="item-caption-snippet">${escapeHTML(item.caption)}</div>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Platform Checkboxes -->
    <div class="platform-status-bar">
      <span class="platform-status-label">Mark as Posted:</span>
      <div class="platform-pills-group">
        ${PLATFORMS.map(p => {
          const isChecked = item.postedStatus && item.postedStatus[p.key];
          return `
            <label class="platform-pill ${p.class} ${isChecked ? 'checked' : ''}">
              <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="handlePlatformToggle('${item.id}', '${p.key}', this.checked, 'content')" />
              <span>${p.label}</span>
            </label>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Render Canvas preview if Card type
  if (isCardType) {
    setTimeout(async () => {
      const cvs = card.querySelector(`#canvas-preview-${item.id}`);
      if (cvs && window.MarvelCardRenderer) {
        await window.MarvelCardRenderer.renderCardToCanvas(cvs, item.card, currentAppSettings);
      }
    }, 10);
  }

  return card;
}

// -------------------------------------------------------------
// 6. Video Scripts DOM Card Builder
// -------------------------------------------------------------

function createScriptItemDOMCard(script) {
  const card = document.createElement('div');
  card.className = 'script-card';
  card.id = `script-dom-${script.id}`;

  const wordCount = (script.script || '').trim().split(/\s+/).filter(Boolean).length;
  const readSeconds = Math.max(5, Math.round((wordCount / 130) * 60)); // ~130 wpm speaking pace

  card.innerHTML = `
    <div class="item-top-row">
      <div class="item-meta-badges">
        ${script.day ? `<span class="badge-day">${script.day}</span>` : '<span class="badge-day">Unscheduled</span>'}
        <span class="script-status-pill status-${(script.status || 'idea').toLowerCase()}">${script.status || 'Idea'}</span>
      </div>

      <div class="item-actions">
        <button class="btn btn-secondary btn-sm" onclick="copyTextToClipboard(\`${escapeForAttribute(script.script)}\`, 'Full script copied!')">
          📋 Copy Script
        </button>
        <button class="btn btn-secondary btn-sm btn-icon-only" onclick="openScriptModal('${script.id}')" title="Edit Script">
          ✏️
        </button>
        <button class="btn btn-danger btn-sm btn-icon-only" onclick="confirmDeleteScript('${script.id}')" title="Delete Script">
          🗑️
        </button>
      </div>
    </div>

    <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.25rem;">
      ${escapeHTML(script.title || 'Untitled Video Script')}
    </h3>
    <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem;">
      ⏱️ ~${wordCount} words • Estimated speaking duration: ${readSeconds}s
    </div>

    <div class="script-body-box">${escapeHTML(script.script || '')}</div>

    <!-- Platform Checkboxes -->
    <div class="platform-status-bar">
      <span class="platform-status-label">Mark as Posted:</span>
      <div class="platform-pills-group">
        ${PLATFORMS.map(p => {
          const isChecked = script.postedStatus && script.postedStatus[p.key];
          return `
            <label class="platform-pill ${p.class} ${isChecked ? 'checked' : ''}">
              <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="handlePlatformToggle('${script.id}', '${p.key}', this.checked, 'script')" />
              <span>${p.label}</span>
            </label>
          `;
        }).join('')}
      </div>
    </div>
  `;

  return card;
}

// -------------------------------------------------------------
// 7. Idea Bank View & Controller
// -------------------------------------------------------------

async function renderIdeaBank() {
  const container = document.getElementById('ideas-list-container');
  if (!container) return;

  const ideas = await window.MarvelDB.getAllIdeas();

  if (ideas.length === 0) {
    container.innerHTML = `
      <div class="empty-day-state" style="padding: 2rem;">
        <span style="font-size: 2rem;">💡</span>
        <strong style="color: var(--text-main);">Idea Bank is Empty</strong>
        <p style="font-size: 0.825rem; color: var(--text-muted); max-width: 380px;">
          Capture raw hooks, thoughts, client questions, or tech insights above.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = ideas.map(idea => `
    <div class="idea-item-card" id="idea-dom-${idea.id}">
      <div class="idea-text-block">
        <div>${escapeHTML(idea.text)}</div>
        ${idea.tags ? `
          <div class="idea-tags">
            ${idea.tags.split(',').map(t => `<span class="idea-tag-chip">#${escapeHTML(t.trim())}</span>`).join('')}
          </div>
        ` : ''}
      </div>
      <div style="display: flex; gap: 0.35rem; align-items: center;">
        <button class="btn btn-primary btn-sm" onclick="promoteIdeaToContentItem('${idea.id}')" title="Turn into structured content item">
          🚀 Turn into Post
        </button>
        <button class="btn btn-secondary btn-sm" onclick="copyTextToClipboard(\`${escapeForAttribute(idea.text)}\`, 'Idea copied!')" title="Copy idea text">
          📋 Copy
        </button>
        <button class="btn btn-danger btn-sm btn-icon-only" onclick="confirmDeleteIdea('${idea.id}')" title="Delete idea">
          🗑️
        </button>
      </div>
    </div>
  `).join('');
}

async function saveQuickIdea() {
  const textInput = document.getElementById('inp-quick-idea-text');
  const tagsInput = document.getElementById('inp-quick-idea-tags');

  const text = (textInput?.value || '').trim();
  const tags = (tagsInput?.value || '').trim();

  if (!text) {
    showToast('Please enter your idea text first', 'error');
    return;
  }

  await window.MarvelDB.saveIdea({
    text,
    tags,
    source: 'Me'
  });

  textInput.value = '';
  tagsInput.value = '';
  showToast('💡 Idea saved to Bank!', 'success');
  await refreshAllViews();
}

async function promoteIdeaToContentItem(ideaId) {
  const ideas = await window.MarvelDB.getAllIdeas();
  const idea = ideas.find(i => i.id === ideaId);
  if (!idea) return;

  openContentItemModal(null, getTodayDayCode());
  const cardInput = document.getElementById('edit-item-card');
  const captionInput = document.getElementById('edit-item-caption');

  if (cardInput) {
    cardInput.value = `**${idea.text}**`;
    updateModalCardPreview();
  }
  if (captionInput) {
    captionInput.value = `${idea.text}\n\n${idea.tags ? idea.tags.split(',').map(t => '#' + t.trim()).join(' ') : ''}`;
  }
}

async function confirmDeleteIdea(ideaId) {
  if (confirm('Delete this idea from your Idea Bank?')) {
    await window.MarvelDB.deleteIdea(ideaId);
    showToast('Idea deleted', 'info');
    await refreshAllViews();
  }
}

function triggerAIOnIdeaInput() {
  const input = document.getElementById('inp-quick-idea-text');
  const text = (input?.value || '').trim();
  if (!text) {
    showToast('Enter some idea text first to improve with AI', 'error');
    return;
  }
  window.MarvelAI.openAIRewriteModal(text, 'Social Media Post Hook & Idea Concept', (newText) => {
    input.value = newText;
    showToast('✨ Idea improved with AI!', 'success');
  });
}

// -------------------------------------------------------------
// 8. Video Scripts Studio View & Controller
// -------------------------------------------------------------

async function renderVideoScripts() {
  const container = document.getElementById('scripts-list-container');
  if (!container) return;

  const scripts = await window.MarvelDB.getAllVideoScripts();

  if (scripts.length === 0) {
    container.innerHTML = `
      <div class="empty-day-state" style="padding: 2.5rem;">
        <span style="font-size: 2.5rem;">🎬</span>
        <strong style="color: var(--text-main);">No Video Scripts Yet</strong>
        <p style="font-size: 0.85rem; color: var(--text-muted); max-width: 380px;">
          Create structured scripts with hook, body points, call to action, and filming status.
        </p>
        <button class="btn btn-primary btn-sm" style="margin-top: 0.75rem;" onclick="openScriptModal()">
          ➕ Create Video Script
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  scripts.forEach(script => {
    container.appendChild(createScriptItemDOMCard(script));
  });
}

function openScriptModal(scriptId = null) {
  const modal = document.getElementById('modal-script');
  const idInput = document.getElementById('edit-script-id');
  const titleInput = document.getElementById('edit-script-title-input');
  const dayInput = document.getElementById('edit-script-day');
  const statusInput = document.getElementById('edit-script-status');
  const bodyInput = document.getElementById('edit-script-body');
  const modalTitle = document.getElementById('modal-script-title');

  if (!modal) return;

  if (scriptId) {
    window.MarvelDB.getAllVideoScripts().then(scripts => {
      const s = scripts.find(x => x.id === scriptId);
      if (s) {
        idInput.value = s.id;
        titleInput.value = s.title || '';
        dayInput.value = s.day || '';
        statusInput.value = s.status || 'Ready';
        bodyInput.value = s.script || '';
        modalTitle.innerHTML = '<span>🎬</span><span>Edit Video Script</span>';
      }
    });
  } else {
    idInput.value = '';
    titleInput.value = '';
    dayInput.value = '';
    statusInput.value = 'Ready';
    bodyInput.value = 'HOOK (0-3s):\n\nBODY (3-45s):\n\nCALL TO ACTION (45-60s):';
    modalTitle.innerHTML = '<span>🎬</span><span>New Video Script</span>';
  }

  modal.classList.add('active');
}

function closeScriptModal() {
  const modal = document.getElementById('modal-script');
  if (modal) modal.classList.remove('active');
}

async function saveScriptFromModal() {
  const id = document.getElementById('edit-script-id').value;
  const title = (document.getElementById('edit-script-title-input').value || '').trim();
  const day = document.getElementById('edit-script-day').value;
  const status = document.getElementById('edit-script-status').value;
  const script = (document.getElementById('edit-script-body').value || '').trim();

  if (!title) {
    showToast('Please provide a script title', 'error');
    return;
  }

  const scriptObj = {
    id: id || undefined,
    title,
    day,
    status,
    script
  };

  await window.MarvelDB.saveVideoScript(scriptObj);
  closeScriptModal();
  showToast('🎬 Script saved successfully!', 'success');
  await refreshAllViews();
}

async function confirmDeleteScript(scriptId) {
  if (confirm('Delete this video script?')) {
    await window.MarvelDB.deleteVideoScript(scriptId);
    showToast('Script deleted', 'info');
    await refreshAllViews();
  }
}

// -------------------------------------------------------------
// 9. Content Item Modal Controller
// -------------------------------------------------------------

function openContentItemModal(itemId = null, defaultDay = 'MON') {
  const modal = document.getElementById('modal-content-item');
  const idInput = document.getElementById('edit-item-id');
  const dayInput = document.getElementById('edit-item-day');
  const typeInput = document.getElementById('edit-item-type');
  const cardInput = document.getElementById('edit-item-card');
  const captionInput = document.getElementById('edit-item-caption');
  const modalTitle = document.getElementById('modal-item-title');

  if (!modal) return;

  if (itemId) {
    window.MarvelDB.getContentItemById(itemId).then(item => {
      if (item) {
        idInput.value = item.id;
        dayInput.value = item.day || defaultDay;
        typeInput.value = item.type || 'CARDTEXT';
        cardInput.value = item.card || '';
        captionInput.value = item.caption || '';
        modalTitle.innerHTML = '<span>📝</span><span>Edit Content Item</span>';
        toggleModalFieldsByType(item.type);
        updateModalCardPreview();
      }
    });
  } else {
    idInput.value = '';
    dayInput.value = defaultDay;
    typeInput.value = 'CARDTEXT';
    cardInput.value = 'The biggest mistake in **real estate**?\n\nIgnoring ++legal title diligence++.';
    captionInput.value = 'Here is why title auditing is non-negotiable for smart investors...\n\n#PropTech #RealEstate';
    modalTitle.innerHTML = '<span>📝</span><span>New Content Item</span>';
    toggleModalFieldsByType('CARDTEXT');
    updateModalCardPreview();
  }

  modal.classList.add('active');
}

function closeContentItemModal() {
  const modal = document.getElementById('modal-content-item');
  if (modal) modal.classList.remove('active');
}

function toggleModalFieldsByType(type) {
  const cardGroup = document.getElementById('group-edit-card');
  const previewGroup = document.getElementById('group-edit-preview');
  const captionGroup = document.getElementById('group-edit-caption');

  if (type === 'CARD') {
    if (cardGroup) cardGroup.style.display = 'block';
    if (previewGroup) previewGroup.style.display = 'flex';
    if (captionGroup) captionGroup.style.display = 'none';
  } else if (type === 'TEXT') {
    if (cardGroup) cardGroup.style.display = 'none';
    if (previewGroup) previewGroup.style.display = 'none';
    if (captionGroup) captionGroup.style.display = 'block';
  } else { // CARDTEXT
    if (cardGroup) cardGroup.style.display = 'block';
    if (previewGroup) previewGroup.style.display = 'flex';
    if (captionGroup) captionGroup.style.display = 'block';
  }
}

function updateModalCardPreview() {
  const cardInput = document.getElementById('edit-item-card');
  const canvas = document.getElementById('modal-card-canvas');
  if (!canvas || !window.MarvelCardRenderer) return;

  const text = cardInput?.value || '';
  window.MarvelCardRenderer.renderCardToCanvas(canvas, text, currentAppSettings);
}

async function saveContentItemFromModal() {
  const id = document.getElementById('edit-item-id').value;
  const day = document.getElementById('edit-item-day').value;
  const type = document.getElementById('edit-item-type').value;
  const card = (document.getElementById('edit-item-card').value || '').trim();
  const caption = (document.getElementById('edit-item-caption').value || '').trim();

  if (type === 'CARD' && !card) {
    showToast('Card text is required for CARD format', 'error');
    return;
  }
  if (type === 'TEXT' && !caption) {
    showToast('Caption text is required for TEXT format', 'error');
    return;
  }

  const itemObj = {
    id: id || undefined,
    day,
    type,
    card: (type === 'TEXT') ? '' : card,
    caption: (type === 'CARD') ? '' : caption
  };

  await window.MarvelDB.saveContentItem(itemObj);
  closeContentItemModal();
  showToast('💾 Item saved successfully!', 'success');
  await refreshAllViews();
}

async function confirmDeleteContentItem(itemId) {
  if (confirm('Delete this content item?')) {
    await window.MarvelDB.deleteContentItem(itemId);
    showToast('Item deleted', 'info');
    await refreshAllViews();
  }
}

// -------------------------------------------------------------
// 10. Native Web Share API & Download Engine
// -------------------------------------------------------------

async function shareContentItem(itemId) {
  const item = await window.MarvelDB.getContentItemById(itemId);
  if (!item) return;

  const isCard = (item.type === 'CARD' || item.type === 'CARDTEXT') && item.card;

  if (isCard && window.MarvelCardRenderer) {
    try {
      const blob = await window.MarvelCardRenderer.renderCardToBlob(item.card, currentAppSettings);
      const file = new File([blob], `marvel-card-${item.day}-${Date.now()}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Marvel Content',
          text: item.caption || ''
        });
        showToast('Shared successfully! Note: On Instagram, paste caption manually.', 'info');
        return;
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('File share fallback:', err);
      } else {
        return;
      }
    }

    // Fallback: Download card image + copy caption to clipboard
    await downloadContentItemCard(itemId);
    if (item.caption) {
      copyTextToClipboard(item.caption, 'Card image downloaded & caption copied to clipboard!');
    }
  } else {
    shareTextItem(itemId);
  }
}

async function shareTextItem(itemId) {
  const item = await window.MarvelDB.getContentItemById(itemId);
  if (!item || !item.caption) return;

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Marvel Content',
        text: item.caption
      });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }

  // Fallback
  copyTextToClipboard(item.caption, 'Caption text copied to clipboard!');
}

async function downloadContentItemCard(itemId) {
  const item = await window.MarvelDB.getContentItemById(itemId);
  if (!item || !item.card) return;

  const filename = `marvel-card-${item.day.toLowerCase()}-${Date.now()}.png`;
  await window.MarvelCardRenderer.downloadCardImage(item.card, currentAppSettings, filename);
  showToast('📥 Card downloaded as PNG!', 'success');
}

// -------------------------------------------------------------
// 11. Tactical Platform Toggle Handler
// -------------------------------------------------------------

async function handlePlatformToggle(id, platform, isChecked, entityType) {
  if (entityType === 'content') {
    const item = await window.MarvelDB.getContentItemById(id);
    if (item) {
      if (!item.postedStatus) item.postedStatus = {};
      item.postedStatus[platform] = isChecked;
      await window.MarvelDB.saveContentItem(item);
      updateWeeklyProgress(await window.MarvelDB.getAllContentItems());
    }
  } else if (entityType === 'script') {
    const scripts = await window.MarvelDB.getAllVideoScripts();
    const script = scripts.find(s => s.id === id);
    if (script) {
      if (!script.postedStatus) script.postedStatus = {};
      script.postedStatus[platform] = isChecked;
      await window.MarvelDB.saveVideoScript(script);
    }
  }

  // Re-render pills status visually
  const domElem = document.getElementById(`${entityType === 'content' ? 'item-dom' : 'script-dom'}-${id}`);
  if (domElem) {
    const pill = domElem.querySelector(`.plat-${platform}`);
    if (pill) pill.classList.toggle('checked', isChecked);
  }
}

// -------------------------------------------------------------
// 12. Batch Import Parser (Contract Format)
// -------------------------------------------------------------

function openBatchImportModal() {
  const modal = document.getElementById('modal-batch-import');
  if (modal) modal.classList.add('active');
}

function closeBatchImportModal() {
  const modal = document.getElementById('modal-batch-import');
  if (modal) modal.classList.remove('active');
}

async function executeBatchImport() {
  const textarea = document.getElementById('inp-batch-import-text');
  const text = (textarea?.value || '').trim();

  if (!text) {
    showToast('Please paste your batch content text first', 'error');
    return;
  }

  const parsedItems = parseBatchImportText(text);

  if (parsedItems.length === 0) {
    showToast('No valid content blocks detected. Check format separation (---)', 'error');
    return;
  }

  const confirmMsg = `Found ${parsedItems.length} content items in batch.\n\n⚠️ Importing will replace your current weekly content items.\n(Video Scripts and Idea Bank will not be affected).\n\nProceed with import?`;
  if (!confirm(confirmMsg)) return;

  await window.MarvelDB.replaceAllContentItems(parsedItems);
  closeBatchImportModal();
  showToast(`✅ Successfully imported ${parsedItems.length} items!`, 'success');
  await refreshAllViews();
}

/**
 * Parses batch import text according to spec contract
 */
function parseBatchImportText(rawText) {
  const blocks = rawText.split(/\n\s*---\s*\n|\n---\n|^---\n|\n---$/m);
  const items = [];

  const VALID_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  blocks.forEach(block => {
    const lines = block.split(/\r?\n/);
    let day = 'MON';
    let type = '';
    let cardLines = [];
    let captionLines = [];
    let currentField = null;

    lines.forEach(line => {
      const upperTrim = line.trim().toUpperCase();

      if (upperTrim.startsWith('DAY:')) {
        const dVal = line.substring(4).trim().toUpperCase();
        day = VALID_DAYS.includes(dVal) ? dVal : 'MON';
        currentField = null;
      } else if (upperTrim.startsWith('TYPE:')) {
        const tVal = line.substring(5).trim().toUpperCase();
        if (['CARD', 'CARDTEXT', 'TEXT'].includes(tVal)) {
          type = tVal;
        }
        currentField = null;
      } else if (line.toUpperCase().startsWith('CARD:')) {
        currentField = 'card';
        cardLines.push(line.substring(5).trim());
      } else if (line.toUpperCase().startsWith('CAPTION:')) {
        currentField = 'caption';
        captionLines.push(line.substring(8).trim());
      } else if (currentField === 'card') {
        cardLines.push(line);
      } else if (currentField === 'caption') {
        captionLines.push(line);
      }
    });

    const cardText = cardLines.join('\n').trim();
    const captionText = captionLines.join('\n').trim();

    // Default TYPE rules per spec:
    // unknown TYPE defaults to CARD if card field present else TEXT
    if (!type) {
      if (cardText && captionText) type = 'CARDTEXT';
      else if (cardText) type = 'CARD';
      else type = 'TEXT';
    }

    if (cardText || captionText) {
      items.push({
        id: 'item-batch-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        day,
        type,
        card: cardText,
        caption: captionText,
        postedStatus: { linkedin: false, instagram: false, facebook: false, youtube: false, x: false },
        createdAt: new Date().toISOString()
      });
    }
  });

  return items;
}

// -------------------------------------------------------------
// 13. Settings & Data Management
// -------------------------------------------------------------

function loadSettingsIntoForm(settings) {
  if (!settings) return;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  setVal('setting-name', settings.headerName || '');
  setVal('setting-handle', settings.headerHandle || '');
  setVal('setting-card-bg', settings.cardBg || '#0f172a');
  setVal('setting-card-accent', settings.cardAccentColor || '#6366f1');
  setVal('setting-card-text', settings.cardTextColor || '#f8fafc');
  setVal('setting-card-align', settings.cardAlign || 'left');
  setVal('setting-card-size', settings.cardFontSize || 46);
  setVal('setting-card-preset', settings.cardPreset || 'square');
  setVal('setting-gemini-key', settings.geminiApiKey || '');
  setVal('setting-gemini-model', settings.geminiModel || 'gemini-1.5-flash');

  const fsLabel = document.getElementById('val-font-size');
  if (fsLabel) fsLabel.textContent = `${settings.cardFontSize || 46}px`;

  const avatarImg = document.getElementById('setting-avatar-preview');
  if (avatarImg && settings.headerAvatar) {
    avatarImg.src = settings.headerAvatar;
  }
}

async function saveSettingsForm() {
  const getVal = (id) => document.getElementById(id)?.value;

  const newSettings = {
    ...currentAppSettings,
    headerName: getVal('setting-name') || 'Marvellous Adepoju',
    headerHandle: getVal('setting-handle') || '@devmarvellous',
    cardBg: getVal('setting-card-bg') || '#0f172a',
    cardAccentColor: getVal('setting-card-accent') || '#6366f1',
    cardTextColor: getVal('setting-card-text') || '#f8fafc',
    cardAlign: getVal('setting-card-align') || 'left',
    cardFontSize: Number(getVal('setting-card-size')) || 46,
    cardPreset: getVal('setting-card-preset') || 'square',
    geminiApiKey: (getVal('setting-gemini-key') || '').trim(),
    geminiModel: getVal('setting-gemini-model') || 'gemini-1.5-flash'
  };

  await window.MarvelDB.saveSetting('app_settings', newSettings);
  currentAppSettings = newSettings;
  showToast('⚙️ Settings saved successfully!', 'success');
  await refreshAllViews();
}

function handleAvatarUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result;
    currentAppSettings.headerAvatar = base64;
    await window.MarvelDB.saveSetting('app_settings', currentAppSettings);
    const preview = document.getElementById('setting-avatar-preview');
    if (preview) preview.src = base64;
    showToast('Avatar updated!', 'success');
    await refreshAllViews();
  };
  reader.readAsDataURL(file);
}

async function testGeminiConnection() {
  const keyInput = document.getElementById('setting-gemini-key');
  const apiKey = (keyInput?.value || '').trim();

  if (!apiKey) {
    showToast('Please enter your Gemini API key above first', 'error');
    return;
  }

  showToast('Testing Gemini connection...', 'info');
  try {
    currentAppSettings.geminiApiKey = apiKey;
    await window.MarvelDB.saveSetting('app_settings', currentAppSettings);
    const testResult = await window.MarvelAI.improveTextWithGemini('Test connection for Marvel Content app');
    alert(`✅ Connection Successful!\n\nGemini Response:\n"${testResult}"`);
  } catch (err) {
    alert(`❌ Connection Failed:\n${err.message}`);
  }
}

async function exportBackupFile() {
  const jsonStr = await window.MarvelDB.exportFullBackupJSON();
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `marvel-content-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('📦 Backup JSON downloaded!', 'success');
}

async function handleRestoreFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const jsonStr = e.target.result;
      if (!confirm('⚠️ Restoring will overwrite current items, scripts, and settings with the backup file.\n\nProceed with restore?')) {
        return;
      }
      await window.MarvelDB.importFullBackupJSON(jsonStr);
      currentAppSettings = await window.MarvelDB.getSetting('app_settings');
      loadSettingsIntoForm(currentAppSettings);
      showToast('✅ Backup restored successfully!', 'success');
      await refreshAllViews();
    } catch (err) {
      alert('Restore failed: ' + err.message);
    }
  };
  reader.readAsText(file);
}

async function handleWipeData() {
  if (confirm('🚨 ARE YOU SURE?\n\nThis will permanently delete all content items, video scripts, idea bank entries, and reset settings.')) {
    if (confirm('Please confirm one more time to wipe all local data.')) {
      await window.MarvelDB.wipeAllData();
      currentAppSettings = window.MarvelDB.DEFAULT_SETTINGS;
      loadSettingsIntoForm(currentAppSettings);
      showToast('All local data cleared and reset to defaults', 'info');
      await refreshAllViews();
    }
  }
}

// -------------------------------------------------------------
// 14. AI Rewrite Field Trigger Helper
// -------------------------------------------------------------

function triggerAIOnField(fieldId, contextType = 'Social Post') {
  const field = document.getElementById(fieldId);
  const text = (field?.value || '').trim();

  if (!text) {
    showToast('Enter some text in this field first to improve with AI', 'error');
    return;
  }

  window.MarvelAI.openAIRewriteModal(text, contextType, (newText) => {
    field.value = newText;
    if (fieldId === 'edit-item-card') updateModalCardPreview();
    showToast('✨ Text replaced with AI improved version!', 'success');
  });
}

// -------------------------------------------------------------
// 15. Toast & Clipboard Utilities
// -------------------------------------------------------------

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : '💡'}</span>
    <span>${escapeHTML(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 200ms ease';
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}

function copyTextToClipboard(text, successMessage = 'Copied to clipboard!') {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMessage, 'success');
    }).catch(() => fallbackCopyText(text, successMessage));
  } else {
    fallbackCopyText(text, successMessage);
  }
}

function fallbackCopyText(text, successMessage) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast(successMessage, 'success');
}

function triggerPWAInstall() {
  if (deferredPWAInstallPrompt) {
    deferredPWAInstallPrompt.prompt();
    deferredPWAInstallPrompt.userChoice.then((choice) => {
      if (choice.outcome === 'accepted') {
        showToast('Marvel Content installed successfully!', 'success');
      }
      deferredPWAInstallPrompt = null;
      dismissPWABanner();
    });
  } else {
    alert('To install on Android / Chrome, tap your browser menu (⋮) and tap "Add to Home screen" or "Install App".');
  }
}

function dismissPWABanner() {
  const banner = document.getElementById('pwa-banner');
  if (banner) banner.classList.remove('show');
}

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeForAttribute(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

// Global functions exposure
window.switchView = switchView;
window.openContentItemModal = openContentItemModal;
window.closeContentItemModal = closeContentItemModal;
window.toggleModalFieldsByType = toggleModalFieldsByType;
window.updateModalCardPreview = updateModalCardPreview;
window.saveContentItemFromModal = saveContentItemFromModal;
window.confirmDeleteContentItem = confirmDeleteContentItem;
window.shareContentItem = shareContentItem;
window.shareTextItem = shareTextItem;
window.downloadContentItemCard = downloadContentItemCard;
window.handlePlatformToggle = handlePlatformToggle;
window.openBatchImportModal = openBatchImportModal;
window.closeBatchImportModal = closeBatchImportModal;
window.executeBatchImport = executeBatchImport;
window.saveQuickIdea = saveQuickIdea;
window.promoteIdeaToContentItem = promoteIdeaToContentItem;
window.confirmDeleteIdea = confirmDeleteIdea;
window.triggerAIOnIdeaInput = triggerAIOnIdeaInput;
window.openScriptModal = openScriptModal;
window.closeScriptModal = closeScriptModal;
window.saveScriptFromModal = saveScriptFromModal;
window.confirmDeleteScript = confirmDeleteScript;
window.saveSettingsForm = saveSettingsForm;
window.handleAvatarUpload = handleAvatarUpload;
window.testGeminiConnection = testGeminiConnection;
window.exportBackupFile = exportBackupFile;
window.handleRestoreFile = handleRestoreFile;
window.handleWipeData = handleWipeData;
window.triggerAIOnField = triggerAIOnField;
window.copyTextToClipboard = copyTextToClipboard;
window.triggerPWAInstall = triggerPWAInstall;
window.dismissPWABanner = dismissPWABanner;
window.getTodayDayCode = getTodayDayCode;
