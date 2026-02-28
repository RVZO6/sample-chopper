# Sample Chopper Pro

A web-based audio sample chopper with real-time pitch and time manipulation.

## Features

- 🎹 **20 Pad Grid** - Trigger samples with keyboard or mouse
- 🎛️ **Real-time Effects** - Independent pitch shift, time stretch, reverse
- 🎚️ **ADSR Envelope** - Attack and release controls
- 🎵 **Global Key Control** - Transpose entire project on the fly
- 🌊 **Waveform Display** - Interactive waveform with zoom and seek

## Tech Stack

- **React 19** with TypeScript
- **Vite 7** for blazing-fast builds
- **Tailwind CSS v4** for styling
- **Rubberband WASM** for high-quality audio stretching
- **Web Audio API** with AudioWorklets

## Getting Started

Install dependencies:
```bash
bun install
```

Run development server:
```bash
bun run dev
```

Build for production:
```bash
bun run build
```

## Usage

1. Click the upload button to load an audio file
2. Click on the waveform to set cue points for each pad
3. Trigger pads with keyboard (Q-P, A-;, Z-/) or click them
4. Adjust pitch, time, and envelope for each pad
5. Use global key control to transpose everything

## YouTube Import Pipeline

- Uses a local server endpoint (`/api/youtube/audio`) backed by `youtubei.js`
- Resolves direct audio stream URLs from YouTube (no Piped/Invidious/public proxy dependency)
- Caches resolved stream metadata server-side for fast repeat lookups
- Caches downloaded audio blobs in-browser for instant re-imports

Optional environment variable:

```bash
YOUTUBE_COOKIE=...
```

`YOUTUBE_COOKIE` can help with videos that need additional session context.
