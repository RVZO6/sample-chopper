import { RubberBandInterface, RubberBandOption } from 'rubberband-wasm';

class RingBuffer {
    constructor(capacity, channels) {
        this.capacity = capacity;
        this.channels = channels;
        this.buffer = new Float32Array(capacity * channels);
        this.writeIndex = 0;
        this.readIndex = 0;
        this.available = 0;
    }

    write(data) {
        const numFrames = data[0].length;
        if (this.available + numFrames > this.capacity) {
            // Buffer overflow - in a real app handle this better
            return false;
        }

        for (let c = 0; c < this.channels; c++) {
            const channelData = data[c];
            for (let i = 0; i < numFrames; i++) {
                const idx = (this.writeIndex + i) % this.capacity;
                this.buffer[idx * this.channels + c] = channelData[i];
            }
        }

        this.writeIndex = (this.writeIndex + numFrames) % this.capacity;
        this.available += numFrames;
        return true;
    }

    read(output, numFrames) {
        if (this.available < numFrames) {
            return 0;
        }

        for (let c = 0; c < this.channels; c++) {
            const channelData = output[c];
            for (let i = 0; i < numFrames; i++) {
                const idx = (this.readIndex + i) % this.capacity;
                channelData[i] = this.buffer[idx * this.channels + c];
            }
        }

        this.readIndex = (this.readIndex + numFrames) % this.capacity;
        this.available -= numFrames;
        return numFrames;
    }

    clear() {
        this.writeIndex = 0;
        this.readIndex = 0;
        this.available = 0;
    }
}

class RubberBandProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.rb = null;
        this.rbState = null;
        this.initialized = false;

        // Audio Source (Full Track)
        this.audioSource = null; // [Float32Array, Float32Array]
        this.sourceLength = 0;

        // Playback State
        this.isPlaying = false;
        this.playhead = 0;
        this.playEnd = 0;
        this.isReverse = false;

        // Buffers
        this.inputRingBuffer = null;
        this.outputRingBuffer = null;

        this.port.onmessage = async (event) => {
            if (event.data.type === 'init') {
                await this.initWasm(event.data.wasmBytes, event.data.sampleRate);
            } else if (event.data.type === 'load') {
                this.loadAudio(event.data.left, event.data.right);
            } else if (event.data.type === 'play') {
                this.startPlayback(event.data);
            } else if (event.data.type === 'stop') {
                this.stopPlayback();
            }
        };
    }

    async initWasm(wasmBytes, sampleRate) {
        const module = await WebAssembly.compile(wasmBytes);
        this.rb = await RubberBandInterface.initialize(module);

        const channels = 2;
        const options = RubberBandOption.RubberBandOptionProcessRealTime |
            RubberBandOption.RubberBandOptionTransientsMixed |
            RubberBandOption.RubberBandOptionDetectorCompound |
            RubberBandOption.RubberBandOptionPhaseLaminar;

        this.sampleRate = sampleRate;
        this.rbState = this.rb.rubberband_new(sampleRate, channels, options, 1.0, 1.0);

        // Create ring buffers
        // Input buffer: Buffer between Source and RubberBand. 
        // Needs to be large enough to handle a process block, but doesn't need to hold the whole file anymore.
        // 2 seconds should be plenty.
        this.inputRingBuffer = new RingBuffer(sampleRate * 2, 2);

        // Output buffer holds processed audio from RB
        this.outputRingBuffer = new RingBuffer(32768, 2);

        this.initialized = true;
        this.port.postMessage({ type: 'ready' });

    }

    loadAudio(left, right) {

        // Store the full audio buffer
        this.audioSource = [left, right || left];
        this.sourceLength = left.length;
        this.port.postMessage({ type: 'loaded' });
    }

    startPlayback(data) {
        if (!this.initialized || !this.audioSource) {
            console.error('[RubberBand] Cannot start playback: not initialized or no audio source');
            return;
        }

        this.isPlaying = true;
        this.isReverse = data.reverse;

        // Reset RubberBand state to clear previous history/transients
        this.rb.rubberband_reset(this.rbState);

        // Clear ring buffers
        this.inputRingBuffer.clear();
        this.outputRingBuffer.clear();

        // Set playhead
        // data.startSample is the index in the source buffer
        this.playhead = Math.floor(data.startSample);
        const durationSamples = Math.floor(data.durationSamples);

        if (this.isReverse) {
            // For reverse, we play BACKWARDS from startSample
            this.playEnd = this.playhead - durationSamples;
        } else {
            // For forward, we play FORWARDS from startSample
            this.playEnd = this.playhead + durationSamples;
        }

        // Clamp playEnd
        this.playEnd = Math.max(0, Math.min(this.sourceLength, this.playEnd));
    }

    stopPlayback() {
        this.isPlaying = false;
        if (this.initialized) {
            this.rb.rubberband_reset(this.rbState);
            this.inputRingBuffer.clear();
            this.outputRingBuffer.clear();
        }
    }

    static get parameterDescriptors() {
        return [
            { name: 'pitch', defaultValue: 1.0, minValue: 0.5, maxValue: 2.0 },
            { name: 'tempo', defaultValue: 1.0, minValue: 0.5, maxValue: 2.0 }
        ];
    }

    process(inputs, outputs, parameters) {
        if (!this.initialized || !this.rb || !this.rbState) return true;

        const output = outputs[0];
        const leftOut = output[0];
        const rightOut = output[1];
        const framesNeeded = leftOut.length;

        // 1. Update Parameters
        if (parameters.pitch && parameters.pitch.length > 0) {
            this.rb.rubberband_set_pitch_scale(this.rbState, parameters.pitch[0]);
        }
        if (parameters.tempo && parameters.tempo.length > 0) {
            const speed = parameters.tempo[0];
            this.rb.rubberband_set_time_ratio(this.rbState, 1.0 / speed);
        }

        // 2. Feed Input Ring Buffer from Audio Source
        if (this.isPlaying && this.audioSource) {
            const availableSpace = this.inputRingBuffer.capacity - this.inputRingBuffer.available;

            // We want to keep the input buffer reasonably full
            if (availableSpace > 0) {
                let samplesToWrite = availableSpace;

                // Calculate remaining samples in the current segment
                let remaining = 0;
                if (this.isReverse) {
                    remaining = this.playhead - this.playEnd;
                } else {
                    remaining = this.playEnd - this.playhead;
                }

                if (remaining <= 0) {
                    // End of segment reached
                    samplesToWrite = 0;
                    // We don't set isPlaying = false yet, we wait for the output buffer to drain
                } else {
                    samplesToWrite = Math.min(samplesToWrite, remaining);
                }

                if (samplesToWrite > 0) {
                    const chunkLeft = new Float32Array(samplesToWrite);
                    const chunkRight = new Float32Array(samplesToWrite);

                    if (this.isReverse) {
                        // Read backwards
                        for (let i = 0; i < samplesToWrite; i++) {
                            const srcIdx = this.playhead - i;
                            // Bounds check
                            if (srcIdx >= 0 && srcIdx < this.sourceLength) {
                                chunkLeft[i] = this.audioSource[0][srcIdx];
                                if (this.audioSource[1]) chunkRight[i] = this.audioSource[1][srcIdx];
                            }
                        }
                        this.playhead -= samplesToWrite;
                    } else {
                        // Read forwards
                        const end = this.playhead + samplesToWrite;
                        // Use subarray for speed (copy happens in RingBuffer.write)
                        // Need to ensure we don't go out of bounds
                        const safeEnd = Math.min(end, this.sourceLength);
                        const actualLen = safeEnd - this.playhead;

                        if (actualLen > 0) {
                            chunkLeft.set(this.audioSource[0].subarray(this.playhead, safeEnd));
                            if (this.audioSource[1]) {
                                chunkRight.set(this.audioSource[1].subarray(this.playhead, safeEnd));
                            }
                        }
                        this.playhead += samplesToWrite;
                    }

                    this.inputRingBuffer.write([chunkLeft, chunkRight]);
                }
            }
        }

        // 3. Feed Rubber Band from Input Ring Buffer
        // We try to keep the output buffer reasonably full to avoid underruns
        const TARGET_OUTPUT_LEVEL = 4096;
        const CHUNK_SIZE = 1024; // Process in chunks of 1024 frames

        // If output buffer is low, feed more data
        if (this.outputRingBuffer.available < TARGET_OUTPUT_LEVEL && this.inputRingBuffer.available >= CHUNK_SIZE) {

            const samplesRequired = CHUNK_SIZE;

            // Allocate WASM memory for input
            const inputPtr = this.rb.malloc(samplesRequired * 2 * 4);
            const inputPtrs = this.rb.malloc(2 * 4);

            // Read from ring buffer
            const tempLeft = new Float32Array(samplesRequired);
            const tempRight = new Float32Array(samplesRequired);
            this.inputRingBuffer.read([tempLeft, tempRight], samplesRequired);

            // Copy to WASM memory
            const leftPtr = inputPtr;
            const rightPtr = inputPtr + samplesRequired * 4;

            this.rb.memWrite(leftPtr, tempLeft);
            this.rb.memWrite(rightPtr, tempRight);

            this.rb.memWritePtr(inputPtrs, leftPtr);
            this.rb.memWritePtr(inputPtrs + 4, rightPtr);

            // Process
            // TODO: Detect end of stream and pass final=true?
            // For now, false is fine for continuous playback
            this.rb.rubberband_process(this.rbState, inputPtrs, samplesRequired, false);

            this.rb.free(inputPtr);
            this.rb.free(inputPtrs);
        }

        // 4. Retrieve from Rubber Band into Output Ring Buffer
        // Always check for available output
        const available = this.rb.rubberband_available(this.rbState);
        if (available > 0) {
            const outputPtr = this.rb.malloc(available * 2 * 4);
            const outputPtrs = this.rb.malloc(2 * 4);

            const leftPtr = outputPtr;
            const rightPtr = outputPtr + available * 4;

            this.rb.memWritePtr(outputPtrs, leftPtr);
            this.rb.memWritePtr(outputPtrs + 4, rightPtr);

            const retrieved = this.rb.rubberband_retrieve(this.rbState, outputPtrs, available);

            const outLeft = this.rb.memReadF32(leftPtr, retrieved);
            const outRight = this.rb.memReadF32(rightPtr, retrieved);

            this.outputRingBuffer.write([outLeft, outRight]);

            this.rb.free(outputPtr);
            this.rb.free(outputPtrs);
        } else if (this.isPlaying && this.inputRingBuffer.available === 0 && this.outputRingBuffer.available === 0) {
            // No more output from RB, and no more input pending.
            // Check if we have reached the end of the source segment
            let remaining = 0;
            if (this.isReverse) {
                remaining = this.playhead - this.playEnd;
            } else {
                remaining = this.playEnd - this.playhead;
            }

            if (remaining <= 0) {
                this.isPlaying = false;
                this.port.postMessage({ type: 'complete' });

            }
        }

        // 5. Fill AudioWorklet Output from Output Ring Buffer
        const dummy = new Float32Array(framesNeeded);
        const read = this.outputRingBuffer.read([leftOut, rightOut || dummy], framesNeeded);

        // Handle underrun by filling with silence
        if (read < framesNeeded) {
            for (let i = read; i < framesNeeded; i++) {
                leftOut[i] = 0;
                if (rightOut) rightOut[i] = 0;
            }
        }

        return true;
    }
}

registerProcessor('rubberband-processor', RubberBandProcessor);
