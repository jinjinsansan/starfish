const $ = (id) => document.getElementById(id);

// DOM references
const loginScreen = $('login-screen');
const libraryScreen = $('library-screen');
const playerModal = $('player-modal');
const uploadModal = $('upload-modal');
const confirmDialog = $('confirm-dialog');
const loginForm = $('login-form');
const loginError = $('login-error');
const videoGrid = $('video-grid');
const emptyMsg = $('empty-msg');
const videoPlayer = $('video-player');
const playerTitle = $('player-title');
const searchInput = $('search-input');
const sortSelect = $('sort-select');
const breadcrumb = $('breadcrumb');
const dropZone = $('drop-zone');
const fileInput = $('file-input');
const uploadList = $('upload-list');

// State
let currentPrefix = '';
let allVideos = [];
let allFolders = [];
let currentPlayingKey = null;

const CHUNK_SIZE = 100 * 1024 * 1024; // 100MB chunks (direct to R2, no Vercel limit)

// --- CSRF ---
function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrf=([^;]*)/);
  return match ? match[1] : '';
}

function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes((options.method || 'GET').toUpperCase())) {
    headers['X-CSRF-Token'] = getCsrfToken();
  }
  return fetch(url, { ...options, headers });
}

// --- Auth ---
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
  await apiFetch('/api/auth', { method: 'DELETE' });
  videoPlayer.pause();
  videoPlayer.removeAttribute('src');
  libraryScreen.classList.add('hidden');
  playerModal.classList.add('hidden');
  uploadModal.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  $('password').value = '';
});

// --- Library ---
async function showLibrary() {
  loginScreen.classList.add('hidden');
  libraryScreen.classList.remove('hidden');
  await loadVideos();
}

async function loadVideos() {
  const res = await fetch(`/api/videos?prefix=${encodeURIComponent(currentPrefix)}`);
  if (res.status === 401) {
    loginScreen.classList.remove('hidden');
    libraryScreen.classList.add('hidden');
    return;
  }

  const data = await res.json();
  allFolders = data.folders || [];
  allVideos = data.videos || [];
  renderLibrary();
}

function renderLibrary() {
  const search = searchInput.value.toLowerCase().trim();
  const sortKey = sortSelect.value;

  let folders = allFolders;
  let videos = [...allVideos];

  // Search filter
  if (search) {
    folders = folders.filter((f) => f.name.toLowerCase().includes(search));
    videos = videos.filter((v) => v.name.toLowerCase().includes(search));
  }

  // Sort videos
  videos.sort((a, b) => {
    switch (sortKey) {
      case 'date-desc': return new Date(b.uploaded) - new Date(a.uploaded);
      case 'date-asc': return new Date(a.uploaded) - new Date(b.uploaded);
      case 'name-asc': return a.name.localeCompare(b.name);
      case 'name-desc': return b.name.localeCompare(a.name);
      case 'size-desc': return b.size - a.size;
      case 'size-asc': return a.size - b.size;
      default: return 0;
    }
  });

  videoGrid.innerHTML = '';

  if (folders.length === 0 && videos.length === 0) {
    emptyMsg.classList.remove('hidden');
    return;
  }
  emptyMsg.classList.add('hidden');

  // Render folders
  for (const f of folders) {
    const card = document.createElement('div');
    card.className = 'folder-card';
    card.innerHTML = `
      <div class="folder-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
        </svg>
      </div>
      <div class="folder-name">${escapeHtml(f.name)}</div>
    `;
    card.addEventListener('click', () => navigateToFolder(f.prefix));
    videoGrid.appendChild(card);
  }

  // Render videos
  for (const v of videos) {
    const card = document.createElement('div');
    card.className = 'video-card';
    const thumbUrl = `/api/thumbnail/${encodeURIComponent(v.key)}`;
    card.innerHTML = `
      <div class="card-thumb">
        <img src="${thumbUrl}" alt="" loading="lazy" onerror="this.style.display='none'" />
        <div class="play-overlay">
          <div class="play-circle">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="video-info">
          <div class="video-name" title="${escapeHtml(v.name)}">${escapeHtml(v.name)}</div>
          <div class="video-meta">${formatSize(v.size)} &middot; ${formatDate(v.uploaded)}</div>
        </div>
        <button class="delete-btn" title="Delete" data-key="${escapeHtml(v.key)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
        </button>
      </div>
    `;
    card.querySelector('.card-thumb').addEventListener('click', () => playVideo(v.key, v.name));
    card.querySelector('.video-info').addEventListener('click', () => playVideo(v.key, v.name));
    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      confirmDelete(v.key, v.name);
    });
    videoGrid.appendChild(card);
  }
}

// --- Breadcrumb / Folders ---
function navigateToFolder(prefix) {
  currentPrefix = prefix;
  updateBreadcrumb();
  loadVideos();
}

function updateBreadcrumb() {
  breadcrumb.innerHTML = '';
  const parts = currentPrefix.split('/').filter(Boolean);

  const homeSpan = document.createElement('span');
  homeSpan.className = 'breadcrumb-item' + (parts.length === 0 ? ' active' : '');
  homeSpan.textContent = 'Home';
  homeSpan.addEventListener('click', () => navigateToFolder(''));
  breadcrumb.appendChild(homeSpan);

  let accumulated = '';
  for (let i = 0; i < parts.length; i++) {
    accumulated += parts[i] + '/';
    const sep = document.createElement('span');
    sep.className = 'breadcrumb-sep';
    sep.textContent = '/';
    breadcrumb.appendChild(sep);

    const span = document.createElement('span');
    span.className = 'breadcrumb-item' + (i === parts.length - 1 ? ' active' : '');
    span.textContent = parts[i];
    const prefix = accumulated;
    span.addEventListener('click', () => navigateToFolder(prefix));
    breadcrumb.appendChild(span);
  }
}

$('new-folder-btn').addEventListener('click', () => {
  const name = prompt('Folder name:');
  if (!name || !name.trim()) return;
  const clean = name.trim().replace(/[/\\]/g, '');
  if (!clean) return;
  navigateToFolder(currentPrefix + clean + '/');
});

// --- Search & Sort ---
searchInput.addEventListener('input', renderLibrary);
sortSelect.addEventListener('change', renderLibrary);

// --- Delete ---
let pendingDeleteKey = null;

function confirmDelete(key, name) {
  pendingDeleteKey = key;
  $('confirm-msg').textContent = `Delete "${name}"?`;
  confirmDialog.classList.remove('hidden');
}

$('confirm-cancel').addEventListener('click', () => {
  pendingDeleteKey = null;
  confirmDialog.classList.add('hidden');
});

$('confirm-ok').addEventListener('click', async () => {
  if (!pendingDeleteKey) return;
  const key = pendingDeleteKey;
  pendingDeleteKey = null;
  confirmDialog.classList.add('hidden');

  await apiFetch('/api/videos', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });

  localStorage.removeItem('playback:' + key);
  await loadVideos();
});

// --- Upload (Presigned URLs → direct to R2) ---
$('upload-btn').addEventListener('click', () => {
  uploadModal.classList.remove('hidden');
});

$('close-upload').addEventListener('click', () => {
  uploadModal.classList.add('hidden');
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', () => {
  handleFiles(fileInput.files);
  fileInput.value = '';
});

function handleFiles(files) {
  for (const file of files) {
    uploadFile(file);
  }
}

async function uploadFile(file) {
  const key = currentPrefix + file.name;
  const totalParts = Math.ceil(file.size / CHUNK_SIZE);
  const ext = file.name.split('.').pop().toLowerCase();
  const contentTypes = {
    mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska',
    mov: 'video/quicktime', avi: 'video/x-msvideo', m4v: 'video/x-m4v', ogv: 'video/ogg',
  };

  // Create UI
  const item = document.createElement('div');
  item.className = 'upload-item';
  item.innerHTML = `
    <div class="upload-item-header">
      <span class="upload-item-name">${escapeHtml(file.name)}</span>
      <span class="upload-item-status">Preparing...</span>
    </div>
    <div class="progress-bar"><div class="progress-fill"></div></div>
  `;
  uploadList.prepend(item);
  const statusEl = item.querySelector('.upload-item-status');
  const fillEl = item.querySelector('.progress-fill');

  try {
    // 1. Get presigned URLs from our API
    const initRes = await apiFetch('/api/upload/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        totalParts,
        contentType: contentTypes[ext] || 'application/octet-stream',
      }),
    });
    if (!initRes.ok) throw new Error('Failed to initiate upload');
    const { uploadId, presignedUrls } = await initRes.json();

    // 2. Upload each part directly to R2 via presigned URLs
    const parts = [];
    let uploadedBytes = 0;

    for (let i = 0; i < totalParts; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const partRes = await fetch(presignedUrls[i], {
        method: 'PUT',
        body: chunk,
      });

      if (!partRes.ok) throw new Error(`Failed to upload part ${i + 1}`);

      const etag = partRes.headers.get('ETag');
      parts.push({ partNumber: i + 1, etag });

      uploadedBytes += (end - start);
      const pct = Math.round((uploadedBytes / file.size) * 100);
      statusEl.textContent = `${pct}%`;
      fillEl.style.width = `${pct}%`;
    }

    // 3. Complete multipart upload
    const completeRes = await apiFetch('/api/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, uploadId, parts }),
    });
    if (!completeRes.ok) throw new Error('Failed to complete upload');

    statusEl.textContent = 'Done';
    statusEl.className = 'upload-item-status done';
    fillEl.classList.add('done');

    // Generate thumbnail
    generateThumbnail(file, key);

    await loadVideos();

  } catch (err) {
    statusEl.textContent = 'Error';
    statusEl.className = 'upload-item-status error';
    console.error('Upload failed:', err);
  }
}

async function generateThumbnail(file, key) {
  try {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    await new Promise((resolve, reject) => {
      video.onloadeddata = resolve;
      video.onerror = reject;
      video.src = url;
    });

    const seekTo = Math.min(2, video.duration * 0.1);
    video.currentTime = seekTo;

    await new Promise((resolve) => {
      video.onseeked = resolve;
    });

    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = Math.round(320 * (video.videoHeight / video.videoWidth)) || 180;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    URL.revokeObjectURL(url);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
    if (!blob) return;

    // Get presigned PUT URL for thumbnail
    const presignRes = await apiFetch(`/api/thumbnail/${encodeURIComponent(key)}`, {
      method: 'POST',
    });
    if (!presignRes.ok) return;
    const { url: putUrl } = await presignRes.json();

    // Upload thumbnail directly to R2
    await fetch(putUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': 'image/jpeg' },
    });
  } catch {
    // Thumbnail generation is best-effort
  }
}

// --- Player (presigned URL from API) ---
async function playVideo(key, name) {
  currentPlayingKey = key;
  playerTitle.textContent = name;
  playerModal.classList.remove('hidden');

  // Get presigned stream URL
  const res = await apiFetch(`/api/stream/${encodeURIComponent(key)}`);
  if (!res.ok) return;
  const { url } = await res.json();

  videoPlayer.src = url;

  // Resume from saved position
  const saved = localStorage.getItem('playback:' + key);
  if (saved) {
    const pos = parseFloat(saved);
    videoPlayer.addEventListener('loadedmetadata', function onMeta() {
      videoPlayer.removeEventListener('loadedmetadata', onMeta);
      if (pos > 0 && pos < videoPlayer.duration - 5) {
        videoPlayer.currentTime = pos;
      }
    });
  }

  videoPlayer.play();
}

// Save playback position periodically
videoPlayer.addEventListener('timeupdate', () => {
  if (currentPlayingKey && videoPlayer.currentTime > 0) {
    localStorage.setItem('playback:' + currentPlayingKey, videoPlayer.currentTime.toString());
  }
});

videoPlayer.addEventListener('ended', () => {
  if (currentPlayingKey) {
    localStorage.removeItem('playback:' + currentPlayingKey);
  }
});

function closePlayer() {
  videoPlayer.pause();
  videoPlayer.removeAttribute('src');
  playerModal.classList.add('hidden');
  currentPlayingKey = null;
}

$('close-player').addEventListener('click', closePlayer);

// Keyboard: Escape to close modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!playerModal.classList.contains('hidden')) {
      closePlayer();
    } else if (!uploadModal.classList.contains('hidden')) {
      uploadModal.classList.add('hidden');
    } else if (!confirmDialog.classList.contains('hidden')) {
      $('confirm-cancel').click();
    }
  }
});

// --- Utilities ---
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// --- Init ---
(async () => {
  const res = await fetch('/api/videos');
  if (res.ok) {
    showLibrary();
  }
})();
