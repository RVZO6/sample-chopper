/*!
 * rubberband-wasm v3.3.0 (https://www.npmjs.com/package/rubberband-wasm)
 * (c) Dani Biro
 * @license GPLv2
 */

(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.rubberband = {}));
})(this, (function (exports) { 'use strict';

    exports.RubberBandOption = void 0;
    (function (RubberBandOption) {
        RubberBandOption[RubberBandOption["RubberBandOptionProcessOffline"] = 0] = "RubberBandOptionProcessOffline";
        RubberBandOption[RubberBandOption["RubberBandOptionProcessRealTime"] = 1] = "RubberBandOptionProcessRealTime";
        RubberBandOption[RubberBandOption["RubberBandOptionStretchElastic"] = 0] = "RubberBandOptionStretchElastic";
        RubberBandOption[RubberBandOption["RubberBandOptionStretchPrecise"] = 16] = "RubberBandOptionStretchPrecise";
        RubberBandOption[RubberBandOption["RubberBandOptionTransientsCrisp"] = 0] = "RubberBandOptionTransientsCrisp";
        RubberBandOption[RubberBandOption["RubberBandOptionTransientsMixed"] = 256] = "RubberBandOptionTransientsMixed";
        RubberBandOption[RubberBandOption["RubberBandOptionTransientsSmooth"] = 512] = "RubberBandOptionTransientsSmooth";
        RubberBandOption[RubberBandOption["RubberBandOptionDetectorCompound"] = 0] = "RubberBandOptionDetectorCompound";
        RubberBandOption[RubberBandOption["RubberBandOptionDetectorPercussive"] = 1024] = "RubberBandOptionDetectorPercussive";
        RubberBandOption[RubberBandOption["RubberBandOptionDetectorSoft"] = 2048] = "RubberBandOptionDetectorSoft";
        RubberBandOption[RubberBandOption["RubberBandOptionPhaseLaminar"] = 0] = "RubberBandOptionPhaseLaminar";
        RubberBandOption[RubberBandOption["RubberBandOptionPhaseIndependent"] = 8192] = "RubberBandOptionPhaseIndependent";
        RubberBandOption[RubberBandOption["RubberBandOptionThreadingAuto"] = 0] = "RubberBandOptionThreadingAuto";
        RubberBandOption[RubberBandOption["RubberBandOptionThreadingNever"] = 65536] = "RubberBandOptionThreadingNever";
        RubberBandOption[RubberBandOption["RubberBandOptionThreadingAlways"] = 131072] = "RubberBandOptionThreadingAlways";
        RubberBandOption[RubberBandOption["RubberBandOptionWindowStandard"] = 0] = "RubberBandOptionWindowStandard";
        RubberBandOption[RubberBandOption["RubberBandOptionWindowShort"] = 1048576] = "RubberBandOptionWindowShort";
        RubberBandOption[RubberBandOption["RubberBandOptionWindowLong"] = 2097152] = "RubberBandOptionWindowLong";
        RubberBandOption[RubberBandOption["RubberBandOptionSmoothingOff"] = 0] = "RubberBandOptionSmoothingOff";
        RubberBandOption[RubberBandOption["RubberBandOptionSmoothingOn"] = 8388608] = "RubberBandOptionSmoothingOn";
        RubberBandOption[RubberBandOption["RubberBandOptionFormantShifted"] = 0] = "RubberBandOptionFormantShifted";
        RubberBandOption[RubberBandOption["RubberBandOptionFormantPreserved"] = 16777216] = "RubberBandOptionFormantPreserved";
        RubberBandOption[RubberBandOption["RubberBandOptionPitchHighSpeed"] = 0] = "RubberBandOptionPitchHighSpeed";
        RubberBandOption[RubberBandOption["RubberBandOptionPitchHighQuality"] = 33554432] = "RubberBandOptionPitchHighQuality";
        RubberBandOption[RubberBandOption["RubberBandOptionPitchHighConsistency"] = 67108864] = "RubberBandOptionPitchHighConsistency";
        RubberBandOption[RubberBandOption["RubberBandOptionChannelsApart"] = 0] = "RubberBandOptionChannelsApart";
        RubberBandOption[RubberBandOption["RubberBandOptionChannelsTogether"] = 268435456] = "RubberBandOptionChannelsTogether";
        RubberBandOption[RubberBandOption["RubberBandOptionEngineFaster"] = 0] = "RubberBandOptionEngineFaster";
        RubberBandOption[RubberBandOption["RubberBandOptionEngineFiner"] = 536870912] = "RubberBandOptionEngineFiner";
    })(exports.RubberBandOption || (exports.RubberBandOption = {}));
    exports.RubberBandPresetOption = void 0;
    (function (RubberBandPresetOption) {
        RubberBandPresetOption[RubberBandPresetOption["DefaultOptions"] = 0] = "DefaultOptions";
        RubberBandPresetOption[RubberBandPresetOption["PercussiveOptions"] = 1056768] = "PercussiveOptions";
    })(exports.RubberBandPresetOption || (exports.RubberBandPresetOption = {}));
    class RubberBandInterface {
        constructor() { }
        static async initialize(module) {
            if (typeof WebAssembly === "undefined") {
                throw new Error("WebAssembly is not supported in this environment!");
            }
            let heap = {};
            const errorHandler = (...params) => {
                console.error("WASI called with params", params);
                return 52;
            };
            let printBuffer = [];
            const wasmInstance = await WebAssembly.instantiate(module, {
                env: {
                    emscripten_notify_memory_growth: () => {
                        heap.HEAP8 = new Uint8Array(wasmInstance.exports.memory.buffer);
                        heap.HEAP32 = new Uint32Array(wasmInstance.exports.memory.buffer);
                    },
                },
                wasi_snapshot_preview1: {
                    proc_exit: (...params) => errorHandler("proc_exit", params),
                    fd_read: (...params) => errorHandler("fd_read", params),
                    fd_write: (fd, iov, iovcnt, pnum) => {
                        if (fd > 2)
                            return 52;
                        let num = 0;
                        for (let i = 0; i < iovcnt; i++) {
                            const ptr = heap.HEAP32[iov >> 2];
                            const len = heap.HEAP32[(iov + 4) >> 2];
                            iov += 8;
                            for (let j = 0; j < len; j++) {
                                const curr = heap.HEAP8[ptr + j];
                                if (curr === 0 || curr === 10) {
                                    console.log(printBuffer.join(""));
                                    printBuffer.length = 0;
                                }
                                else {
                                    printBuffer.push(String.fromCharCode(curr));
                                }
                            }
                            num += len;
                        }
                        heap.HEAP32[pnum >> 2] = num;
                        return 0;
                    },
                    fd_seek: (...params) => errorHandler("fd_seek", params),
                    fd_close: (...params) => errorHandler("fd_close", params),
                    environ_sizes_get: (penviron_count, penviron_buf_size) => {
                        // heap.HEAP32[penviron_count >> 2] = 0;
                        // heap.HEAP32[penviron_buf_size >> 2] = 0;
                        return 52; // NO_SYS
                    },
                    environ_get: (...params) => errorHandler("environ_get", params),
                    clock_time_get: (...params) => errorHandler("clock_time_get", params),
                },
            });
            const exports = wasmInstance.exports;
            heap.HEAP8 = new Uint8Array(wasmInstance.exports.memory.buffer);
            heap.HEAP32 = new Uint32Array(wasmInstance.exports.memory.buffer);
            exports._initialize();
            const instance = { heap, exports };
            const ret = new RubberBandInterface();
            ret.wasm = instance;
            return ret;
        }
        malloc(size) {
            return this.wasm.exports.wasm_malloc(size);
        }
        memWrite(destPtr, data) {
            const uint8Array = data instanceof Uint8Array ? data : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
            this.wasm.heap.HEAP8.set(uint8Array, destPtr);
        }
        memWritePtr(destPtr, srcPtr) {
            const buf = new Uint8Array(4);
            const view = new DataView(buf.buffer);
            view.setUint32(0, srcPtr, true);
            this.wasm.heap.HEAP8.set(buf, destPtr);
        }
        memReadU8(srcPtr, length) {
            return this.wasm.heap.HEAP8.subarray(srcPtr, srcPtr + length);
        }
        memReadF32(srcPtr, length) {
            const res = this.memReadU8(srcPtr, length * 4);
            return new Float32Array(res.buffer, res.byteOffset, length);
        }
        free(ptr) {
            this.wasm.exports.wasm_free(ptr);
        }
        rubberband_new(sampleRate, channels, options, initialTimeRatio, initialPitchScale) {
            return this.wasm.exports.rb_new(sampleRate, channels, options, initialTimeRatio, initialPitchScale);
        }
        rubberband_delete(state) {
            this.wasm.exports.rb_delete(state);
        }
        rubberband_reset(state) {
            this.wasm.exports.rb_reset(state);
        }
        rubberband_set_time_ratio(state, ratio) {
            this.wasm.exports.rb_set_time_ratio(state, ratio);
        }
        rubberband_set_pitch_scale(state, scale) {
            this.wasm.exports.rb_set_pitch_scale(state, scale);
        }
        rubberband_set_formant_scale(state, scale) {
            this.wasm.exports.rb_set_formant_scale(state, scale);
        }
        rubberband_get_time_ratio(state) {
            return this.wasm.exports.rb_get_time_ratio(state);
        }
        rubberband_get_pitch_scale(state) {
            return this.wasm.exports.rb_get_pitch_scale(state);
        }
        rubberband_get_formant_scale(state) {
            return this.wasm.exports.rb_get_formant_scale(state);
        }
        rubberband_get_preferred_start_pad(state) {
            return this.wasm.exports.rb_get_preferred_start_pad(state);
        }
        rubberband_get_start_delay(state) {
            return this.wasm.exports.rb_get_start_delay(state);
        }
        rubberband_get_latency(state) {
            return this.wasm.exports.rb_get_latency(state);
        }
        rubberband_set_transients_option(state, options) {
            this.wasm.exports.rb_set_transients_option(state, options);
        }
        rubberband_set_detector_option(state, options) {
            this.wasm.exports.rb_set_detector_option(state, options);
        }
        rubberband_set_phase_option(state, options) {
            this.wasm.exports.rb_set_phase_option(state, options);
        }
        rubberband_set_formant_option(state, options) {
            this.wasm.exports.rb_set_formant_option(state, options);
        }
        rubberband_set_pitch_option(state, options) {
            this.wasm.exports.rb_set_pitch_option(state, options);
        }
        rubberband_set_expected_input_duration(state, samples) {
            this.wasm.exports.rb_set_expected_input_duration(state, samples);
        }
        rubberband_get_samples_required(state) {
            return this.wasm.exports.rb_get_samples_required(state);
        }
        rubberband_set_max_process_size(state, samples) {
            this.wasm.exports.rb_set_max_process_size(state, samples);
        }
        rubberband_get_process_size_limit(state) {
            return this.wasm.exports.rb_get_process_size_limit(state);
        }
        rubberband_set_key_frame_map(state, keyframecount, from, to) {
            this.wasm.exports.rb_set_key_frame_map(state, keyframecount, from, to);
        }
        rubberband_study(state, input, samples, final) {
            this.wasm.exports.rb_study(state, input, samples, final);
        }
        rubberband_process(state, input, samples, final) {
            this.wasm.exports.rb_process(state, input, samples, final);
        }
        rubberband_available(state) {
            return this.wasm.exports.rb_available(state);
        }
        rubberband_retrieve(state, output, samples) {
            return this.wasm.exports.rb_retrieve(state, output, samples);
        }
        rubberband_get_channel_count(state) {
            return this.wasm.exports.rb_get_channel_count(state);
        }
        rubberband_calculate_stretch(state) {
            this.wasm.exports.rb_calculate_stretch(state);
        }
        rubberband_set_debug_level(state, level) {
            this.wasm.exports.rb_set_debug_level(state, level);
        }
        rubberband_set_default_debug_level(level) {
            this.wasm.exports.rb_set_default_debug_level(level);
        }
    }

    exports.RubberBandInterface = RubberBandInterface;

    Object.defineProperty(exports, '__esModule', { value: true });

}));


// Shim to expose RubberbandInterface and RubberbandOption globally
var RubberBandInterface = rubberband.RubberBandInterface;
var RubberBandOption = rubberband.RubberBandOption;


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
        console.log("RubberBandProcessor: Initialized");
    }

    loadAudio(left, right) {
        console.log(`RubberBandProcessor: Loading audio source. Length: ${left.length} frames.`);
        // Store the full audio buffer
        this.audioSource = [left, right || left];
        this.sourceLength = left.length;
        this.port.postMessage({ type: 'loaded' });
    }

    startPlayback(data) {
        if (!this.initialized || !this.audioSource) return;

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

        console.log(`RubberBandProcessor: Playing. Start: ${this.playhead}, End: ${this.playEnd}, Reverse: ${this.isReverse}`);
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
