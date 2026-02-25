## SL fetch

Desktop video/audio downloader UI for **yt-dlp**, inspired by the Android app **Seal** (but built as a separate desktop app).

### Features (current)

- Paste URL → fetch video or audio
- Choose output folder
- Basic quality presets + container choice
- Downloads list with progress, cancel, and “Show in folder”

### How to make it “just work” for normal users

For people who download **SL fetch** from you, the goal is:

- They download a ZIP / installer
- They open **SL fetch**
- It downloads videos right away — **no extra tools to install**

To get that:

1. Download the **Windows 64‑bit `yt-dlp.exe`** from the official release page  
   (`https://github.com/yt-dlp/yt-dlp/releases/latest`)
2. (Recommended) Download **Windows ffmpeg build** (e.g. from `https://www.gyan.dev/ffmpeg/builds/`) and take the `ffmpeg.exe` file.
3. Put both files into this folder in the project before packaging:

   - `bin/yt-dlp.exe`
   - `bin/ffmpeg.exe`

When you run `npm run pack:win`, those binaries are bundled. For your users:

- They do **not** need Node, yt-dlp, or ffmpeg.
- They just run the built **SL fetch** app and it works.

### Requirements for you (the developer)

- **Node.js** (installed on your machine)
- **yt-dlp.exe** and **ffmpeg.exe** placed in `bin/` (see above) before you package.

### Run (dev) on your machine

```bash
cd sl-fetch
npm install
npm run dev
```

### Package for Windows

```bash
npm run pack:win
```

Your packaged app will appear in `dist/`.

Because `bin/` is kept outside the ASAR bundle, any `yt-dlp.exe` and `ffmpeg.exe` you put there will be shipped with the app so that **normal users don’t have to install anything extra**.

### Credits

- Inspired by: Seal (`https://github.com/JunkFood02/Seal`)
- Download engine: yt-dlp

