const $ = (id) => document.getElementById(id);

const urlEl = $('url');
const outDirEl = $('outDir');
const pickFolderEl = $('pickFolder');
const modeEl = $('mode');
const qualityEl = $('quality');
const containerEl = $('container');
const audioQualityEl = $('audioQuality');
const subsEnabledEl = $('subsEnabled');
const subsLangEl = $('subsLang');
const startEl = $('start');
const downloadsEl = $('downloads');
const errorEl = $('error');

/** @type {Map<string, {root: HTMLElement, bar: HTMLDivElement, meta: HTMLElement, status: HTMLElement, revealBtn: HTMLButtonElement, cancelBtn: HTMLButtonElement}>} */
const rows = new Map();

function showError(msg) {
  if (!msg) {
    errorEl.hidden = true;
    errorEl.textContent = '';
    return;
  }
  errorEl.hidden = false;
  errorEl.textContent = msg;
}

function setEmptyState() {
  if (rows.size === 0) {
    downloadsEl.classList.add('empty');
    downloadsEl.innerHTML = `
      <div class="emptyState">
        <div class="emptyTitle">No downloads yet</div>
        <div class="emptySub">Paste a link above and hit Fetch.</div>
      </div>`;
  } else {
    downloadsEl.classList.remove('empty');
  }
}

function clampPercent(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function niceUrlLabel(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const host = u.host.replace(/^www\./, '');
    return `${host}${u.pathname.length > 1 ? u.pathname : ''}`;
  } catch {
    return rawUrl;
  }
}

function createDownloadRow({ id, url, mode, videoQuality, audioQuality, container, subtitles }) {
  const root = document.createElement('div');
  root.className = 'dl';
  root.dataset.id = id;

  const title = niceUrlLabel(url);
  const qLabel = mode === 'video' ? `VQ ${videoQuality}` : `AQ ${audioQuality}`;
  const subsLabel = subtitles ? 'Subs on' : 'Subs off';

  root.innerHTML = `
    <div class="dlTop">
      <div style="min-width:0">
        <div class="dlTitle">${escapeHtml(title)}</div>
        <div class="dlMeta">
          <span class="pill">${escapeHtml(mode)}</span>
          <span class="pill">${escapeHtml(qLabel)}</span>
          <span class="pill">${escapeHtml(container)}</span>
          <span class="pill">${escapeHtml(subsLabel)}</span>
          <span class="pill" data-role="status">starting…</span>
        </div>
      </div>
      <div class="dlActions">
        <button class="miniBtn" data-role="reveal" type="button" disabled>Show</button>
        <button class="miniBtn danger" data-role="cancel" type="button">Cancel</button>
      </div>
    </div>
    <div class="bar"><div data-role="bar"></div></div>
  `;

  const bar = /** @type {HTMLDivElement} */ (root.querySelector('[data-role="bar"]'));
  const status = /** @type {HTMLElement} */ (root.querySelector('[data-role="status"]'));
  const revealBtn = /** @type {HTMLButtonElement} */ (root.querySelector('[data-role="reveal"]'));
  const cancelBtn = /** @type {HTMLButtonElement} */ (root.querySelector('[data-role="cancel"]'));
  const meta = /** @type {HTMLElement} */ (root.querySelector('.dlMeta'));

  revealBtn.addEventListener('click', async () => {
    const filePath = root.dataset.filePath || '';
    if (!filePath) return;
    await window.slfetch.revealInFolder(filePath);
  });

  cancelBtn.addEventListener('click', async () => {
    cancelBtn.disabled = true;
    await window.slfetch.cancelDownload(id);
    status.textContent = 'cancelling…';
  });

  rows.set(id, { root, bar, meta, status, revealBtn, cancelBtn });
  downloadsEl.prepend(root);
  setEmptyState();
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setStatusPill(el, kind) {
  el.classList.remove('ok', 'bad');
  if (kind === 'ok') el.classList.add('ok');
  if (kind === 'bad') el.classList.add('bad');
}

function updateRow(id, patch) {
  const row = rows.get(id);
  if (!row) return;

  if (patch.percent != null) {
    const p = clampPercent(patch.percent);
    row.bar.style.width = `${p}%`;
  }
  if (patch.statusText) row.status.textContent = patch.statusText;
  if (patch.statusKind) setStatusPill(row.status, patch.statusKind);
  if (patch.filePath) {
    row.root.dataset.filePath = patch.filePath;
    row.revealBtn.disabled = false;
  }
  if (patch.done) {
    row.cancelBtn.disabled = true;
  }
}

async function init() {
  setEmptyState();

  const defaultDir = await window.slfetch.getDefaultFolder();
  outDirEl.value = defaultDir || '';

  pickFolderEl.addEventListener('click', async () => {
    showError('');
    const selected = await window.slfetch.selectFolder();
    if (selected) outDirEl.value = selected;
  });

  modeEl.addEventListener('change', () => {
    // Nudge container if user picks audio mode.
    if (modeEl.value === 'audio' && containerEl.value === 'mkv') containerEl.value = 'mp3';
    // When in audio mode, audio quality is more relevant than video quality.
  });

  startEl.addEventListener('click', async () => {
    showError('');
    const url = urlEl.value.trim();
    const outDir = outDirEl.value.trim();
    const mode = modeEl.value;
    const videoQuality = qualityEl.value;
    const container = containerEl.value;
    const audioQuality = audioQualityEl.value;
    const subtitles = subsEnabledEl.checked;
    const subsLang = subsLangEl.value;

    if (!url) return showError('Paste a URL first.');
    if (!outDir) return showError('Choose an output folder.');

    startEl.disabled = true;
    try {
      const { id } = await window.slfetch.startDownload({
        url,
        outDir,
        mode,
        videoQuality,
        audioQuality,
        container,
        subtitles,
        subsLang,
      });
      createDownloadRow({ id, url, mode, videoQuality, audioQuality, container, subtitles });
      urlEl.value = '';
    } catch (e) {
      showError(String(e?.message ?? e));
    } finally {
      startEl.disabled = false;
    }
  });

  window.slfetch.onDownloadEvent((evt) => {
    if (!evt?.id) return;

    if (evt.type === 'started') {
      updateRow(evt.id, { statusText: 'running…' });
      return;
    }

    if (evt.type === 'progress') {
      const bits = [];
      if (evt.speed) bits.push(evt.speed);
      if (evt.eta) bits.push(`ETA ${evt.eta}`);
      updateRow(evt.id, {
        percent: evt.percent,
        statusText: bits.length ? bits.join(' · ') : 'downloading…',
      });
      return;
    }

    if (evt.type === 'completed') {
      updateRow(evt.id, { percent: 100, statusText: 'done', statusKind: 'ok', filePath: evt.filePath, done: true });
      return;
    }

    if (evt.type === 'failed') {
      updateRow(evt.id, { statusText: 'failed', statusKind: 'bad', filePath: evt.filePath, done: true });
      return;
    }

    if (evt.type === 'error') {
      updateRow(evt.id, { statusText: evt.message || 'error', statusKind: 'bad' });
      return;
    }
  });
}

init().catch((e) => showError(String(e?.message ?? e)));

