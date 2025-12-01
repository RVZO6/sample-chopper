/* global self */

// Message types
const MSG = {
    INIT: 'INIT',
    READY: 'READY',
    ANALYZE: 'ANALYZE',
    RESULT: 'RESULT',
    ERROR: 'ERROR'
};

// Stub document for Essentia WASM
if (typeof document === 'undefined') {
    self.document = { currentScript: { src: '/essentia/essentia-wasm.web.js' } };
}

// Load Essentia files from public directory
try {
    self.importScripts('/essentia/essentia-wasm.web.js', '/essentia/essentia.js-core.js');
} catch (e) {
    console.error('Failed to load Essentia scripts:', e);
}

let essentia = null;

async function initEssentia() {
    if (typeof self.EssentiaWASM !== 'function') {
        throw new Error('EssentiaWASM not found. Check that /public/essentia files are loaded.');
    }
    if (typeof self.Essentia === 'undefined') {
        throw new Error('Essentia core not found.');
    }

    const Module = await self.EssentiaWASM({
        locateFile: (path) => `/essentia/${path}`
    });

    const Ess = self.Essentia;
    essentia = new Ess(Module);

    if (typeof essentia.KeyExtractor !== 'function') {
        throw new Error('KeyExtractor not found in Essentia build.');
    }
}

function analyzeAudio(pcm, sampleRate) {
    const signal = essentia.arrayToVector(pcm);

    // Extract key - using exact parameters from working mood-classifiers demo
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

    const key = keyData.key || 'C';
    const mode = keyData.scale || 'major';
    const keyConfidence = keyData.strength || 0;

    // BPM detection - using exact parameters from working mood-classifiers demo
    let bpm = 0;
    let bpmConfidence = 0;

    try {
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
        bpm = bpmData.bpm || 0;
        bpmConfidence = 0.8;
    } catch (error) {
        console.warn('PercivalBpmEstimator failed:', error);
        bpm = 0;
        bpmConfidence = 0;
    }

    return {
        key,
        mode,
        keyConfidence,
        bpm,
        bpmConfidence
    };
}

// Worker message handler
self.onmessage = async (evt) => {
    const msg = evt.data;

    try {
        if (msg.type === MSG.INIT) {
            try {
                await initEssentia();
                self.postMessage({ type: MSG.READY });
            } catch (err) {
                self.postMessage({
                    type: MSG.ERROR,
                    error: String(err && err.message || err)
                });
            }
            return;
        }

        if (msg.type === MSG.ANALYZE) {
            if (!essentia) {
                throw new Error('Essentia not initialized');
            }

            const { sampleRate, pcm } = msg.payload;

            try {
                const result = analyzeAudio(pcm, sampleRate);
                self.postMessage({ type: MSG.RESULT, payload: result });
            } catch (error) {
                self.postMessage({
                    type: MSG.ERROR,
                    error: 'Analysis failed: ' + String(error && error.message || error)
                });
            }
            return;
        }
    } catch (err) {
        self.postMessage({
            type: MSG.ERROR,
            error: String(err && err.message || err)
        });
    }
};
