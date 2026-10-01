function downloadGame(url, filename) {
  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error('Download request failed');
      return response.blob();
    })
    .then(blob => {
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    })
    .catch(error => console.error('Error downloading game:', error));
}

function addBaseTagIfMissing(html, baseTag) {
  const headMatch = /<head\b[^>]*>/i.exec(html);
  if (!headMatch) {
    return /<base\b[^>]*\bhref\s*=/i.test(html) ? html : `${baseTag}${html}`;
  }

  const headContentStart = headMatch.index + headMatch[0].length;
  const headCloseMatch = /<\/head\s*>/i.exec(html.slice(headContentStart));
  const headContentEnd = headCloseMatch ? headContentStart + headCloseMatch.index : html.length;
  if (/<base\b[^>]*\bhref\s*=/i.test(html.slice(headMatch.index, headContentEnd))) return html;

  return `${html.slice(0, headContentStart)}${baseTag}${html.slice(headContentStart)}`;
}

async function loadGameIntoDocument(gameDocument, url) {
  if (!gameDocument) return;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Play request failed');

    const baseUrl = new URL('.', url).href;
    const baseTag = `<base href="${baseUrl.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}">`;
    const reader = response.body?.getReader();

    if (!reader) {
      const html = await response.text();
      gameDocument.open();
      gameDocument.write(addBaseTagIfMissing(html, baseTag));
      gameDocument.close();
      return;
    }

    const decoder = new TextDecoder();
    let pending = '';
    let documentStarted = false;

    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });

      if (!documentStarted) {
        const headMatch = /<head\b[^>]*>/i.exec(pending);
        const headContentStart = headMatch ? headMatch.index + headMatch[0].length : 0;
        const headCloseMatch = headMatch ? /<\/head\s*>/i.exec(pending.slice(headContentStart)) : null;

        if (headMatch && headCloseMatch) {
          const headEnd = headContentStart + headCloseMatch.index + headCloseMatch[0].length;
          gameDocument.open();
          gameDocument.write(addBaseTagIfMissing(pending.slice(0, headEnd), baseTag));
          pending = pending.slice(headEnd);
          documentStarted = true;
        } else if (done) {
          gameDocument.open();
          gameDocument.write(addBaseTagIfMissing(pending, baseTag));
          pending = '';
          documentStarted = true;
        }
      }

      if (documentStarted && pending) {
        gameDocument.write(pending);
        pending = '';
      }

      if (done) break;
    }

    gameDocument.close();
  } catch (error) {
    console.error('Error playing game:', error);
    gameDocument.open();
    gameDocument.write('<!doctype html><html><body></body></html>');
    gameDocument.close();
    const message = gameDocument.createElement('p');
    message.textContent = 'Unable to load this game.';
    gameDocument.body.appendChild(message);
  }
}

function createGamePlayer(url) {
  const playerDocument = document;
  const player = playerDocument.createElement('main');
  player.className = 'game-player';
  const toolbar = playerDocument.createElement('nav');
  toolbar.className = 'game-player-toolbar';
  toolbar.setAttribute('aria-label', 'Game controls');
  const frame = playerDocument.createElement('iframe');
  frame.className = 'game-player-frame';
  frame.title = 'Game';
  frame.allow = 'fullscreen';

  const addAction = (label, onClick) => {
    const button = playerDocument.createElement('button');
    button.type = 'button';
    button.className = 'game-player-action';
    button.textContent = label;
    button.addEventListener('click', onClick);
    toolbar.appendChild(button);
  };

  addAction('Open in new tab', () => {
    openGameInNewTab(url);
  });
  addAction('Fullscreen', () => {
    const request = frame.requestFullscreen?.();
    request?.catch(error => console.error('Unable to enter fullscreen:', error));
  });
  addAction('Download', () => downloadGame(url, url.split('/').pop() || 'game.html'));
  addAction('Close', () => {
    player.remove();
  });

  player.append(toolbar, frame);
  playerDocument.body.appendChild(player);
  loadGameIntoDocument(frame.contentDocument, url);
}

function openGameInNewTab(url) {
  const gameWindow = window.open('about:blank', '_blank');
  if (!gameWindow) return;

  gameWindow.opener = null;
  loadGameIntoDocument(gameWindow.document, url);
}

function playGame(url) {
  if (state.openInNewTab) {
    openGameInNewTab(url);
    return;
  }

  createGamePlayer(url);
}

const REPO_OWNER = 'CalebEGUDUDE';
const REPO_NAME = 'Chillest-Website-Games';
const GAMES_RELEASE = 'v1-0-0_release';
const GAMES_BASE_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${GAMES_RELEASE}`;
const APPS_BASE_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main`;

const state = {
  games: [],
  apps: [],
  selectedCategory: 'All',
  searchTerm: '',
  openInNewTab: true,
  hiddenCategories: new Set(['DEBUG'])
};

function getGameCategory(filePath) {
  const parts = filePath.split('/');
  if (parts.length >= 4 && parts[0] === 'games' && parts[1] === 'html') {
    const categoryParts = parts.slice(2, -1);
    if (categoryParts.length > 0) {
      return categoryParts.join(' / ');
    }
  }

  return 'Uncategorized';
}

function getCategoryButtons(gameList) {
  const categories = ['All'];

  gameList.forEach(game => {
    if (!categories.includes(game.category)) {
      categories.push(game.category);
    }
  });

  return categories;
}

function getVisibleCategories(gameList) {
  return getCategoryButtons(gameList).filter(category => category === 'All' || !state.hiddenCategories.has(category));
}

function renderCategoryButtons(categories) {
  const categoryContainer = document.getElementById('catagories');
  if (!categoryContainer) return;

  const visibleCategories = getVisibleCategories(state.games);
  if (state.selectedCategory !== 'All' && !visibleCategories.includes(state.selectedCategory)) {
    state.selectedCategory = 'All';
  }

  categoryContainer.innerHTML = '';

  visibleCategories.forEach(category => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `bar ${state.selectedCategory === category ? 'active' : ''}`;
    button.textContent = category;
    button.addEventListener('click', () => {
      state.selectedCategory = category;
      renderCategoryButtons(getCategoryButtons(state.games));
      renderGames();
    });
    button.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (category !== 'All') {
        if (state.hiddenCategories.has(category)) {
          state.hiddenCategories.delete(category);
        } else {
          state.hiddenCategories.add(category);
        }
        renderCategoryButtons(getCategoryButtons(state.games));
        renderGames();
      }
    });
    categoryContainer.appendChild(button);
  });
}

function renderGames() {
  renderItems(state.games, document.getElementById('container'), 'games');
}

function renderApps() {
  renderItems(state.apps, document.getElementById('apps-container'), 'apps');
}

function renderItems(items, container, itemType) {

  if (!container) return;

  const searchText = state.searchTerm.trim().toLowerCase();
  const filteredItems = items.filter(item => {
    const isHidden = itemType === 'games' && state.hiddenCategories.has(item.category);
    const matchesCategory = itemType !== 'games' || state.selectedCategory === 'All' || item.category === state.selectedCategory;
    const matchesSearch = !searchText || `${item.name} ${item.category}`.toLowerCase().includes(searchText);
    return !isHidden && matchesCategory && matchesSearch;
  });

  if (filteredItems.length === 0) {
    container.innerHTML = `<p>No ${itemType} found.</p>`;
    return;
  }

  container.innerHTML = '';

  filteredItems.forEach(item => {
    const matchingIcon = item.icon;
    const baseUrl = itemType === 'apps' ? APPS_BASE_URL : GAMES_BASE_URL;
    const fallbackUrl = `https://via.placeholder.com/200?text=${encodeURIComponent(item.name)}`;
    const rawIconUrl = matchingIcon ? `${baseUrl}/${matchingIcon}` : fallbackUrl;
    const downloadButton = state.openInNewTab ? '<button class="download" style="cursor: pointer;">Download</button>' : '';

    const gameCard = document.createElement('div');
    gameCard.className = 'game-card';
    gameCard.innerHTML = `
       <div class="game-name">${item.name}</div>
      <img src="${rawIconUrl}"
           onerror="this.src='${fallbackUrl}';"
         alt="${item.name}">
      <div class="game-buttons">
        ${downloadButton}
        <input type="button" value="Play" class="play" style="cursor: pointer;">
      </div>
    `;

    const downloadControl = gameCard.querySelector('.download');
    if (downloadControl) {
      downloadControl.addEventListener('click', () => downloadGame(item.url, item.fileName));
    }
    gameCard.querySelector('.play').addEventListener('click', () => playGame(item.url));

    container.appendChild(gameCard);
  });
}

const DEFAULT_TAB_ICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="#06384b"/><path d="M12 18h40v28H12z" fill="none" stroke="#ff8c00" stroke-width="4"/><path d="M12 26h40" stroke="#ff8c00" stroke-width="4"/></svg>')}`;

function setTabIcon(iconUrl) {
  const favicon = document.getElementById('site-favicon');
  if (!favicon) return false;

  if (!iconUrl.trim()) {
    favicon.href = DEFAULT_TAB_ICON;
    return true;
  }

  try {
    const parsedUrl = new URL(iconUrl.trim(), window.location.href);
    const isImageDataUrl = parsedUrl.protocol === 'data:' && parsedUrl.pathname.startsWith('image/');
    if (!['http:', 'https:'].includes(parsedUrl.protocol) && !isImageDataUrl) return false;
    favicon.href = parsedUrl.href;
    return true;
  } catch (error) {
    return false;
  }
}

function parseCloakWebsite(value) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const websiteUrl = /^[a-z][a-z\d+.-]*:/i.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;

  try {
    const website = new URL(websiteUrl);
    if (!['http:', 'https:'].includes(website.protocol)) return null;
    if (!website.hostname.includes('.') && website.hostname !== 'localhost') return null;
    return website;
  } catch (error) {
    return null;
  }
}

let cloakTitleLookup = 0;

function getWebsiteFallbackName(hostname) {
  const ignoredSubdomains = new Set(['www', 'www2', 'm', 'mobile', 'app', 'apps', 'accounts', 'login', 'auth', 'docs', 'support', 'help', 'blog', 'shop', 'store', 'mail']);
  const labels = hostname.toLowerCase().split('.');
  while (labels.length > 2 && ignoredSubdomains.has(labels[0])) labels.shift();

  return (labels[0] || hostname)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase());
}

async function getWebsiteName(website) {
  try {
    const response = await fetch(website.href, {
      mode: 'cors',
      credentials: 'omit',
      signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) return '';

    const html = await response.text();
    const page = new DOMParser().parseFromString(html, 'text/html');
    const candidates = [
      page.querySelector('meta[property="og:site_name"]')?.content,
      page.querySelector('meta[name="application-name"]')?.content,
      page.title
    ];

    return candidates.find(name => typeof name === 'string' && name.trim())?.trim().slice(0, 80) || '';
  } catch (error) {
    return '';
  }
}

function setTabCloaking(enabled, websiteValue = '') {
  const lookupId = ++cloakTitleLookup;
  if (!enabled) {
    document.title = 'Chillest Website';
    setTabIcon('');
    return;
  }

  const website = parseCloakWebsite(websiteValue);
  if (!website) {
    document.title = 'New Tab';
    setTabIcon('');
    return;
  }

  document.title = getWebsiteFallbackName(website.hostname);
  setTabIcon(new URL('/favicon.ico', website.origin).href);

  getWebsiteName(website).then(name => {
    if (name && lookupId === cloakTitleLookup && document.getElementById('cl0ak')?.checked) {
      document.title = name;
    }
  });
}

const THEME_SETTINGS = [
  { id: 'theme-background', property: '--background', storageKey: 'themeBackground', defaultColor: '#06384b' },
  { id: 'theme-text', property: '--orange', storageKey: 'themeText', defaultColor: '#ff8c00' },
  { id: 'theme-highlight', property: '--yellow', storageKey: 'themeHighlight', defaultColor: '#ffb000' }
];

function getSettingsExport() {
  return {
    version: 1,
    openInNewTab: document.getElementById('open-in-new-tab')?.checked === true,
    cl0ak: document.getElementById('cl0ak')?.checked === true,
    cl0akWebsite: document.getElementById('cloak-website')?.value || '',
    theme: Object.fromEntries(THEME_SETTINGS.map(setting => [
      setting.storageKey,
      document.getElementById(setting.id)?.value || setting.defaultColor
    ]))
  };
}

function isValidSettingsExport(settings) {
  if (!settings || typeof settings !== 'object' || settings.version !== 1) return false;
  if (typeof settings.openInNewTab !== 'boolean' || typeof settings.cl0ak !== 'boolean' || typeof settings.cl0akWebsite !== 'string') return false;
  if (!settings.theme || typeof settings.theme !== 'object') return false;

  return THEME_SETTINGS.every(setting => /^#[\da-f]{6}$/i.test(settings.theme[setting.storageKey]));
}

function setSettingsFileStatus(message) {
  const status = document.getElementById('settings-file-status');
  if (status) status.textContent = message;
}

function setupSettingsFileControls() {
  const exportButton = document.getElementById('export-settings');
  const importButton = document.getElementById('import-settings');
  const fileInput = document.getElementById('settings-file');
  if (!exportButton || !importButton || !fileInput) return;

  exportButton.addEventListener('click', () => {
    const file = new Blob([JSON.stringify(getSettingsExport(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chillest-settings.json';
    link.click();
    URL.revokeObjectURL(url);
    setSettingsFileStatus('Settings exported.');
  });

  importButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;

    try {
      const settings = JSON.parse(await file.text());
      if (!isValidSettingsExport(settings)) throw new Error('Invalid settings file.');

      const openInNewTabInput = document.getElementById('open-in-new-tab');
      const cl0akInput = document.getElementById('cl0ak');
      const cloakWebsiteInput = document.getElementById('cloak-website');
      const website = parseCloakWebsite(settings.cl0akWebsite);
      if (settings.cl0akWebsite && !website) throw new Error('Invalid cloak website.');

      openInNewTabInput.checked = settings.openInNewTab;
      openInNewTabInput.dispatchEvent(new Event('change'));
      THEME_SETTINGS.forEach(setting => {
        const input = document.getElementById(setting.id);
        input.value = settings.theme[setting.storageKey];
        input.dispatchEvent(new Event('input'));
      });

      cloakWebsiteInput.value = website ? website.origin : '';
      cl0akInput.checked = settings.cl0ak;
      if (website) {
        cloakWebsiteInput.dispatchEvent(new Event('change'));
        if (!settings.cl0ak) {
          cl0akInput.checked = false;
          cl0akInput.dispatchEvent(new Event('change'));
        }
      } else {
        cl0akInput.dispatchEvent(new Event('change'));
      }
      setSettingsFileStatus('Settings imported.');
    } catch (error) {
      setSettingsFileStatus(`Could not import settings: ${error.message}`);
    }
  });
}

function setupThemeSettings() {
  const root = document.documentElement;
  const colorInputs = THEME_SETTINGS.map(setting => ({
    ...setting,
    input: document.getElementById(setting.id)
  }));

  const applyColor = (setting, color) => {
    if (!setting.input || !/^#[\da-f]{6}$/i.test(color)) return;
    setting.input.value = color;
    root.style.setProperty(setting.property, color);
  };

  colorInputs.forEach(setting => {
    if (!setting.input) return;

    let savedColor = setting.defaultColor;
    try {
      const storedColor = localStorage.getItem(setting.storageKey);
      if (storedColor && /^#[\da-f]{6}$/i.test(storedColor)) savedColor = storedColor;
    } catch (error) {
      console.warn('Unable to load theme settings:', error);
    }
    applyColor(setting, savedColor);

    setting.input.addEventListener('input', () => {
      applyColor(setting, setting.input.value);
      try {
        localStorage.setItem(setting.storageKey, setting.input.value);
      } catch (error) {
        console.warn('Unable to save theme settings:', error);
      }
    });
  });

  document.getElementById('reset-theme')?.addEventListener('click', () => {
    colorInputs.forEach(setting => {
      applyColor(setting, setting.defaultColor);
      try {
        localStorage.removeItem(setting.storageKey);
      } catch (error) {
        console.warn('Unable to reset theme settings:', error);
      }
    });
  });
}

function setupPageNavigation() {
  setupThemeSettings();
  setupSettingsFileControls();
  const gamesButton = document.getElementById('games-view-button');
  const appsButton = document.getElementById('apps-view-button');
  const settingsButton = document.getElementById('settings-view-button');
  const gameControls = document.getElementById('game-controls');
  const gamesPage = document.getElementById('games-page');
  const appsPage = document.getElementById('apps-page');
  const settingsPage = document.getElementById('settings-page');
  const openInNewTabInput = document.getElementById('open-in-new-tab');
  const cl0akInput = document.getElementById('cl0ak');
  const cloakWebsiteInput = document.getElementById('cloak-website');
  const resetCloakWebsiteButton = document.getElementById('reset-cloak-website');

  if (!gamesButton || !appsButton || !settingsButton || !gameControls || !gamesPage || !appsPage || !settingsPage || !openInNewTabInput || !cl0akInput || !cloakWebsiteInput || !resetCloakWebsiteButton) return;

  let savedCloakWebsite = '';
  try {
    openInNewTabInput.checked = localStorage.getItem('openInNewTab') === 'true';
    cl0akInput.checked = localStorage.getItem('cl0ak') === 'true';
    savedCloakWebsite = localStorage.getItem('cl0akWebsite') || localStorage.getItem('customTabIcon') || '';
  } catch (error) {
    openInNewTabInput.checked = false;
    cl0akInput.checked = false;
  }
  state.openInNewTab = openInNewTabInput.checked;
  const savedWebsite = parseCloakWebsite(savedCloakWebsite);
  cloakWebsiteInput.value = savedWebsite ? savedWebsite.origin : '';
  setTabCloaking(cl0akInput.checked, cloakWebsiteInput.value);
  if (savedWebsite && savedCloakWebsite !== savedWebsite.origin) {
    try {
      localStorage.setItem('cl0akWebsite', savedWebsite.origin);
      localStorage.removeItem('customTabIcon');
    } catch (error) {
      console.warn('Unable to update saved cloak website:', error);
    }
  }

  const showPage = page => {
    const isGames = page === 'games';
    const isApps = page === 'apps';
    gameControls.hidden = !isGames;
    gamesPage.hidden = !isGames;
    appsPage.hidden = !isApps;
    settingsPage.hidden = isGames || isApps;
    gamesButton.classList.toggle('active', isGames);
    appsButton.classList.toggle('active', isApps);
    settingsButton.classList.toggle('active', !isGames && !isApps);
    gamesButton.setAttribute('aria-pressed', String(isGames));
    appsButton.setAttribute('aria-pressed', String(isApps));
    settingsButton.setAttribute('aria-pressed', String(!isGames && !isApps));
  };

  gamesButton.addEventListener('click', () => showPage('games'));
  appsButton.addEventListener('click', () => showPage('apps'));
  settingsButton.addEventListener('click', () => showPage('settings'));
  openInNewTabInput.addEventListener('change', () => {
    state.openInNewTab = openInNewTabInput.checked;
    renderGames();
    try {
      localStorage.setItem('openInNewTab', String(openInNewTabInput.checked));
    } catch (error) {
      console.warn('Unable to save settings:', error);
    }
  });
  cl0akInput.addEventListener('change', () => {
    setTabCloaking(cl0akInput.checked, cloakWebsiteInput.value);
    try {
      localStorage.setItem('cl0ak', String(cl0akInput.checked));
    } catch (error) {
      console.warn('Unable to save settings:', error);
    }
  });
  cloakWebsiteInput.addEventListener('input', () => cloakWebsiteInput.setCustomValidity(''));
  cloakWebsiteInput.addEventListener('change', () => {
    const website = parseCloakWebsite(cloakWebsiteInput.value);
    if (!website) {
      cloakWebsiteInput.setCustomValidity('Enter a website such as example.com.');
      cloakWebsiteInput.reportValidity();
      return;
    }

    cloakWebsiteInput.setCustomValidity('');
    cloakWebsiteInput.value = website.origin;
    cl0akInput.checked = true;
    setTabCloaking(true, website.origin);
    try {
      localStorage.setItem('cl0akWebsite', website.origin);
      localStorage.setItem('cl0ak', 'true');
    } catch (error) {
      console.warn('Unable to save cloak website:', error);
    }
  });
  resetCloakWebsiteButton.addEventListener('click', () => {
    cloakWebsiteInput.value = '';
    cloakWebsiteInput.setCustomValidity('');
    cl0akInput.checked = false;
    setTabCloaking(false);
    try {
      localStorage.removeItem('cl0akWebsite');
      localStorage.removeItem('customTabIcon');
      localStorage.setItem('cl0ak', 'false');
    } catch (error) {
      console.warn('Unable to reset cloak website:', error);
    }
  });
}

async function loadGames() {
  const container = document.getElementById('container');
  const searchInput = document.getElementById('search');

  if (!container) return;

  container.innerHTML = '<p>Loading games...</p>';

  if (searchInput) {
    searchInput.addEventListener('input', event => {
      state.searchTerm = event.target.value;
      renderGames();
    });
  }

  try {
    const response = await fetch(`${GAMES_BASE_URL}/games/games.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Unable to load game list (${response.status})`);

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = '<p>No games found in games/games.json</p>';
      return;
    }

    state.games = data.filter(item => {
      return item && typeof item.name === 'string' && item.name.trim() && typeof item.html === 'string' && item.html.trim();
    }).map(item => {
      const filePath = item.html;
      const fileName = filePath ? filePath.split('/').pop() : null;
      const category = filePath ? getGameCategory(filePath) : 'Uncategorized';
      const iconPath = typeof item.icon === 'string' ? item.icon.replace(/^\/+/, '') : null;

      return {
        name: item.name.trim(),
        category,
        fileName,
        url: filePath ? `${GAMES_BASE_URL}/${filePath}` : null,
        icon: iconPath
      };
    });

    renderCategoryButtons(getCategoryButtons(state.games));
    renderGames();
  } catch (error) {
    console.error('Failed to load games:', error);
    container.innerHTML = `<p style="color: red;">Error loading games: ${error.message}</p>`;
  }
}

async function loadApps() {
  const container = document.getElementById('apps-container');
  if (!container) return;

  container.innerHTML = '<p>Loading apps...</p>';

  try {
    const response = await fetch(`${APPS_BASE_URL}/apps/apps.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Unable to load app list (${response.status})`);

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = '<p>No apps found in apps/apps.json</p>';
      return;
    }

    state.apps = data.filter(item => {
      return item && typeof item.name === 'string' && item.name.trim() && typeof item.html === 'string' && item.html.trim();
    }).map(item => {
      const filePath = item.html;
      const fileName = filePath.split('/').pop();
      const iconPath = typeof item.icon === 'string' ? item.icon.replace(/^\/+/, '') : null;

      return {
        name: item.name.trim(),
        category: 'Apps',
        fileName,
        url: `${APPS_BASE_URL}/${filePath}`,
        icon: iconPath
      };
    });

    renderApps();
  } catch (error) {
    console.error('Failed to load apps:', error);
    container.innerHTML = `<p style="color: red;">Error loading apps: ${error.message}</p>`;
  }
}

const SPLASHES_URL = 'https://raw.githubusercontent.com/CalebEGUDUDE/Chillest-Website-Games/main/assets/text/splashes.json';

function getSplashPool(payload) {
  if (Array.isArray(payload)) return payload.filter(item => typeof item === 'string');
  if (payload && Array.isArray(payload.splashes)) {
    return payload.splashes.filter(item => typeof item === 'string');
  }
  return [];
}

async function loadSplash() {
  const splashElement = document.getElementById('splash');
  if (!splashElement) return;

  try {
    const response = await fetch(SPLASHES_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Splash request failed (${response.status})`);
    }

    const payload = await response.json();
    const splashes = getSplashPool(payload);

    if (splashes.length === 0) {
      throw new Error('No splash entries were returned');
    }

    const randomSplash = splashes[Math.floor(Math.random() * splashes.length)];
    splashElement.textContent = randomSplash;
  } catch (error) {
    console.error('Failed to load splash:', error);
    splashElement.textContent = 'Loading...';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupPageNavigation();
  loadGames();
  loadApps();
  loadSplash();
});
