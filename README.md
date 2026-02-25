## SL fetch 🦭

Sea‑lion–themed video & audio downloader for Windows, inspired by the Android app [Seal](https://github.com/JunkFood02/Seal) but built as a desktop app.  
SL fetch is a clean UI on top of `yt-dlp` (and `ffmpeg`) with quality controls and subtitle support.

### Features

- Paste a URL → download **video or audio**
- Pick output folder
- **Video quality controls**: Best, or “up to” 1080p / 720p / 480p / 360p / Max
- **Audio quality controls**: Best, 320 / 256 / 192 / 128 kbps (audio mode)
- **Subtitles**: optional download + embed (English or all languages)
- Modern, Seal‑inspired UI with a downloads list, progress, cancel, and “Show in folder”

### Download (recommended)

Grab the latest Windows build from **Releases** (portable `.zip` folder).
unzip the folder, and open the sl-fetch.exe app to use!

Release builds are intended to include the required binaries so the app works immediately after download.

### Build from source

Requirements:

- Node.js

Install:

```bash
git clone https://github.com/jifzi/SL-FETCH.git
cd SL-FETCH
npm install
```

Run (dev):

```bash
npm run dev
```

### Packaging a Windows build

To create a Windows build that works out-of-the-box, place these files in `bin/` **before** packaging:

- `bin/yt-dlp.exe` (from `https://github.com/yt-dlp/yt-dlp/releases/latest`)
- `bin/ffmpeg.exe` (from an ffmpeg Windows build, e.g. `https://www.gyan.dev/ffmpeg/builds/`)

Then run:

```bash
npm run pack:win
```

Output (typical):

- `dist/SL fetch-win32-x64/SL fetch.exe`

### Notes

- Not affiliated with Seal; it’s only inspired by its design and idea.
- Respect the terms of service and copyright rules of any site downloaded from.

### Credits

- UI inspiration: [Seal](https://github.com/JunkFood02/Seal)
- Download engine: [yt-dlp](https://github.com/yt-dlp/yt-dlp)

