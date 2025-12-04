import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { AudioEngine, PadParams as EnginePadParams } from '../lib/AudioEngine';
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

        setIsLoading(false);

        return () => {
            // AudioEngine cleanup handled internally
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

    const performAnalysis = async (file: File) => {
        try {
            const arrayBuffer = await file.arrayBuffer();

            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            const audioCtx = new AudioContextClass();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

            const pcmData = audioBuffer.getChannelData(0);
            const sampleRate = audioBuffer.sampleRate;

            const worker = new Worker(new URL('../workers/essentia.worker.js', import.meta.url));

            worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
                const { type, payload } = e.data;

                if (type === 'READY') {
                    worker.postMessage({
                        type: 'ANALYZE',
                        payload: {
                            pcm: pcmData,
                            originalSampleRate: sampleRate
                        }
                    }, [pcmData.buffer]);
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
            setDetectedBpm(null);
            setDetectedKey(null);
            setCurrentBpm(null);
            audioEngine.setGlobalSpeed(1.0);
            setGlobalKeyShift(0);

            await audioEngine.loadFromFile(file);
            const dur = audioEngine.getDuration();
            setDuration(dur);

            setPads(INITIAL_PADS.map(p => ({ ...p, cuePoint: null })));

            performAnalysis(file);

        } catch (error) {
            console.error('Failed to load audio file:', error);
            setIsAnalyzing(false);
            throw error;
        }
    };

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
    }), [
        duration, isPlaying, audioEngine, pads, selectedPadId,
        playMode, masterVolume, globalKeyShift, detectedBpm,
        detectedKey, currentBpm, isAnalyzing, keyMode, detectedKeyIndex
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
