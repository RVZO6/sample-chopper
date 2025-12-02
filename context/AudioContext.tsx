import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { AudioEngine, PadParams as EnginePadParams } from '../src/lib/AudioEngine';

export interface PadParams {
    attack: number;
    release: number;
    timeStretch: number;
    keyShift: number;
    isReverse: boolean;
}

export interface Pad {
    id: string;
    label: string;
    color: string;
    cuePoint: number | null;
    key: string;
    params: PadParams;
}

const DEFAULT_PARAMS: PadParams = {
    attack: 0,
    release: 30,
    timeStretch: 100,
    keyShift: 0,
    isReverse: false,
};

// Initial Pad Configuration
const INITIAL_PADS: Pad[] = [
    // Row 1
    { id: 'pad-1', label: 'Q', key: 'KeyQ', color: 'bg-red-700', cuePoint: null, params: { ...DEFAULT_PARAMS } },
    { id: 'pad-2', label: 'W', key: 'KeyW', color: 'bg-yellow-600', cuePoint: null, params: { ...DEFAULT_PARAMS } },
    { id: 'pad-3', label: 'E', key: 'KeyE', color: 'bg-fuchsia-700', cuePoint: null, params: { ...DEFAULT_PARAMS } },
    { id: 'pad-4', label: 'R', key: 'KeyR', color: 'bg-orange-600', cuePoint: null, params: { ...DEFAULT_PARAMS } },
    { id: 'pad-5', label: 'T', key: 'KeyT', color: 'bg-green-600', cuePoint: null, params: { ...DEFAULT_PARAMS } },
    // Row 2
    { id: 'pad-6', label: 'A', key: 'KeyA', color: 'bg-yellow-500', cuePoint: null, params: { ...DEFAULT_PARAMS } },
    { id: 'pad-7', label: 'S', key: 'KeyS', color: 'bg-red-800', cuePoint: null, params: { ...DEFAULT_PARAMS } },
    { id: 'pad-8', label: 'D', key: 'KeyD', color: 'bg-green-700', cuePoint: null, params: { ...DEFAULT_PARAMS } },
    { id: 'pad-9', label: 'F', key: 'KeyF', color: 'bg-surface-dark', cuePoint: null, params: { ...DEFAULT_PARAMS } },
    { id: 'pad-10', label: 'G', key: 'KeyG', color: 'bg-red-600', cuePoint: null, params: { ...DEFAULT_PARAMS } },
    // Row 3
    { id: 'pad-11', label: 'Z', key: 'KeyZ', color: 'bg-green-500', cuePoint: null, params: { ...DEFAULT_PARAMS } },
    { id: 'pad-12', label: 'X', key: 'KeyX', color: 'bg-surface-dark', cuePoint: null, params: { ...DEFAULT_PARAMS } },
    { id: 'pad-13', label: 'C', key: 'KeyC', color: 'bg-surface-dark', cuePoint: null, params: { ...DEFAULT_PARAMS } },
    { id: 'pad-14', label: 'V', key: 'KeyV', color: 'bg-surface-dark', cuePoint: null, params: { ...DEFAULT_PARAMS } },
    { id: 'pad-15', label: 'B', key: 'KeyB', color: 'bg-red-900', cuePoint: null, params: { ...DEFAULT_PARAMS } },
    // Row 4
    { id: 'pad-16', label: 'Y', key: 'KeyY', color: 'bg-surface-dark', cuePoint: null, params: { ...DEFAULT_PARAMS } },
    { id: 'pad-17', label: 'U', key: 'KeyU', color: 'bg-surface-dark', cuePoint: null, params: { ...DEFAULT_PARAMS } },
    { id: 'pad-18', label: 'I', key: 'KeyI', color: 'bg-surface-dark', cuePoint: null, params: { ...DEFAULT_PARAMS } },
    { id: 'pad-19', label: 'O', key: 'KeyO', color: 'bg-surface-dark', cuePoint: null, params: { ...DEFAULT_PARAMS } },
    { id: 'pad-20', label: 'P', key: 'KeyP', color: 'bg-surface-dark', cuePoint: null, params: { ...DEFAULT_PARAMS } },
];

const flatToSharpMap: { [key: string]: string } = {
    'Db': 'C#',
    'Eb': 'D#',
    'Gb': 'F#',
    'Ab': 'G#',
    'Bb': 'A#',
};

interface AudioState {
    // Engine State
    currentTime: number;
    duration: number;
    isPlaying: boolean;
    audioEngine: AudioEngine;

    // Pads
    pads: Pad[];
    selectedPadId: string | null;

    // Analysis State
    detectedBpm: number | null;
    detectedKey: string | null;
    currentBpm: number | null;
    isAnalyzing: boolean;
    keyMode: 'sharp' | 'flat';
    detectedKeyIndex: number | null;
}

interface AudioContextType extends AudioState {
    // Global Controls
    playMode: 'gate' | 'trigger';
    setPlayMode: (mode: 'gate' | 'trigger') => void;
    masterVolume: number;
    setMasterVolume: (volume: number) => void;
    globalKeyShift: number;
    setGlobalKeyShift: (shift: number) => void;
    setBpm: (bpm: number) => void;
    keyMode: 'sharp' | 'flat';
    detectedKeyIndex: number | null;

    // Transport
    play: () => void;
    pause: () => void;
    seek: (time: number) => void;

    // Pad Actions
    triggerPad: (id: string) => void;
    stopPad: (id: string) => void;
    setPadCuePoint: (id: string, time: number) => void;
    clearPad: (id: string) => void;
    selectPad: (id: string) => void;

    // Param Updates (for selected pad)
    updateSelectedPadParams: (params: Partial<PadParams>) => void;

    // File Loading
    loadFile: (file: File) => Promise<void>;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [pads, setPads] = useState<Pad[]>(INITIAL_PADS);
    const [selectedPadId, setSelectedPadId] = useState<string | null>('pad-1');

    // Engine State
    const [audioEngine] = useState(() => new AudioEngine());
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    // Analysis State
    const [detectedBpm, setDetectedBpm] = useState<number | null>(null);
    const [detectedKey, setDetectedKey] = useState<string | null>(null);
    const [currentBpm, setCurrentBpm] = useState<number | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [keyMode, setKeyMode] = useState<'sharp' | 'flat'>('sharp');
    const [detectedKeyIndex, setDetectedKeyIndex] = useState<number | null>(null);

    // Load audio file on mount
    useEffect(() => {
        const engine = audioEngine;

        engine.onStop = () => {
            setIsPlaying(false);
        };

        // Don't load default file - wait for user to upload
        // User will upload their own audio file via the upload modal
        setIsLoading(false);

        // Cleanup on unmount
        return () => {
            // AudioEngine cleanup handled internally
        };
    }, [audioEngine]);

    // Update current time continuously (for both main transport and pad playback)
    useEffect(() => {
        let animationFrame: number | null = null;
        let isActive = true;

        const update = () => {
            if (!isActive) {
                if (animationFrame !== null) {
                    cancelAnimationFrame(animationFrame);
                }
                return;
            }

            try {
                // Update current time - returns position based on what's playing
                const newTime = audioEngine.getCurrentTime();
                setCurrentTime(newTime);

                // Update playing state - check engine state directly
                const playing = audioEngine.isPlaying;
                setIsPlaying(playing);

                // Always continue the loop to ensure smooth updates
                // Even when not playing, we still need to update for seek operations
                animationFrame = requestAnimationFrame(update);
            } catch (error) {
                console.error('Error in time update loop:', error);
                // Continue loop even on error to prevent it from stopping
                animationFrame = requestAnimationFrame(update);
            }
        };

        // Start the update loop immediately
        update();

        return () => {
            isActive = false;
            if (animationFrame !== null) {
                cancelAnimationFrame(animationFrame);
            }
        };
    }, [audioEngine]);

    // NOTE: No longer applying selected pad params to engine globally
    // Each pad now has its own player instance with independent parameters

    // Global Settings
    const [playMode, setPlayMode] = useState<'gate' | 'trigger'>('trigger');
    const [masterVolume, setMasterVolume] = useState(75);
    const [globalKeyShift, setGlobalKeyShift] = useState(0);

    // Update Engine Global Settings
    useEffect(() => {
        audioEngine.setMasterVolume(masterVolume / 100);
    }, [masterVolume, audioEngine]);

    useEffect(() => {
        audioEngine.setGlobalPitchOffset(globalKeyShift);
    }, [globalKeyShift, audioEngine]);

    const setBpm = (bpm: number) => {
        setCurrentBpm(bpm);
        if (detectedBpm) {
            const speed = bpm / detectedBpm;
            audioEngine.setGlobalSpeed(speed);
        }
    };

    const play = async () => {
        await audioEngine.play();
        setIsPlaying(audioEngine.isPlaying);
    };

    const pause = () => {
        audioEngine.pause();
        setIsPlaying(audioEngine.isPlaying);
        setCurrentTime(audioEngine.getCurrentTime());
    };

    const seek = (time: number) => {
        audioEngine.seek(time);
        setCurrentTime(time);
    };

    const triggerPad = async (id: string) => {
        const pad = pads.find(p => p.id === id);
        if (pad && pad.cuePoint !== null) {
            setSelectedPadId(id); // Select on trigger

            // Convert pad params to engine params
            const engineParams: EnginePadParams = {
                speed: pad.params.timeStretch / 100,
                pitch: pad.params.keyShift,
                reverse: pad.params.isReverse,
                attack: pad.params.attack / 1000, // Convert ms to seconds (assuming input is ms?)
                // Wait, ControlPanel uses 0-100? No, let's check ControlPanel default.
                // ControlPanel defaults: attack 0, release 30.
                // Usually these are ms or arbitrary 0-100.
                // Let's assume they are milliseconds for now, or small seconds?
                // If attack is 0-100, 100ms is 0.1s.
                // Let's assume the knob returns 0-100 and we treat it as 0-2s?
                // Or just ms. 100ms is short.
                // Let's assume 0-100 maps to 0-1s for now?
                // Actually, let's check ControlPanel again. It just passes the value.
                // Let's assume the value is in "units" and we convert here.
                // Let's map 0-100 to 0-2 seconds.
                release: pad.params.release / 50, // 30 -> 0.6s
                volume: 1.0 // Pad volume not yet in UI, default to 1
            };

            // Actually, let's look at the Knob.
            // If the user sets attack to 50, that's a lot if it's seconds.
            // Let's treat 0-100 as 0-1000ms (0-1s) for attack, and maybe 0-2000ms for release?
            // Let's try: value / 100 * 2 (0-2 seconds)
            engineParams.attack = (pad.params.attack / 100) * 2;
            engineParams.release = (pad.params.release / 100) * 5; // 0-5 seconds release

            // Play this specific pad with its parameters
            await audioEngine.playPad(id, pad.cuePoint, engineParams);

            setIsPlaying(audioEngine.isPlaying);
            setCurrentTime(audioEngine.getCurrentTime());
        }
    };

    const stopPad = (id: string) => {
        // Only stop if the current pad is the one being released (or all pads?)
        // AudioEngine is monophonic for pads, so stopPad() stops whatever is playing.
        // But we should check if we are in Gate mode?
        // No, stopPad is called by UI when it wants to stop.
        // We should check if the stopped pad is the one playing?
        // AudioEngine.stopPad() handles logic.
        audioEngine.stopPad();
    };

    const setPadCuePoint = (id: string, time: number) => {
        setPads(prev => prev.map(p =>
            p.id === id ? { ...p, cuePoint: time } : p
        ));
        setSelectedPadId(id);
    };

    const clearPad = (id: string) => {
        setPads(prev => prev.map(p =>
            p.id === id ? { ...p, cuePoint: null } : p
        ));
    };

    const selectPad = (id: string) => {
        setSelectedPadId(id);
    };

    const updateSelectedPadParams = (updates: Partial<PadParams>) => {
        if (!selectedPadId) return;
        setPads(prev => prev.map(p =>
            p.id === selectedPadId
                ? { ...p, params: { ...p.params, ...updates } }
                : p
        ));
    };

    const performAnalysis = async (file: File) => {
        try {
            console.log('[Analysis] Starting audio analysis...');
            const arrayBuffer = await file.arrayBuffer();

            // Decode on main thread (async) - this is the only way without extra libs
            // We avoid OfflineAudioContext resampling here to prevent blocking
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            console.log('[Analysis] Audio decoded, duration:', audioBuffer.duration);

            // Get mono data
            const pcmData = audioBuffer.getChannelData(0);
            const sampleRate = audioBuffer.sampleRate;

            // Create worker
            const worker = new Worker(new URL('../src/workers/essentia.worker.js', import.meta.url));

            worker.onmessage = (e) => {
                const { type, payload } = e.data;
                console.log('[Analysis] Worker message:', type);

                if (type === 'READY') {
                    console.log('[Analysis] Worker ready, sending PCM data...');
                    // Transfer the PCM data to worker (zero-copy)
                    worker.postMessage({
                        type: 'ANALYZE',
                        payload: {
                            pcm: pcmData,
                            originalSampleRate: sampleRate
                        }
                    }, [pcmData.buffer]); // Transfer ownership
                } else if (type === 'RESULT') {
                    console.log('[Analysis] Analysis complete!', payload);
                    setDetectedBpm(payload.bpm);
                    setCurrentBpm(payload.bpm);

                    const { key, scale } = payload;
                    const keyName = key as string;

                    // Determine mode
                    const mode = keyName.includes('b') ? 'flat' : 'sharp';
                    setKeyMode(mode);

                    // Normalize to find index
                    const normalizedKey = flatToSharpMap[keyName] || keyName;
                    const keyIndex = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(normalizedKey);

                    if (keyIndex !== -1) {
                        setDetectedKeyIndex(keyIndex);
                    } else {
                        setDetectedKeyIndex(null);
                    }

                    setDetectedKey(`${key} ${scale}`);
                    setIsAnalyzing(false);
                    worker.terminate();
                } else if (type === 'ERROR') {
                    console.error('[Analysis] Worker error:', payload);
                    setIsAnalyzing(false);
                    worker.terminate();
                }
            };
        } catch (error) {
            console.error('[Analysis] Fatal error:', error);
            setIsAnalyzing(false);
        }
    };

    const loadFile = async (file: File) => {
        try {
            setIsAnalyzing(true);
            // Reset Analysis State
            setDetectedBpm(null);
            setDetectedKey(null);
            setCurrentBpm(null);
            audioEngine.setGlobalSpeed(1.0);
            setGlobalKeyShift(0);

            // Load for playback (Blocking for UI modal close if we want, but usually fast)
            await audioEngine.loadFromFile(file);
            const dur = audioEngine.getDuration();
            setDuration(dur);
            setCurrentTime(0);
            // Clear all pads when loading new audio
            setPads(INITIAL_PADS.map(p => ({ ...p, cuePoint: null })));

            // Trigger Analysis (Non-blocking)
            performAnalysis(file);

        } catch (error) {
            console.error('Failed to load audio file:', error);
            setIsAnalyzing(false);
            throw error;
        }
    };

    const value = {
        currentTime,
        duration,
        isPlaying,
        audioEngine,
        pads,
        selectedPadId,

        // Global Settings
        playMode,
        setPlayMode,
        masterVolume,
        setMasterVolume,
        globalKeyShift,
        setGlobalKeyShift,
        detectedBpm,
        detectedKey,
        currentBpm,
        setBpm,
        isAnalyzing,
        keyMode,
        detectedKeyIndex,

        play,
        pause,
        seek,
        triggerPad,
        stopPad,
        setPadCuePoint,
        clearPad,
        selectPad,
        updateSelectedPadParams,
        loadFile,
    };

    return (
        <AudioContext.Provider value={value}>
            {children}
        </AudioContext.Provider>
    );
};

export const useAudio = () => {
    const context = useContext(AudioContext);
    if (context === undefined) {
        throw new Error('useAudio must be used within an AudioProvider');
    }
    return context;
};
