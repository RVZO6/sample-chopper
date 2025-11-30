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
    private masterVolume: number = 0.75;

    // Callbacks
    private _onStop: (() => void) | null = null;
    private updateInterval: number | null = null;

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

    private async initAudioWorklet() {
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            if (!this.audioContext) return;

            try {
                await this.audioContext.audioWorklet.addModule('rubberband-processor.js');

                // Fetch WASM file
                const response = await fetch('rubberband.wasm');
                if (!response.ok) {
                    throw new Error(`Failed to load rubberband.wasm: ${response.statusText}`);
                }
                this.wasmBytes = await response.arrayBuffer();
                console.log('AudioEngine: Rubber Band Worklet and WASM loaded');
            } catch (err) {
                console.error('AudioEngine: Failed to initialize AudioWorklet', err);
                throw err;
            }
        })();

        return this.initPromise;
    }

    async load(url: string): Promise<void> {
        // Start init early
        this.initAudioWorklet();

        return new Promise((resolve, reject) => {
            fetch(url)
                .then(r => {
                    if (!r.ok) {
                        throw new Error(`Failed to fetch audio file: ${r.status} ${r.statusText}`);
                    }
                    return r.arrayBuffer();
                })
                .then(ab => {
                    if (!this.audioContext) {
                        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                        // Re-create master gain if context was recreated (unlikely but safe)
                        this.masterGain = this.audioContext.createGain();
                        this.masterGain.gain.value = this.masterVolume;
                        this.masterGain.connect(this.audioContext.destination);
                    }
                    return this.audioContext.decodeAudioData(ab);
                })
                .then(async buffer => {
                    this.audioBuffer = buffer;
                    // No need for reversed buffer anymore, handled by Worklet
                    console.log('Audio buffer loaded successfully, duration:', buffer.duration);

                    // Send buffer to Worklet
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

                    resolve();
                })
                .catch(err => {
                    console.error('Error loading audio buffer:', err);
                    reject(err);
                });
        });
    }

    private _stopPlayback(preservePadId: boolean = false) {
        if (this.workletNode) {
            this.workletNode.port.postMessage({ type: 'stop' });
        }

        // Apply release if playing?
        // For now, hard stop is safer for rapid re-triggering,
        // but we could ramp down envelopeGain if we wanted a smooth stop.
        // However, _stopPlayback is often called right before _startPlayback,
        // so we want to be ready to play immediately.

        this.state.isPlaying = false;
        // Only clear currentPadId if not preserving (allows immediate restart of same pad)
        if (!preservePadId) {
            this.state.currentPadId = null;
        }

        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    private _startTimeUpdate() {
        this._stopTimeUpdate();
        this.updateInterval = window.setInterval(() => {
            if (this.state.isPlaying) {
                // Time is updated in getCurrentTime()
                this.getCurrentTime(); // This checks for end of playback
            }
        }, 16); // ~60fps
    }

    private _stopTimeUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

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

        if (wasPlaying) {
            this.play();
        }
    }

    getCurrentTime(): number {
        if (!this.state.isPlaying || !this.audioContext) {
            return Math.max(0, Math.min(this.getDuration(), this.globalOffset));
        }

        // Simple calculation: elapsed time * speed (pitch doesn't affect waveform position)
        const now = this.audioContext.currentTime;
        const elapsed = now - this.state.startTime;
        const playbackElapsed = elapsed * this.state.params.speed;

        // Check if playback finished
        if (playbackElapsed >= this.state.duration - 0.01) {
            this.state.isPlaying = false;
            this._stopPlayback();
            // Return final position
            if (this.state.params.reverse) {
                return 0; // Or cuePoint - duration?
            } else {
                if (this.state.mode === 'pad') {
                    return Math.min(this.getDuration(), this.state.cuePoint + this.state.duration);
                } else {
                    return Math.min(this.getDuration(), this.globalOffset + this.state.duration);
                }
            }
            // Notify stop
            if (this._onStop) this._onStop();
        }

        // Calculate current position based on playback direction and mode
        let position: number;
        if (this.state.params.reverse) {
            // Playing backwards: start at cuePoint, go to 0
            position = this.state.cuePoint - playbackElapsed;
        } else {
            // Playing forward
            if (this.state.mode === 'pad') {
                // Pad mode: start at cuePoint, go to end
                position = this.state.cuePoint + playbackElapsed;
            } else {
                // Global mode: start at globalOffset, go to end
                position = this.globalOffset + playbackElapsed;
            }
        }

        // Always clamp to valid range
        return Math.max(0, Math.min(this.getDuration(), position));
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
                    // If a new pad was triggered, this.state.currentPadId will be different
                    if (this.state.mode === 'pad' && this.state.currentPadId === currentPadId) {
                        this._stopPlayback();
                        // Return to the pad's cue point (paused)
                        this.globalOffset = cuePoint;
                        this.state.mode = 'global';
                        this.state.isPlaying = false;
                    }
                    // If currentPadId changed, a new pad is already playing, so do nothing
                }, 15); // Short delay for fade
            } else {
                this._stopPlayback();
                // Return to the pad's cue point (paused)
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
                    this.workletNode.port.onmessage = handler;
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
            // Disconnect first to be safe
            try { this.workletNode.disconnect(); } catch (e) { }
            this.workletNode.connect(this.envelopeGain);

            // Apply Envelope
            const now = this.audioContext.currentTime;
            const attack = params.attack || 0.005; // Min attack to avoid clicks
            const release = params.release || 0.01;
            const volume = params.volume !== undefined ? params.volume : 1.0;

            this.envelopeGain.gain.cancelScheduledValues(now);
            this.envelopeGain.gain.setValueAtTime(0, now);
            this.envelopeGain.gain.linearRampToValueAtTime(volume, now + attack);
            // We don't schedule release here because we don't know when the note ends in Trigger mode
            // (it plays full duration). But we should ramp down at the very end of duration?
            // Or just let it play.
            // For Gate mode, stopPad() handles the release.

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
            // Combine pad pitch with global pitch offset
            const totalPitch = params.pitch + this.globalPitchOffset;
            const pitchRatio = totalPitch === 0 ? 1.0 : Math.pow(2, totalPitch / 12);
            const tempo = params.speed;

            const tempoParam = this.workletNode.parameters.get('tempo');
            const pitchParam = this.workletNode.parameters.get('pitch');

            if (tempoParam) tempoParam.value = tempo;
            if (pitchParam) pitchParam.value = pitchRatio;

            this.state.startTime = this.audioContext.currentTime;
            this.state.duration = duration;
            this.state.isPlaying = true;

            this._startTimeUpdate();

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
}
