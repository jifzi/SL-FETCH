const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

/** @typedef {{ id: string, child: import('child_process').ChildProcessWithoutNullStreams, startedAt: number }} ActiveDownload */

/** @type {Map<string, ActiveDownload>} */
const activeDownloads = new Map();

function createWindow() {
  const win = new BrowserWindow({
    width: 1060,
    height: 720,
    minWidth: 920,
    minHeight: 640,
    backgroundColor: '#0b1220',
    title: 'SL fetch',
    icon: path.join(__dirname, '..', 'assets', 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.removeMenu();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function resolveYtDlpPath() {
  const exeName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';

  const devLocal = path.join(__dirname, '..', 'bin', exeName);

  // When packaged with --asar + unpacked bin directory.
  const packedUnpacked = path.join(process.resourcesPath, 'app.asar.unpacked', 'bin', exeName);

  if (fs.existsSync(packedUnpacked)) return packedUnpacked;
  if (fs.existsSync(devLocal)) return devLocal;

  // Fall back to PATH resolution.
  return exeName;
}

function resolveFfmpegPath() {
  const exeName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

  const devLocal = path.join(__dirname, '..', 'bin', exeName);
  const packedUnpacked = path.join(process.resourcesPath, 'app.asar.unpacked', 'bin', exeName);

  if (fs.existsSync(packedUnpacked)) return packedUnpacked;
  if (fs.existsSync(devLocal)) return devLocal;

  return exeName;
}

function newId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseProgressLine(line) {
  // Example:
  // [download]  12.3% of 4.58MiB at 1.23MiB/s ETA 00:03
  const percentMatch = line.match(/\s(\d{1,3}(?:\.\d+)?)%\s/);
  const speedMatch = line.match(/\sat\s+([^\s]+\/s)\s/i);
  const etaMatch = line.match(/\sETA\s+(\S+)\s*$/i);
  return {
    percent: percentMatch ? Number(percentMatch[1]) : null,
    speed: speedMatch ? speedMatch[1] : null,
    eta: etaMatch ? etaMatch[1] : null,
  };
}

ipcMain.handle('select-folder', async () => {
  const res = await dialog.showOpenDialog({
    title: 'Choose download folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  return res.filePaths[0];
});

ipcMain.handle('get-default-folder', async () => {
  return path.join(app.getPath('downloads'), 'SL fetch');
});

ipcMain.handle('reveal-in-folder', async (_evt, filePath) => {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) return false;
  shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle('cancel-download', async (_evt, id) => {
  const dl = activeDownloads.get(id);
  if (!dl) return false;
  try {
    dl.child.kill('SIGTERM');
  } catch {
    // ignore
  }
  return true;
});

ipcMain.handle('start-download', async (evt, payload) => {
  const sender = evt.sender;

  const url = typeof payload?.url === 'string' ? payload.url.trim() : '';
  const outDir = typeof payload?.outDir === 'string' ? payload.outDir.trim() : '';
  const mode = payload?.mode === 'audio' ? 'audio' : 'video';
  const container = typeof payload?.container === 'string' ? payload.container : 'mp4';
  const videoQuality = typeof payload?.videoQuality === 'string' ? payload.videoQuality : 'best';
  const audioQuality = typeof payload?.audioQuality === 'string' ? payload.audioQuality : 'best';
  const subtitles = Boolean(payload?.subtitles);
  const subsLang = typeof payload?.subsLang === 'string' ? payload.subsLang : 'en';

  if (!url) throw new Error('URL is required');
  if (!outDir) throw new Error('Output folder is required');

  fs.mkdirSync(outDir, { recursive: true });

  const id = newId();
  const ytDlp = resolveYtDlpPath();
  const ffmpeg = resolveFfmpegPath();

  const outputTemplate = path.join(outDir, '%(title).200s [%(id)s].%(ext)s');

  /** @type {string[]} */
  const args = [
    '--no-color',
    '--newline',
    '--progress',
    '--no-playlist',
  ];

  // Prefer bundled ffmpeg if present; otherwise yt-dlp falls back to PATH.
  if (ffmpeg && ffmpeg !== 'ffmpeg' && ffmpeg !== 'ffmpeg.exe') {
    args.push('--ffmpeg-location', path.dirname(ffmpeg));
  }

  args.push(
    '-o',
    outputTemplate,
  );

  if (mode === 'audio') {
    args.push(
      '-x',
      '--audio-format',
      container === 'mp3' ? 'mp3' : 'm4a',
      '--embed-metadata',
      '--embed-thumbnail'
    );

    // Optional audio quality tuning (maps to ffmpeg's quality scale).
    if (audioQuality === '320') {
      args.push('--audio-quality', '0'); // best
    } else if (audioQuality === '256') {
      args.push('--audio-quality', '1');
    } else if (audioQuality === '192') {
      args.push('--audio-quality', '2');
    } else if (audioQuality === '128') {
      args.push('--audio-quality', '4');
    }
  } else {
    // Video quality presets.
    if (videoQuality === 'max') {
      args.push('-f', 'bestvideo+bestaudio/best');
    } else if (['1080', '720', '480', '360'].includes(videoQuality)) {
      const h = videoQuality;
      args.push('-f', `bv*[height<=${h}]+ba/b[height<=${h}]/b`);
    } else {
      args.push('-f', 'best');
    }

    args.push('--merge-output-format', container === 'mkv' ? 'mkv' : 'mp4');

    // Subtitles: download and embed into the video file.
    if (subtitles) {
      args.push('--write-subs', '--embed-subs');
      if (subsLang === 'all') {
        args.push('--sub-langs', 'all');
      } else if (subsLang === 'en') {
        args.push('--sub-langs', 'en.*,en');
      }
    }
  }

  args.push(url);

  const child = spawn(ytDlp, args, { windowsHide: true });
  activeDownloads.set(id, { id, child, startedAt: Date.now() });

  sender.send('download-event', { id, type: 'started' });

  let lastPercent = null;
  let lastFile = null;

  const handleLine = (raw) => {
    const line = String(raw ?? '').trimEnd();
    if (!line) return;

    // Capture destination / file name hints.
    const destMatch =
      line.match(/^(\[download\]|\[ExtractAudio\])\s+Destination:\s+(.*)$/i) ||
      line.match(/^(\[Merger\])\s+Merging formats into\s+\"(.*)\"$/i);
    if (destMatch) {
      const candidate = destMatch[2] || destMatch[1];
      if (candidate && typeof candidate === 'string') lastFile = candidate.replace(/^\"|\"$/g, '');
    }

    if (line.startsWith('[download]')) {
      const { percent, speed, eta } = parseProgressLine(line);
      if (percent != null) {
        lastPercent = percent;
        sender.send('download-event', {
          id,
          type: 'progress',
          percent,
          speed,
          eta,
          line,
        });
        return;
      }
    }

    sender.send('download-event', { id, type: 'log', line });
  };

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  child.stdout.on('data', (chunk) => {
    for (const line of String(chunk).split(/\r?\n/)) handleLine(line);
  });
  child.stderr.on('data', (chunk) => {
    for (const line of String(chunk).split(/\r?\n/)) handleLine(line);
  });

  child.on('error', (err) => {
    sender.send('download-event', { id, type: 'error', message: String(err?.message ?? err) });
  });

  child.on('close', (code, signal) => {
    activeDownloads.delete(id);
    const ok = code === 0;
    sender.send('download-event', {
      id,
      type: ok ? 'completed' : 'failed',
      exitCode: code,
      signal,
      percent: lastPercent,
      filePath: lastFile,
    });
  });

  return { id };
});

