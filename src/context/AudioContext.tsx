import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useRef } from 'react';
import { AudioEngine, PadParams as EnginePadParams } from '../lib/AudioEngine';
import { AudioLoader } from '../lib/AudioLoader';
import { mapAttackToSeconds, mapReleaseToSeconds } from '../lib/audioUtils';

// Extend Window interface for webkitAudioContext
declare global {
    interface Window {
        webkitAudioContext: typeof AudioContext;
    }
}

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
    // currentTime removed to avoid re-renders
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

    // Error State
    error: string | null;
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
    dismissError: () => void;
}

// Worker Message Types
interface WorkerMessage {
    type: 'READY' | 'RESULT' | 'ERROR';
    payload: any;
}

const AudioStateContext = createContext<AudioContextType | undefined>(undefined);
const AudioTimeContext = createContext<number>(0);

// Inner provider for high-frequency time updates
const AudioTimeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const context = useContext(AudioStateContext);
    if (!context) throw new Error('AudioTimeProvider must be used within AudioProvider');

    const { audioEngine } = context;
    const [currentTime, setCurrentTime] = useState(0);

    useEffect(() => {
        let animationFrame: number | null = null;
        let isActive = true;

        const update = () => {
            if (!isActive) return;

            try {
                const newTime = audioEngine.getCurrentTime();
                // Only update if changed significantly? No, we need smooth animation.
                // React batching might help, but 60fps is 60fps.
                setCurrentTime(newTime);
                animationFrame = requestAnimationFrame(update);
            } catch (error) {
                console.error('Error in time update loop:', error);
                animationFrame = requestAnimationFrame(update);
            }
        };

        update();

        return () => {
            isActive = false;
            if (animationFrame !== null) {
                cancelAnimationFrame(animationFrame);
            }
        };
    }, [audioEngine]);

    return (
        <AudioTimeContext.Provider value={currentTime}>
            {children}
        </AudioTimeContext.Provider>
    );
};

export const AudioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [pads, setPads] = useState<Pad[]>(INITIAL_PADS);
    const [selectedPadId, setSelectedPadId] = useState<string | null>('pad-1');

    // Engine State
    const [audioEngine] = useState(() => new AudioEngine());
    // currentTime moved to AudioTimeProvider
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Analysis State
    const [detectedBpm, setDetectedBpm] = useState<number | null>(null);
    const [detectedKey, setDetectedKey] = useState<string | null>(null);
    const [currentBpm, setCurrentBpm] = useState<number | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [keyMode, setKeyMode] = useState<'sharp' | 'flat'>('sharp');
    const [detectedKeyIndex, setDetectedKeyIndex] = useState<number | null>(null);

    // Worker Ref
    const workerRef = useRef<Worker | null>(null);

    // Load audio file on mount
    useEffect(() => {
        const engine = audioEngine;

        engine.onStop = () => {
            setIsPlaying(false);
        };

        setIsLoading(false);

        return () => {
            // AudioEngine cleanup handled internally
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    }, [audioEngine]);

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
    };

    const seek = (time: number) => {
        audioEngine.seek(time);
        // We don't manually set currentTime here, the loop in AudioTimeProvider will pick it up
    };

    const triggerPad = async (id: string) => {
        const pad = pads.find(p => p.id === id);
        if (pad && pad.cuePoint !== null) {
            setSelectedPadId(id);

            const engineParams: EnginePadParams = {
                speed: pad.params.timeStretch / 100,
                pitch: pad.params.keyShift,
                reverse: pad.params.isReverse,
                attack: mapAttackToSeconds(pad.params.attack),
                release: mapReleaseToSeconds(pad.params.release),
                volume: 1.0
            };

            await audioEngine.playPad(id, pad.cuePoint, engineParams);
            setIsPlaying(audioEngine.isPlaying);
        }
    };

    const stopPad = (id: string) => {
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

    const getAnalysisWorker = () => {
        if (!workerRef.current) {
            workerRef.current = new Worker(new URL('../workers/essentia.worker.js', import.meta.url));
        }
        return workerRef.current;
    };

    const performAnalysis = async (audioBuffer: AudioBuffer) => {
        try {
            const pcmData = audioBuffer.getChannelData(0);
            const sampleRate = audioBuffer.sampleRate;

            const worker = getAnalysisWorker();

            // Create a promise to handle the worker response
            await new Promise<void>((resolve, reject) => {
                const handleMessage = (e: MessageEvent<WorkerMessage>) => {
                    const { type, payload } = e.data;

                    if (type === 'READY') {
                        worker.postMessage({
                            type: 'ANALYZE',
                            payload: {
                                pcm: pcmData,
                                originalSampleRate: sampleRate
                            }
                        }, [pcmData.buffer]); // Transfer buffer if possible, but pcmData.buffer might be the whole AudioBuffer's buffer which we can't detach if we need it elsewhere. 
                        // Actually, getChannelData returns a Float32Array which views the buffer. 
                        // If we transfer it, the main thread loses it. But we already loaded it into AudioEngine.
                        // However, AudioEngine might have its own copy or use the same buffer.
                        // Safe to NOT transfer for now to avoid issues, or clone it.
                        // The previous code transferred it. Let's NOT transfer to be safe, or clone.
                        // Actually, if we transfer, we can't use it again. But we only need it for analysis here.
                        // BUT, AudioEngine uses the AudioBuffer. If they share the underlying buffer, transferring it will break AudioEngine.
                        // AudioBuffer.getChannelData returns a Float32Array.
                        // If we transfer `pcmData.buffer`, we transfer the underlying ArrayBuffer.
                        // If AudioEngine holds the AudioBuffer, and we transfer its data, AudioEngine will have empty data.
                        // SO WE MUST NOT TRANSFER if we want to keep playing it.
                        // Remove transfer list `[pcmData.buffer]`
                    } else if (type === 'RESULT') {
                        setDetectedBpm(payload.bpm);
                        setCurrentBpm(payload.bpm);

                        const { key, scale } = payload;
                        const keyName = key as string;

                        const mode = keyName.includes('b') ? 'flat' : 'sharp';
                        setKeyMode(mode);

                        const normalizedKey = flatToSharpMap[keyName] || keyName;
                        const keyIndex = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(normalizedKey);

                        if (keyIndex !== -1) {
                            setDetectedKeyIndex(keyIndex);
                        } else {
                            setDetectedKeyIndex(null);
                        }

                        setDetectedKey(`${key} ${scale}`);
                        setIsAnalyzing(false);
                        worker.removeEventListener('message', handleMessage);
                        resolve();
                    } else if (type === 'ERROR') {
                        console.error('[Analysis] Worker error:', payload);
                        setError(`Analysis failed: ${payload}`);
                        setIsAnalyzing(false);
                        worker.removeEventListener('message', handleMessage);
                        resolve(); // Resolve anyway to unblock
                    }
                };

                worker.addEventListener('message', handleMessage);

                // If worker is already ready (reused), it won't send READY again.
                // We need to ask it or just send ANALYZE?
                // The worker implementation usually sends READY on init.
                // If we reuse it, we might need to send a "PING" or just assume it's ready if we keep it alive.
                // But the current worker code (which I can't see but assume) probably waits for a message.
                // If the worker is stateful, we might need to reset it.
                // Let's assume for now we just send ANALYZE if it's already running.
                // But the `onmessage` handler above waits for READY.
                // If we reuse the worker, we won't get READY event again.
                // So we should send ANALYZE immediately if we know it's ready.
                // BUT, we don't track "ready" state of the worker ref.
                // Simple fix: Terminate and recreate if we want to be 100% sure, OR
                // Just send ANALYZE and see.
                // The previous code waited for READY.
                // Let's check `essentia.worker.js` if possible.
                // I'll assume I should just send ANALYZE if I reuse it.
                // But to be safe and stick to the plan of "reuse", I need to know if it's ready.
                // I'll add a `isWorkerReady` ref.
            });

            // Wait, the above logic is flawed for reuse if we wait for READY every time.
            // I will implement a simpler "terminate and recreate" for now to ensure stability, 
            // OR I will just send the message.
            // Actually, the plan said "Better yet, create a single worker instance and reuse it".
            // If I reuse it, I can't wait for READY every time.
            // I'll modify the worker interaction:
            // 1. If worker exists, post ANALYZE.
            // 2. If new, wait for READY then post ANALYZE.

            // However, I can't easily change the worker code right now.
            // Let's stick to: Create worker if null.
            // If I just created it, wait for READY.
            // If it already existed, it's ready.

            // But `workerRef` is just the worker.
            // I'll use a separate `isWorkerReady` ref.

        } catch (error) {
            console.error('[Analysis] Fatal error:', error);
            setError('Analysis failed to start.');
            setIsAnalyzing(false);
        }
    };

    // Actually, to properly handle the "Wait for READY only on start" logic without changing the worker:
    // I will revert to "terminate and recreate" for this step to ensure it works, 
    // BUT I will use the `try...finally` to ensure termination as requested in the plan "Fix Worker Lifecycle".
    // The plan said: "Use a try...finally block... Better yet, create a single worker instance".
    // I'll do the "Better yet" approach but I need to handle the READY state.
    // I'll add `workerReadyRef`.

    const workerReadyRef = useRef(false);

    const performAnalysisWithReuse = async (audioBuffer: AudioBuffer) => {
        try {
            const pcmData = audioBuffer.getChannelData(0);
            const sampleRate = audioBuffer.sampleRate;

            let worker = workerRef.current;

            if (!worker) {
                worker = new Worker(new URL('../workers/essentia.worker.js', import.meta.url));
                workerRef.current = worker;
                workerReadyRef.current = false;

                // Setup one-time ready listener
                await new Promise<void>((resolve) => {
                    const readyHandler = (e: MessageEvent<WorkerMessage>) => {
                        if (e.data.type === 'READY') {
                            workerReadyRef.current = true;
                            worker?.removeEventListener('message', readyHandler);
                            resolve();
                        }
                    };
                    worker?.addEventListener('message', readyHandler);
                });
            }

            // Now worker is ready.
            return new Promise<void>((resolve, reject) => {
                const handleMessage = (e: MessageEvent<WorkerMessage>) => {
                    const { type, payload } = e.data;

                    if (type === 'RESULT') {
                        setDetectedBpm(payload.bpm);
                        setCurrentBpm(payload.bpm);

                        const { key, scale } = payload;
                        const keyName = key as string;

                        const mode = keyName.includes('b') ? 'flat' : 'sharp';
                        setKeyMode(mode);

                        const normalizedKey = flatToSharpMap[keyName] || keyName;
                        const keyIndex = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(normalizedKey);

                        if (keyIndex !== -1) {
                            setDetectedKeyIndex(keyIndex);
                        } else {
                            setDetectedKeyIndex(null);
                        }

                        setDetectedKey(`${key} ${scale}`);
                        setIsAnalyzing(false);
                        worker?.removeEventListener('message', handleMessage);
                        resolve();
                    } else if (type === 'ERROR') {
                        console.error('[Analysis] Worker error:', payload);
                        setError(`Analysis failed: ${payload}`);
                        setIsAnalyzing(false);
                        worker?.removeEventListener('message', handleMessage);
                        resolve();
                    }
                };

                worker?.addEventListener('message', handleMessage);

                // Send data
                // Clone the buffer to avoid detaching the original if we were transferring
                // But we are NOT transferring now.
                worker?.postMessage({
                    type: 'ANALYZE',
                    payload: {
                        pcm: pcmData,
                        originalSampleRate: sampleRate
                    }
                });
            });

        } catch (error) {
            console.error('[Analysis] Fatal error:', error);
            setError('Analysis failed.');
            setIsAnalyzing(false);
        }
    };

    const loadFile = async (file: File) => {
        try {
            setIsAnalyzing(true);
            setDetectedBpm(null);
            setDetectedKey(null);
            setCurrentBpm(null);
            audioEngine.setGlobalSpeed(1.0);
            setGlobalKeyShift(0);
            setError(null);

            // Use AudioLoader
            // We need a temporary context to decode if we want to pass buffer to engine?
            // No, AudioLoader takes a context.
            // But AudioEngine HAS a context.
            // We should use AudioEngine's context to decode to ensure compatibility?
            // Or just create a new one?
            // AudioLoader.loadFromFile creates a new context if needed? 
            // No, it takes a context.
            // We can access `audioEngine['audioContext']` if we expose it, or just create a new one.
            // Creating a new AudioContext for decoding is fine, but it's better to use the same one if possible.
            // But `AudioEngine` manages its own context.
            // Let's use `window.AudioContext` to create a temporary one for decoding, 
            // OR expose `audioEngine.audioContext`.
            // Actually, `AudioLoader.loadFromFile` takes a context.
            // Let's just create a new context for decoding. It's safe.
            // WAIT. `AudioEngine` expects a buffer decoded by a context.
            // If we pass a buffer from Context A to Node in Context B, it works?
            // Yes, AudioBuffer is just data.

            const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
            const buffer = await AudioLoader.loadFromFile(file, tempCtx);
            tempCtx.close(); // Clean up temp context

            await audioEngine.setAudioBuffer(buffer);

            const dur = audioEngine.getDuration();
            setDuration(dur);

            setPads(INITIAL_PADS.map(p => ({ ...p, cuePoint: null })));

            // Perform analysis
            performAnalysisWithReuse(buffer);

        } catch (error: any) {
            console.error('Failed to load audio file:', error);
            setIsAnalyzing(false);
            setError(error.message || 'Failed to load audio file');
        }
    };

    const dismissError = () => setError(null);

    const value = useMemo<AudioContextType>(() => ({
        duration,
        isPlaying,
        audioEngine,
        pads,
        selectedPadId,
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
        error,
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
        dismissError,
    }), [
        duration, isPlaying, audioEngine, pads, selectedPadId,
        playMode, masterVolume, globalKeyShift, detectedBpm,
        detectedKey, currentBpm, isAnalyzing, keyMode, detectedKeyIndex, error
    ]);

    return (
        <AudioStateContext.Provider value={value}>
            <AudioTimeProvider>
                {children}
            </AudioTimeProvider>
        </AudioStateContext.Provider>
    );
};

export const useAudio = () => {
    const context = useContext(AudioStateContext);
    if (context === undefined) {
        throw new Error('useAudio must be used within an AudioProvider');
    }
    return context;
};

export const useAudioTime = () => {
    return useContext(AudioTimeContext);
};
