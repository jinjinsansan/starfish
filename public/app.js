const $ = (id) => document.getElementById(id);

const loginScreen = $('login-screen');
const libraryScreen = $('library-screen');
const playerModal = $('player-modal');
const loginForm = $('login-form');
const loginError = $('login-error');
const videoGrid = $('video-grid');
const emptyMsg = $('empty-msg');
const videoPlayer = $('video-player');
const playerTitle = $('player-title');

// Auth
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');

  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: $('password').value }),
  });

  if (res.ok) {
    showLibrary();
  } else {
    loginError.classList.remove('hidden');
    $('password').value = '';
    $('password').focus();
  }
});

$('logout-btn').addEventListener('click', async () => {
  await fetch('/api/auth', { method: 'DELETE' });
  videoPlayer.pause();
  videoPlayer.removeAttribute('src');
  libraryScreen.classList.add('hidden');
  playerModal.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  $('password').value = '';
});

$('close-player').addEventListener('click', () => {
  videoPlayer.pause();
  videoPlayer.removeAttribute('src');
  playerModal.classList.add('hidden');
});

// Keyboard: Escape to close player
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !playerModal.classList.contains('hidden')) {
    $('close-player').click();
  }
});

async function showLibrary() {
  loginScreen.classList.add('hidden');
  libraryScreen.classList.remove('hidden');
  await loadVideos();
}

async function loadVideos() {
  const res = await fetch('/api/videos');
  if (res.status === 401) {
    loginScreen.classList.remove('hidden');
    libraryScreen.classList.add('hidden');
    return;
  }

  const videos = await res.json();
  videoGrid.innerHTML = '';

  if (videos.length === 0) {
    emptyMsg.classList.remove('hidden');
    return;
  }

  emptyMsg.classList.add('hidden');

  for (const v of videos) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.innerHTML = `
      <div class="play-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <polygon points="5,3 19,12 5,21"/>
        </svg>
      </div>
      <div class="video-info">
        <div class="video-name">${escapeHtml(v.name)}</div>
        <div class="video-size">${formatSize(v.size)}</div>
      </div>
    `;
    card.addEventListener('click', () => playVideo(v.key, v.name));
    videoGrid.appendChild(card);
  }
}

function playVideo(key, name) {
  playerTitle.textContent = name;
  videoPlayer.src = `/api/stream/${encodeURIComponent(key)}`;
  playerModal.classList.remove('hidden');
  videoPlayer.play();
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// Check if already authenticated on load
(async () => {
  const res = await fetch('/api/videos');
  if (res.ok) {
    showLibrary();
  }
})();
