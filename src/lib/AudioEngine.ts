import processorUrl from '../workers/rubberband.worklet.js?worker&url';
export interface PadParams {
    speed: number;      // playback rate (0.5 to 2.0 recommended)
    pitch: number;      // pitch in semitones (-12 to +12)
    reverse: boolean;   // reverse playback
    attack: number;     // attack time in seconds
    release: number;    // release time in seconds
    volume: number;     // pad volume (0-1)
}

type PlaybackMode = 'global' | 'pad';

interface PlaybackState {
    mode: PlaybackMode;
    cuePoint: number;           // Where in the audio file playback starts
    startTime: number;           // When playback started (AudioContext.currentTime)
    duration: number;            // How long to play (in original time)
    params: PadParams;           // Current playback parameters
    isPlaying: boolean;
    currentPadId: string | null; // Track which pad is currently playing
}

export class AudioEngine {
    // Audio buffer and context
    private audioBuffer: AudioBuffer | null = null;
    private audioContext: AudioContext | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private envelopeGain: GainNode | null = null;
    private masterGain: GainNode | null = null;
    private wasmBytes: ArrayBuffer | null = null;
    private initPromise: Promise<void> | null = null;

    // Playback state
    private state: PlaybackState = {
        mode: 'global',
        cuePoint: 0,
        startTime: 0,
        duration: 0,
        params: { speed: 1.0, pitch: 0, reverse: false, attack: 0, release: 0.1, volume: 1.0 },
        isPlaying: false,
        currentPadId: null
    };

    // Global settings
    private globalOffset: number = 0;
    private globalPitchOffset: number = 0; // Global key shift in semitones
    private globalSpeed: number = 1.0; // Global speed multiplier
    private masterVolume: number = 0.75;

    // Callbacks
    private _onStop: (() => void) | null = null;
    private updateInterval: number | null = null;
    private lastUpdateTime: number = 0;
    private accumulatedPosition: number = 0;

    constructor() {
        // Initialize AudioContext
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = this.masterVolume;
        this.masterGain.connect(this.audioContext.destination);
    }

    set onStop(callback: () => void) {
        this._onStop = callback;
    }

    setMasterVolume(val: number) {
        this.masterVolume = Math.max(0, Math.min(1, val));
        if (this.masterGain && this.audioContext) {
            // Smooth transition
            this.masterGain.gain.setTargetAtTime(this.masterVolume, this.audioContext.currentTime, 0.02);
        }
    }

    setGlobalPitchOffset(semitones: number) {
        this.globalPitchOffset = semitones;

        // Apply immediately to active playback
        if (this.workletNode && this.state.isPlaying) {
            const totalPitch = this.state.params.pitch + this.globalPitchOffset;
            const pitchRatio = totalPitch === 0 ? 1.0 : Math.pow(2, totalPitch / 12);
            const pitchParam = this.workletNode.parameters.get('pitch');
            if (pitchParam) {
                pitchParam.setTargetAtTime(pitchRatio, this.audioContext?.currentTime || 0, 0.02);
            }
        }
    }

    setGlobalSpeed(speed: number) {
        this.globalSpeed = Math.max(0.1, Math.min(4.0, speed)); // Clamp to reasonable range

        // Apply immediately to active playback
        if (this.workletNode && this.state.isPlaying) {
            const totalSpeed = this.state.params.speed * this.globalSpeed;
            const tempoParam = this.workletNode.parameters.get('tempo');
            if (tempoParam) {
                tempoParam.setTargetAtTime(totalSpeed, this.audioContext?.currentTime || 0, 0.02);
            }
        }
    }

    private async initAudioWorklet() {
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            if (!this.audioContext) return;

            try {
                await this.audioContext.audioWorklet.addModule(processorUrl);

                // Fetch WASM file
                const response = await fetch('/rubberband/rubberband.wasm');
                if (!response.ok) {
                    throw new Error(`Failed to load rubberband.wasm: ${response.statusText}`);
                }
                this.wasmBytes = await response.arrayBuffer();

            } catch (err) {
                console.error('AudioEngine: Failed to initialize AudioWorklet', err);
                throw err;
            }
        })();

        return this.initPromise;
    }

    async setAudioBuffer(buffer: AudioBuffer): Promise<void> {
        this.audioBuffer = buffer;

        // Initialize Worklet if needed
        await this.initAudioWorklet();

        if (this.workletNode) {
            const left = buffer.getChannelData(0);
            const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;

            this.workletNode.port.postMessage({
                type: 'load',
                left: left,
                right: right
            });
        }
    }

    private _stopPlayback(preservePadId: boolean = false) {
        if (this.workletNode) {
            this.workletNode.port.postMessage({ type: 'stop' });
        }

        this.state.isPlaying = false;
        if (!preservePadId) {
            this.state.currentPadId = null;
        }

        // Reset position tracking
        this.lastUpdateTime = 0;
        // accumulatedPosition is NOT reset here because we might want to resume or we are just stopping.
        // Actually, if we stop, we usually reset or pause.
        // If we pause, we keep the position.
        // If we stop completely, we might reset.
        // The previous code reset it. Let's keep it consistent with previous behavior for now, 
        // but `pause()` handles the offset.
    }

    // Polling methods removed (_startTimeUpdate, _stopTimeUpdate)

    // ===== GLOBAL TRANSPORT CONTROLS =====

    async play() {
        if (this.state.isPlaying) return;
        if (!this.audioBuffer || !this.audioContext) {
            console.warn('Audio not loaded yet');
            return;
        }

        // Stop any current playback immediately
        this._stopPlayback();

        // Resume context if needed
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        // FORCE reset to global mode with EXACT normal settings
        this.state.mode = 'global';
        this.state.params = { speed: 1.0, pitch: 0, reverse: false, attack: 0, release: 0.1, volume: 1.0 };
        this.state.cuePoint = this.globalOffset;

        // Calculate duration
        const duration = this.getDuration() - this.globalOffset;
        if (duration <= 0) {
            this.globalOffset = 0;
            this.state.cuePoint = 0;
        }

        // Reset position tracking
        this.lastUpdateTime = 0;
        this.accumulatedPosition = this.globalOffset; // Start from current offset

        // Start playback
        await this._startPlayback(this.globalOffset, duration, this.state.params);
    }

    pause() {
        // Capture current position BEFORE stopping
        let currentPos = 0;
        if (this.state.isPlaying) {
            currentPos = this.getCurrentTime();
        } else {
            currentPos = this.globalOffset;
        }

        // Stop any playback immediately
        this._stopPlayback();

        // Set global offset to current position (pauses at current location)
        this.globalOffset = currentPos;

        // FORCE reset to global mode
        this.state.mode = 'global';
        this.state.params = { speed: 1.0, pitch: 0, reverse: false, attack: 0, release: 0.1, volume: 1.0 };
        this.state.isPlaying = false;
        this.state.currentPadId = null;
    }

    seek(time: number) {
        const wasPlaying = this.state.isPlaying;

        if (wasPlaying) {
            this.pause();
        }

        this.globalOffset = Math.max(0, Math.min(time, this.getDuration()));
        this.state.mode = 'global';
        this.state.params = { speed: 1.0, pitch: 0, reverse: false, attack: 0, release: 0.1, volume: 1.0 };

        // Reset position tracking
        this.lastUpdateTime = 0;
        this.accumulatedPosition = this.globalOffset;

        if (wasPlaying) {
            this.play();
        }
    }

    getCurrentTime(): number {
        if (!this.state.isPlaying || !this.audioContext) {
            if (this.state.mode === 'pad') {
                // For pad mode, return relative to cue point? Or just accumulated?
                // Usually we want to see where we are.
                return this.accumulatedPosition;
            }
            return Math.max(0, Math.min(this.getDuration(), this.globalOffset));
        }

        const now = this.audioContext.currentTime;

        // Initialize on first call after play starts
        if (this.lastUpdateTime === 0) {
            this.lastUpdateTime = this.state.startTime;
            // accumulatedPosition is already set in play() or playPad()
        }

        // Calculate time delta
        const timeDelta = now - this.lastUpdateTime;

        // Update position
        this.updatePosition(timeDelta);

        // Update last update time
        this.lastUpdateTime = now;

        // Check for completion
        this.checkPlaybackCompletion(now);

        // Always clamp to valid range
        return Math.max(0, Math.min(this.getDuration(), this.accumulatedPosition));
    }

    private updatePosition(timeDelta: number) {
        // Calculate effective speed (pad speed * global speed)
        const effectiveSpeed = this.state.params.speed * this.globalSpeed;

        // Update accumulated position based on current speed
        if (this.state.params.reverse) {
            this.accumulatedPosition -= timeDelta * effectiveSpeed;
        } else {
            this.accumulatedPosition += timeDelta * effectiveSpeed;
        }
    }

    private checkPlaybackCompletion(now: number) {
        // Calculate effective speed
        const effectiveSpeed = this.state.params.speed * this.globalSpeed;

        // Calculate elapsed in original time
        const elapsed = now - this.state.startTime;
        const playbackElapsed = elapsed * effectiveSpeed;

        // Check if playback finished
        if (playbackElapsed >= this.state.duration - 0.01) {
            this.state.isPlaying = false;
            this._stopPlayback();

            // Set final position
            if (this.state.params.reverse) {
                this.accumulatedPosition = 0;
            } else {
                if (this.state.mode === 'pad') {
                    this.accumulatedPosition = Math.min(this.getDuration(), this.state.cuePoint + this.state.duration);
                } else {
                    this.accumulatedPosition = Math.min(this.getDuration(), this.globalOffset + this.state.duration);
                    this.globalOffset = this.accumulatedPosition; // Update global offset
                }
            }

            // Notify stop
            if (this._onStop) this._onStop();
        }
    }

    getDuration(): number {
        return this.audioBuffer?.duration || 0;
    }

    get isPlaying(): boolean {
        return this.state.isPlaying;
    }

    get isPadPlaying(): boolean {
        return this.state.isPlaying && this.state.mode === 'pad';
    }

    get isGlobalPlaying(): boolean {
        return this.state.isPlaying && this.state.mode === 'global';
    }

    // ===== PAD-SPECIFIC PLAYBACK =====

    async playPad(padId: string, cuePoint: number, params: PadParams) {
        if (!this.audioBuffer || !this.audioContext) {
            console.warn('Audio not loaded yet');
            return;
        }

        // Stop any current pad playback (don't stop global playback)
        if (this.isPadPlaying) {
            this._stopPlayback();
        }

        // Resume context if needed
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        // COMPLETELY reset state before applying new pad's settings
        this.state.mode = 'pad';
        this.state.currentPadId = padId;
        this.state.cuePoint = cuePoint;
        this.state.params = { ...params }; // Copy params

        // Calculate duration
        let duration: number;
        if (params.reverse) {
            duration = cuePoint;
        } else {
            duration = this.getDuration() - cuePoint;
        }

        if (duration <= 0) {
            console.warn(`Invalid playback parameters for pad ${padId}: duration=${duration}`);
            this.state.isPlaying = false;
            return;
        }

        // Reset position tracking
        this.lastUpdateTime = 0;
        this.accumulatedPosition = cuePoint;

        // Start playback
        await this._startPlayback(cuePoint, duration, params);
    }

    stopPad() {
        // If we are in pad mode, stop.
        if (this.isPadPlaying) {
            // Store the cue point before stopping so we can return to it
            const cuePoint = this.state.cuePoint;
            const currentPadId = this.state.currentPadId;

            // Quick fade out for smooth release
            if (this.envelopeGain && this.audioContext) {
                const now = this.audioContext.currentTime;
                this.envelopeGain.gain.cancelScheduledValues(now);
                this.envelopeGain.gain.setValueAtTime(this.envelopeGain.gain.value, now);
                this.envelopeGain.gain.linearRampToValueAtTime(0, now + 0.01); // Very quick 10ms fade

                // Stop worklet and return to cue point (but only if another pad didn't start)
                setTimeout(() => {
                    // Only stop and return if we're still in pad mode with the SAME pad
                    if (this.state.mode === 'pad' && this.state.currentPadId === currentPadId) {
                        this._stopPlayback();
                        // Return to the pad's cue point (paused)
                        this.globalOffset = cuePoint;
                        this.state.mode = 'global';
                        this.state.isPlaying = false;
                    }
                }, 15);
            } else {
                this._stopPlayback();
                this.globalOffset = cuePoint;
                this.state.mode = 'global';
                this.state.isPlaying = false;
            }
        } else {
            this.pause(); // Fallback
        }
    }

    // ===== INTERNAL PLAYBACK METHODS =====
    private async _startPlayback(cuePoint: number, duration: number, params: PadParams) {
        if (!this.audioBuffer || !this.audioContext) return;

        try {
            await this.initAudioWorklet();
            if (!this.wasmBytes) {
                console.error("WASM bytes not loaded");
                return;
            }

            // Resume context if needed
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Create AudioWorkletNode if not exists
            if (!this.workletNode) {
                this.workletNode = new AudioWorkletNode(this.audioContext, 'rubberband-processor');

                // Initialize Worklet with WASM
                this.workletNode.port.postMessage({
                    type: 'init',
                    wasmBytes: this.wasmBytes,
                    sampleRate: this.audioContext.sampleRate
                });

                // Wait for ready
                await new Promise<void>((resolve) => {
                    if (!this.workletNode) return resolve();
                    const handler = (event: MessageEvent) => {
                        if (event.data.type === 'ready') {
                            this.workletNode?.port.removeEventListener('message', handler);
                            resolve();
                        }
                    };
                    this.workletNode.port.onmessage = (event) => {
                        if (event.data.type === 'ready') {
                            handler(event);
                        } else if (event.data.type === 'complete') {
                            this.state.isPlaying = false;
                            this._stopPlayback();
                            if (this._onStop) this._onStop();
                        }
                    };
                });

                // If we just created the node, we need to send the buffer if we have it
                if (this.audioBuffer) {
                    const left = this.audioBuffer.getChannelData(0);
                    const right = this.audioBuffer.numberOfChannels > 1 ? this.audioBuffer.getChannelData(1) : null;
                    this.workletNode.port.postMessage({
                        type: 'load',
                        left: left,
                        right: right
                    });
                }
            }

            // Create Envelope Gain Node
            if (!this.envelopeGain) {
                this.envelopeGain = this.audioContext.createGain();
                this.envelopeGain.connect(this.masterGain!); // Connect to master
            }

            // Connect Worklet -> Envelope -> Master -> Destination
            try { this.workletNode.disconnect(); } catch (e) { }
            this.workletNode.connect(this.envelopeGain);

            // Apply Envelope
            const now = this.audioContext.currentTime;
            const attack = params.attack || 0.005;
            const release = params.release || 0.01;
            const volume = params.volume !== undefined ? params.volume : 1.0;

            this.envelopeGain.gain.cancelScheduledValues(now);
            this.envelopeGain.gain.setValueAtTime(0, now);
            this.envelopeGain.gain.linearRampToValueAtTime(volume, now + attack);

            // Calculate samples
            const sampleRate = this.audioBuffer.sampleRate;
            const startSample = cuePoint * sampleRate;
            const durationSamples = duration * sampleRate;

            // Send PLAY command
            this.workletNode.port.postMessage({
                type: 'play',
                startSample: startSample,
                durationSamples: durationSamples,
                reverse: params.reverse
            });

            // Set parameters
            const totalPitch = params.pitch + this.globalPitchOffset;
            const pitchRatio = totalPitch === 0 ? 1.0 : Math.pow(2, totalPitch / 12);
            const tempo = params.speed * this.globalSpeed;

            const tempoParam = this.workletNode.parameters.get('tempo');
            const pitchParam = this.workletNode.parameters.get('pitch');

            if (tempoParam) tempoParam.value = tempo;
            if (pitchParam) pitchParam.value = pitchRatio;

            this.state.startTime = this.audioContext.currentTime;
            this.state.duration = duration;
            this.state.isPlaying = true;

            // No polling started here anymore!

        } catch (error) {
            console.error('Error starting playback:', error);
            this.state.isPlaying = false;
        }
    }

    // ===== WAVEFORM VISUALIZATION =====

    getPeaks(width: number): number[] {
        if (!this.audioBuffer) return [];

        const channelData = this.audioBuffer.getChannelData(0);
        const step = Math.ceil(channelData.length / width);

        const peaks: number[] = [];

        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;

            for (let j = 0; j < step; j++) {
                const datum = channelData[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }

            peaks[i] = Math.max(Math.abs(min), Math.abs(max));
        }

        return peaks;
    }

    getAudioBuffer(): AudioBuffer | null {
        return this.audioBuffer;
    }
}
