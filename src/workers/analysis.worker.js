// Essentia.js Analysis Worker

// Stub document for Essentia WASM to find its binary
if (typeof document === 'undefined') {
    self.document = { currentScript: { src: '/essentia/essentia-wasm.web.js' } };
}

// Load Essentia
importScripts('/essentia/essentia-wasm.web.js', '/essentia/essentia.js-core.js');

let essentia = null;

// Initialize Essentia
EssentiaWASM().then((wasmModule) => {
    essentia = new Essentia(wasmModule);
    console.log('Essentia initialized in worker');
    self.postMessage({ type: 'READY' });
});

self.onmessage = function (e) {
    const { type, payload } = e.data;

    if (type === 'ANALYZE') {
        if (!essentia) {
            console.error('Essentia not ready');
            return;
        }

        try {
            const { pcm, sampleRate } = payload;

            // Convert Float32Array to Essentia Vector
            const signal = essentia.arrayToVector(pcm);

            // 1. Key Detection
            // Parameters from integration guide (EXACTLY as specified)
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

            // 2. BPM Detection
            // Parameters from integration guide (EXACTLY as specified)
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

            // Clean up vector to free memory
            signal.delete();

            self.postMessage({
                type: 'RESULT',
                payload: {
                    key: keyData.key,
                    scale: keyData.scale,
                    bpm: bpmData.bpm
                }
            });

        } catch (error) {
            console.error('Analysis error:', error);
            self.postMessage({ type: 'ERROR', payload: error.message });
        }
    }
};
