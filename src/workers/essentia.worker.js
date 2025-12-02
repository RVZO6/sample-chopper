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
            self.postMessage({ type: 'ERROR', payload: 'Essentia not initialized' });
            return;
        }

        try {
            const { pcm, originalSampleRate } = payload;
            console.log('[Worker] Received PCM data, samples:', pcm.length, 'Rate:', originalSampleRate);

            // Convert Float32Array to Essentia Vector
            console.log('[Worker] Converting to vector...');
            let signal;

            if (originalSampleRate !== 16000) {
                console.log('[Worker] Resampling to 16kHz using JS linear interpolation...');
                // Use custom JS resampler to avoid WASM memory/exception issues
                const resampledPcm = resampleLinear(pcm, originalSampleRate, 16000);

                // Convert to vector
                signal = essentia.arrayToVector(resampledPcm);
                console.log('[Worker] Resampling complete, new length:', resampledPcm.length);
            } else {
                signal = essentia.arrayToVector(pcm);
            }

            // 1. Key Detection
            // Parameters from integration guide (EXACTLY as specified)
            console.log('[Worker] Running KeyExtractor...');
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
                16000,     // sampleRate (now 16k)
                0.0001,    // spectralPeaksMinMag
                440,       // referenceFrequency
                'cosine',  // profileType
                'hann'     // windowType
            );

            // 2. BPM Detection
            // Parameters from integration guide (EXACTLY as specified)
            console.log('[Worker] Running PercivalBpmEstimator...');
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

            console.log('[Worker] Analysis complete!');
            self.postMessage({
                type: 'RESULT',
                payload: {
                    key: keyData.key,
                    scale: keyData.scale,
                    bpm: bpmData.bpm
                }
            });

        } catch (error) {
            console.error('[Worker] Analysis error:', error);
            self.postMessage({ type: 'ERROR', payload: error.message });
        }
    }
};

// Simple Linear Interpolation Resampler
function resampleLinear(buffer, sampleRate, targetSampleRate) {
    if (sampleRate === targetSampleRate) return buffer;

    const ratio = sampleRate / targetSampleRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
        const position = i * ratio;
        const index = Math.floor(position);
        const fraction = position - index;

        if (index + 1 < buffer.length) {
            const a = buffer[index];
            const b = buffer[index + 1];
            result[i] = a + (b - a) * fraction;
        } else {
            result[i] = buffer[index];
        }
    }

    return result;
}
