# Essentia.js + Vite Integration Guide

This document outlines the critical steps, pitfalls, and solutions for successfully integrating `essentia.js` into a modern Vite-based web application.

## 1. The "Magic Numbers" Problem (Parameters)

**The Issue:**
The most critical failure point was inaccurate BPM and Key detection. This happened because `essentia.js` functions like [KeyExtractor](file:///Users/ryan/.gemini/antigravity/playground/binary-feynman/analyze-this/src/engine/worker.js#257-340) and `PercivalBpmEstimator` often require **all** optional parameters to be passed explicitly to work correctly, rather than relying on defaults.

**The Solution:**
You must pass the exact parameter set expected by the algorithms. These are often undocumented "magic numbers" found in working examples.

**Code Example (Correct Usage):**
```javascript
// Key Detection (15 parameters!)
const keyData = essentia.KeyExtractor(
    signal,
    true,      // averageDetuningCorrection
    4096,      // frameSize
    4096,      // hopSize
    12,        // hpcpSize
    3500,      // maxFrequency
    60,        // minFrequency
    25,        // spectralPeaksMax
    0.2,       // spectralPeaksWeight
    'bgate',   // tuningFrequency
    16000,     // sampleRate
    0.0001,    // spectralPeaksMinMag
    440,       // referenceFrequency
    'cosine',  // profileType
    'hann'     // windowType
);

// BPM Detection (8 parameters!)
const bpmData = essentia.PercivalBpmEstimator(
    signal,
    1024,    // frameSize
    2048,    // hopSize
    128,     // frameSizeOSS
    128,     // hopSizeOSS
    210,     // maxBPM
    50,      // minBPM
    16000    // sampleRate
);
```

> **Note:** These parameters are NOT documented in the code comments of the official demo. They must be replicated exactly.

## 2. Web Worker Integration with Vite

**The Issue:**
Essentia.js relies on `importScripts` to load its WASM and core JS files.
- Vite's default worker import (`import Worker from './worker?worker'`) creates an **ES Module Worker**.
- **ES Module Workers do NOT support `importScripts`.**

**The Solution:**
You must explicitly create a **Classic Worker** using the `new URL()` pattern.

**Correct Implementation:**
```javascript
// main.js
// Use new URL() with import.meta.url to let Vite handle the path resolution
// This allows the worker to be "classic" and use importScripts
const worker = new Worker(new URL('./analysis.worker.js', import.meta.url));
```

**Worker File ([analysis.worker.js](file:///Users/ryan/.gemini/antigravity/playground/binary-feynman/essentia-mood-demo/src/analysis.worker.js)):**
```javascript
// Now importScripts works!
if (typeof document === 'undefined') {
    // Stub document for Essentia WASM to find its binary
    self.document = { currentScript: { src: '/essentia/essentia-wasm.web.js' } };
}
importScripts('/essentia/essentia-wasm.web.js', '/essentia/essentia.js-core.js');
```

## 3. Serving WASM Files

**The Issue:**
Essentia.js WASM binaries cannot be bundled directly by Vite/Webpack in the standard way. They need to be fetched at runtime.

**The Solution:**
1.  **Copy Files:** Manually copy [essentia-wasm.web.js](file:///Users/ryan/.gemini/antigravity/playground/binary-feynman/analyze-this/public/essentia/essentia-wasm.web.js), [essentia-wasm.web.wasm](file:///Users/ryan/.gemini/antigravity/playground/binary-feynman/analyze-this/public/essentia/essentia-wasm.web.wasm), and [essentia.js-core.js](file:///Users/ryan/.gemini/antigravity/playground/binary-feynman/analyze-this/public/essentia/essentia.js-core.js) from `node_modules/essentia.js/dist/` to your project's `public/essentia/` directory.
2.  **Load from Public:** Configure the worker to load these files from the public path.

## 4. Audio Preprocessing

**The Issue:**
Essentia.js algorithms are tuned for specific audio formats, typically **16kHz Mono**. Passing 44.1kHz or 48kHz stereo audio will result in garbage data or crashes.

**The Solution:**
Always preprocess audio in the main thread before sending it to the worker.

```javascript
// 1. Decode Audio
const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

// 2. Mix to Mono
const monoData = audioBuffer.getChannelData(0); // Simplified mono mix

// 3. Downsample to 16kHz
const offlineCtx = new OfflineAudioContext(1, audioBuffer.duration * 16000, 16000);
const source = offlineCtx.createBufferSource();
source.buffer = audioBuffer;
source.connect(offlineCtx.destination);
source.start();
const resampledBuffer = await offlineCtx.startRendering();
const resampledData = resampledBuffer.getChannelData(0);

// 4. Send to Worker
worker.postMessage({ 
    type: 'ANALYZE', 
    payload: { 
        pcm: resampledData, 
        sampleRate: 16000 
    } 
});
```

## Summary Checklist

- [ ] **Files:** Copy Essentia JS/WASM files to `public/`
- [ ] **Worker:** Use `new Worker(new URL(...))` for Classic Worker support
- [ ] **Imports:** Use `importScripts` in the worker
- [ ] **Audio:** Downsample to 16kHz Mono
- [ ] **Parameters:** Use the EXACT parameter lists shown above (no defaults!)
