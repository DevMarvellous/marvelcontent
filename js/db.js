/**
 * Marvel Content — IndexedDB Local Storage Manager
 * Zero-backend, offline-first client database.
 */

const DB_NAME = 'marvel_content_db';
const DB_VERSION = 1;

let dbInstance = null;

const DEFAULT_SETTINGS = {
  headerName: "Marvellous Adepoju",
  headerHandle: "@devmarvellous",
  headerAvatar: "", // Base64 data URL or empty for initial initials avatar
  cardBg: "#0f172a",
  cardTextColor: "#f8fafc",
  cardAccentColor: "#6366f1",
  cardFont: "Inter, sans-serif",
  cardFontSize: 46,
  cardAlign: "left", // 'left' | 'center'
  cardPreset: "square", // 'square' (1080x1080) | 'portrait' (1080x1350) | 'story' (1080x1920)
  geminiApiKey: "",
  geminiModel: "gemini-2.0-flash"
};

const SAMPLE_CONTENT_ITEMS = [
  {
    id: "item-mon-1",
    day: "MON",
    type: "CARDTEXT",
    card: "The biggest mistake tech founders make in **real estate**?\n\nThey think ++PropTech solves bad land titles++. It doesn't. ++Legal diligence++ always comes before technology.",
    caption: "Technology accelerates transactions, but clean title deeds ensure you actually own what you buy.\n\nHere are 3 due diligence checkpoints every investor must audit before closing deals in Lagos 🧵👇\n\n#PropTech #RealEstate #TechFounders #NigeriaBusiness",
    postedStatus: { linkedin: false, instagram: false, facebook: false, youtube: false, x: false },
    createdAt: new Date().toISOString()
  },
  {
    id: "item-tue-1",
    day: "TUE",
    type: "CARD",
    card: "**Automation without process clarity** is just ++accelerated chaos++.\n\nFix the manual workflow first.",
    caption: "Before building your automated sales funnel or CRM workflows, document the exact 5 steps your team takes manually.\n\n#Automation #Productivity #BusinessTech",
    postedStatus: { linkedin: false, instagram: false, facebook: false, youtube: false, x: false },
    createdAt: new Date().toISOString()
  },
  {
    id: "item-wed-1",
    day: "WED",
    type: "TEXT",
    card: "",
    caption: "Why I stopped using 10 different bloated SaaS tools and went back to simple, high-leverage workflows.\n\nSimplicity scales. Complexity breaks under load.\n\nWhat is one software tool you recently cut from your stack?",
    postedStatus: { linkedin: false, instagram: false, facebook: false, youtube: false, x: false },
    createdAt: new Date().toISOString()
  }
];

const SAMPLE_VIDEO_SCRIPTS = [
  {
    id: "script-1",
    day: "THU",
    title: "How PropTech is Disrupting African Real Estate in 2026",
    script: "HOOK (0-3s): Most people think real estate investing in Nigeria is 100% offline. They are wrong.\n\nBODY (3-30s): Fractional ownership platforms and digital escrow systems are eliminating title fraud. Here is what is changing...\n\nCALL TO ACTION (30-45s): Drop a comment if you want my top 5 PropTech checklist for 2026.",
    status: "Ready",
    postedStatus: { linkedin: false, instagram: false, facebook: false, youtube: false, x: false },
    createdAt: new Date().toISOString()
  }
];

const SAMPLE_IDEAS = [
  {
    id: "idea-1",
    text: "Explain why commercial lease indexing tied to inflation protects developers in high-volatility markets.",
    source: "Me",
    tags: "Real Estate, Finance",
    createdAt: new Date().toISOString()
  },
  {
    id: "idea-2",
    text: "Micro-SaaS breakdown: 3 internal tools every real estate brokerage can build with zero code.",
    source: "Me",
    tags: "Tech, SaaS",
    createdAt: new Date().toISOString()
  }
];

/**
 * Open and initialize IndexedDB database
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. content_items store
      if (!db.objectStoreNames.contains('content_items')) {
        const contentStore = db.createObjectStore('content_items', { keyPath: 'id' });
        contentStore.createIndex('day', 'day', { unique: false });
        contentStore.createIndex('type', 'type', { unique: false });
        contentStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 2. video_scripts store
      if (!db.objectStoreNames.contains('video_scripts')) {
        const scriptStore = db.createObjectStore('video_scripts', { keyPath: 'id' });
        scriptStore.createIndex('status', 'status', { unique: false });
        scriptStore.createIndex('day', 'day', { unique: false });
        scriptStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 3. idea_bank store
      if (!db.objectStoreNames.contains('idea_bank')) {
        const ideaStore = db.createObjectStore('idea_bank', { keyPath: 'id' });
        ideaStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 4. settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = async (event) => {
      dbInstance = event.target.result;
      await seedInitialDataIfEmpty();
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Seed initial sample content if stores are empty on first launch
 */
async function seedInitialDataIfEmpty() {
  try {
    const settings = await getSetting('app_settings');
    if (!settings) {
      await saveSetting('app_settings', DEFAULT_SETTINGS);
    }

    const items = await getAllContentItems();
    if (!items || items.length === 0) {
      for (const item of SAMPLE_CONTENT_ITEMS) {
        await saveContentItem(item);
      }
    }

    const scripts = await getAllVideoScripts();
    if (!scripts || scripts.length === 0) {
      for (const script of SAMPLE_VIDEO_SCRIPTS) {
        await saveVideoScript(script);
      }
    }

    const ideas = await getAllIdeas();
    if (!ideas || ideas.length === 0) {
      for (const idea of SAMPLE_IDEAS) {
        await saveIdea(idea);
      }
    }
  } catch (err) {
    console.warn('Seeding initial data skipped:', err);
  }
}

// -------------------------------------------------------------
// Generic Store Helpers
// -------------------------------------------------------------

function getStore(storeName, mode = 'readonly') {
  const tx = dbInstance.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

// -------------------------------------------------------------
// Settings Store
// -------------------------------------------------------------

async function getSetting(key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => reject(req.error);
  });
}

async function saveSetting(key, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const req = store.put({ key, value });
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// -------------------------------------------------------------
// Content Items Store
// -------------------------------------------------------------

async function getAllContentItems() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('content_items', 'readonly');
    const store = tx.objectStore('content_items');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function getContentItemById(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('content_items', 'readonly');
    const store = tx.objectStore('content_items');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function saveContentItem(item) {
  const db = await openDatabase();
  if (!item.id) {
    item.id = 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
  }
  if (!item.createdAt) {
    item.createdAt = new Date().toISOString();
  }
  if (!item.postedStatus) {
    item.postedStatus = { linkedin: false, instagram: false, facebook: false, youtube: false, x: false };
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction('content_items', 'readwrite');
    const store = tx.objectStore('content_items');
    const req = store.put(item);
    req.onsuccess = () => resolve(item);
    req.onerror = () => reject(req.error);
  });
}

async function deleteContentItem(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('content_items', 'readwrite');
    const store = tx.objectStore('content_items');
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function replaceAllContentItems(items) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('content_items', 'readwrite');
    const store = tx.objectStore('content_items');
    
    // Clear first
    const clearReq = store.clear();
    clearReq.onsuccess = () => {
      let completed = 0;
      if (items.length === 0) return resolve(true);

      items.forEach(item => {
        if (!item.id) {
          item.id = 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
        }
        if (!item.postedStatus) {
          item.postedStatus = { linkedin: false, instagram: false, facebook: false, youtube: false, x: false };
        }
        const putReq = store.put(item);
        putReq.onsuccess = () => {
          completed++;
          if (completed === items.length) resolve(true);
        };
        putReq.onerror = () => reject(putReq.error);
      });
    };
    clearReq.onerror = () => reject(clearReq.error);
  });
}

// -------------------------------------------------------------
// Video Scripts Store
// -------------------------------------------------------------

async function getAllVideoScripts() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('video_scripts', 'readonly');
    const store = tx.objectStore('video_scripts');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function saveVideoScript(script) {
  const db = await openDatabase();
  if (!script.id) {
    script.id = 'script-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
  }
  if (!script.createdAt) {
    script.createdAt = new Date().toISOString();
  }
  if (!script.postedStatus) {
    script.postedStatus = { linkedin: false, instagram: false, facebook: false, youtube: false, x: false };
  }
  if (!script.status) {
    script.status = 'Idea'; // 'Idea' | 'Ready' | 'Filmed' | 'Posted'
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction('video_scripts', 'readwrite');
    const store = tx.objectStore('video_scripts');
    const req = store.put(script);
    req.onsuccess = () => resolve(script);
    req.onerror = () => reject(req.error);
  });
}

async function deleteVideoScript(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('video_scripts', 'readwrite');
    const store = tx.objectStore('video_scripts');
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// -------------------------------------------------------------
// Idea Bank Store
// -------------------------------------------------------------

async function getAllIdeas() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('idea_bank', 'readonly');
    const store = tx.objectStore('idea_bank');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function saveIdea(idea) {
  const db = await openDatabase();
  if (!idea.id) {
    idea.id = 'idea-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
  }
  if (!idea.createdAt) {
    idea.createdAt = new Date().toISOString();
  }
  if (!idea.source) {
    idea.source = 'Me';
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction('idea_bank', 'readwrite');
    const store = tx.objectStore('idea_bank');
    const req = store.put(idea);
    req.onsuccess = () => resolve(idea);
    req.onerror = () => reject(req.error);
  });
}

async function deleteIdea(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('idea_bank', 'readwrite');
    const store = tx.objectStore('idea_bank');
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// -------------------------------------------------------------
// Full Backup Export & Import (JSON)
// -------------------------------------------------------------

async function exportFullBackupJSON() {
  const settings = await getSetting('app_settings');
  const content_items = await getAllContentItems();
  const video_scripts = await getAllVideoScripts();
  const idea_bank = await getAllIdeas();

  const backupData = {
    version: 1,
    appName: "Marvel Content",
    exportedAt: new Date().toISOString(),
    settings: settings || DEFAULT_SETTINGS,
    content_items: content_items,
    video_scripts: video_scripts,
    idea_bank: idea_bank
  };

  return JSON.stringify(backupData, null, 2);
}

async function importFullBackupJSON(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid JSON format');
    }

    if (data.settings) {
      await saveSetting('app_settings', data.settings);
    }
    if (Array.isArray(data.content_items)) {
      await replaceAllContentItems(data.content_items);
    }
    if (Array.isArray(data.video_scripts)) {
      const db = await openDatabase();
      const tx = db.transaction('video_scripts', 'readwrite');
      const store = tx.objectStore('video_scripts');
      await new Promise((res, rej) => {
        const clr = store.clear();
        clr.onsuccess = () => res();
        clr.onerror = () => rej(clr.error);
      });
      for (const script of data.video_scripts) {
        await saveVideoScript(script);
      }
    }
    if (Array.isArray(data.idea_bank)) {
      const db = await openDatabase();
      const tx = db.transaction('idea_bank', 'readwrite');
      const store = tx.objectStore('idea_bank');
      await new Promise((res, rej) => {
        const clr = store.clear();
        clr.onsuccess = () => res();
        clr.onerror = () => rej(clr.error);
      });
      for (const idea of data.idea_bank) {
        await saveIdea(idea);
      }
    }

    return true;
  } catch (err) {
    console.error('Import failed:', err);
    throw err;
  }
}

async function wipeAllData() {
  const db = await openDatabase();
  const stores = ['content_items', 'video_scripts', 'idea_bank', 'settings'];
  const tx = db.transaction(stores, 'readwrite');
  
  for (const s of stores) {
    tx.objectStore(s).clear();
  }

  await new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });

  // Re-seed default settings
  await saveSetting('app_settings', DEFAULT_SETTINGS);
  return true;
}

// Export functions to global scope
window.MarvelDB = {
  openDatabase,
  getSetting,
  saveSetting,
  getAllContentItems,
  getContentItemById,
  saveContentItem,
  deleteContentItem,
  replaceAllContentItems,
  getAllVideoScripts,
  saveVideoScript,
  deleteVideoScript,
  getAllIdeas,
  saveIdea,
  deleteIdea,
  exportFullBackupJSON,
  importFullBackupJSON,
  wipeAllData,
  DEFAULT_SETTINGS
};
