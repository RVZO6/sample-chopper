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
pnpm install
```

Run development server:
```bash
pnpm dev
```

Build for production:
```bash
pnpm build
```

## Usage

1. Click the upload button to load an audio file
2. Click on the waveform to set cue points for each pad
3. Trigger pads with keyboard (Q-P, A-;, Z-/) or click them
4. Adjust pitch, time, and envelope for each pad
5. Use global key control to transpose everything
