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

function playGame(url) {
  const newWin = window.open('about:blank', '_blank');

  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error('Play request failed');
      return response.text();
    })
    .then(htmlContent => {
      if (newWin) {
        newWin.document.open();

        const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
        const preparedHtml = htmlContent.includes('<head>')
          ? htmlContent.replace('<head>', `<head><base href="${baseUrl}">`)
          : `<base href="${baseUrl}">${htmlContent}`;

        newWin.document.write(preparedHtml);
        newWin.document.close();
      }
    })
    .catch(error => console.error('Error playing game:', error));
}

const REPO_OWNER = 'CalebEGUDUDE';
const REPO_NAME = 'Chillest-Website-Games';
const CDN_BASE = `https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${REPO_NAME}@main`;

const state = {
  games: [],
  selectedCategory: 'All',
  searchTerm: '',
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
  const container = document.getElementById('container');

  if (!container) return;

  const searchText = state.searchTerm.trim().toLowerCase();
  const filteredGames = state.games.filter(game => {
    const isHidden = state.hiddenCategories.has(game.category);
    const matchesCategory = state.selectedCategory === 'All' || game.category === state.selectedCategory;
    const matchesSearch = !searchText || `${game.name} ${game.category}`.toLowerCase().includes(searchText);
    return !isHidden && matchesCategory && matchesSearch;
  });

  if (filteredGames.length === 0) {
    container.innerHTML = '<p>No games found.</p>';
    return;
  }

  container.innerHTML = '';

  filteredGames.forEach(game => {
    const matchingIcon = game.icon;
    const fallbackUrl = `https://via.placeholder.com/200?text=${encodeURIComponent(game.name)}`;
    const rawIconUrl = matchingIcon ? `${CDN_BASE}/${matchingIcon}` : fallbackUrl;

    const gameCard = document.createElement('div');
    gameCard.className = 'game-card';
    gameCard.innerHTML = `
      <div class="game-name">${game.name}</div>
      <img src="${rawIconUrl}"
           onerror="this.src='${fallbackUrl}';"
           style="width:200px;height:200px;object-fit: cover; border-radius: 20px;"
           alt="${game.name}">
      <div class="game-buttons">
        <button class="download" style="cursor: pointer;">Download</button>
        <input type="button" value="Play" class="play" style="cursor: pointer;">
      </div>
      <br>
    `;

    gameCard.querySelector('.download').addEventListener('click', () => downloadGame(game.url, game.fileName));
    gameCard.querySelector('.play').addEventListener('click', () => playGame(game.url));

    container.appendChild(gameCard);
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
    const response = await fetch(`${CDN_BASE}/games/games.json`, { cache: 'no-store' });
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
        url: filePath ? `${CDN_BASE}/${filePath}` : null,
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
  loadGames();
  loadSplash();
});
