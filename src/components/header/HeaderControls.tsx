import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RiContractRightFill, RiArrowRightFill, RiVolumeUpFill } from 'react-icons/ri';
import { BPM_MIN, BPM_MAX, DRAG_SENSITIVITY_PX, EDIT_MODE_DELAY_MS } from '@/config/constants';

const KEYS_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const KEYS_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

interface HeaderControlsProps {
    // Key control
    detectedKeyIndex: number | null;
    globalKeyShift: number;
    onKeyShiftChange: (shift: number) => void;
    keyMode: 'sharp' | 'flat';
    // BPM control
    currentBpm: number | null;
    detectedBpm: number | null;
    onBpmChange: (bpm: number) => void;
    isAnalyzing: boolean;
    // Transport controls
    playMode: 'gate' | 'trigger';
    setPlayMode: (mode: 'gate' | 'trigger') => void;
    masterVolume: number;
    setMasterVolume: (volume: number) => void;
}

export const HeaderControls: React.FC<HeaderControlsProps> = ({
    detectedKeyIndex,
    globalKeyShift,
    onKeyShiftChange,
    keyMode,
    currentBpm,
    detectedBpm,
    onBpmChange,
    isAnalyzing,
    playMode,
    setPlayMode,
    masterVolume,
    setMasterVolume
}) => {
    // ========== Key Control State ==========
    const [isKeyDragging, setIsKeyDragging] = useState(false);
    const [isKeyEditing, setIsKeyEditing] = useState(false);
    const [keyInputValue, setKeyInputValue] = useState('');
    const keyInputRef = useRef<HTMLInputElement>(null);
    const startKeyShiftRef = useRef(0);
    const startKeyYRef = useRef(0);
    const isKeyClickRef = useRef(true);
    const keyEditTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ========== BPM Control State ==========
    const [isBpmDragging, setIsBpmDragging] = useState(false);
    const [isBpmEditing, setIsBpmEditing] = useState(false);
    const [bpmInputValue, setBpmInputValue] = useState('');
    const bpmInputRef = useRef<HTMLInputElement>(null);
    const startBpmRef = useRef(0);
    const startBpmYRef = useRef(0);
    const isBpmClickRef = useRef(true);
    const bpmEditTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Focus inputs when editing
    useEffect(() => {
        if (isKeyEditing && keyInputRef.current) {
            keyInputRef.current.focus();
            keyInputRef.current.select();
        }
    }, [isKeyEditing]);

    useEffect(() => {
        if (isBpmEditing && bpmInputRef.current) {
            bpmInputRef.current.focus();
            bpmInputRef.current.select();
        }
    }, [isBpmEditing]);

    // ========== Key Control Handlers ==========
    const keyDragControllerRef = useRef<AbortController | null>(null);

    const handleKeyMouseDown = useCallback((e: React.MouseEvent) => {
        if (isKeyEditing || detectedKeyIndex === null) return;
        if (e.detail === 2) {
            // Clear any pending edit timeout on double-click
            if (keyEditTimeoutRef.current) {
                clearTimeout(keyEditTimeoutRef.current);
                keyEditTimeoutRef.current = null;
            }
            return;
        }

        e.preventDefault();
        startKeyShiftRef.current = globalKeyShift;
        startKeyYRef.current = e.clientY;
        isKeyClickRef.current = true;

        // Abort any existing drag listeners
        keyDragControllerRef.current?.abort();
        keyDragControllerRef.current = new AbortController();
        const signal = keyDragControllerRef.current.signal;

        const handleMouseMove = (ev: MouseEvent) => {
            const deltaY = startKeyYRef.current - ev.clientY;
            if (Math.abs(deltaY) > 2) {
                isKeyClickRef.current = false;
                setIsKeyDragging(true);
            }
            // Sensitivity: DRAG_SENSITIVITY_PX per semitone
            const steps = Math.floor(deltaY / DRAG_SENSITIVITY_PX);
            onKeyShiftChange(startKeyShiftRef.current + steps);
        };

        const handleMouseUp = () => {
            setIsKeyDragging(false);
            keyDragControllerRef.current?.abort();

            if (isKeyClickRef.current) {
                // Delay entering edit mode to allow double-click to fire
                keyEditTimeoutRef.current = setTimeout(() => {
                    setIsKeyEditing(true);
                    setKeyInputValue(String(globalKeyShift));
                }, EDIT_MODE_DELAY_MS);
            }
        };

        window.addEventListener('mousemove', handleMouseMove, { signal });
        window.addEventListener('mouseup', handleMouseUp, { signal });
    }, [isKeyEditing, detectedKeyIndex, globalKeyShift, onKeyShiftChange]);

    // Cleanup key drag listeners on unmount
    useEffect(() => {
        return () => {
            keyDragControllerRef.current?.abort();
            if (keyEditTimeoutRef.current) {
                clearTimeout(keyEditTimeoutRef.current);
            }
        };
    }, []);

    const handleKeyDoubleClick = () => {
        // Cancel pending edit mode
        if (keyEditTimeoutRef.current) {
            clearTimeout(keyEditTimeoutRef.current);
            keyEditTimeoutRef.current = null;
        }
        onKeyShiftChange(0); // Reset to 0
    };

    const handleKeyInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            const val = parseInt(keyInputValue);
            if (!isNaN(val)) {
                onKeyShiftChange(val);
            }
            setIsKeyEditing(false);
        } else if (e.key === 'Escape') {
            setIsKeyEditing(false);
        }
    };

    const handleKeyInputBlur = () => {
        const val = parseInt(keyInputValue);
        if (!isNaN(val)) {
            onKeyShiftChange(val);
        }
        setIsKeyEditing(false);
    };

    // ========== BPM Control Handlers ==========
    const bpmDragControllerRef = useRef<AbortController | null>(null);

    const handleBpmMouseDown = useCallback((e: React.MouseEvent) => {
        if (isBpmEditing || !currentBpm) return;
        if (e.detail === 2) {
            // Clear any pending edit timeout on double-click
            if (bpmEditTimeoutRef.current) {
                clearTimeout(bpmEditTimeoutRef.current);
                bpmEditTimeoutRef.current = null;
            }
            return;
        }

        e.preventDefault();
        startBpmRef.current = currentBpm;
        startBpmYRef.current = e.clientY;
        isBpmClickRef.current = true;

        // Abort any existing drag listeners
        bpmDragControllerRef.current?.abort();
        bpmDragControllerRef.current = new AbortController();
        const signal = bpmDragControllerRef.current.signal;

        const handleMouseMove = (ev: MouseEvent) => {
            const deltaY = startBpmYRef.current - ev.clientY;
            if (Math.abs(deltaY) > 2) {
                isBpmClickRef.current = false;
                setIsBpmDragging(true);
            }
            // Sensitivity: DRAG_SENSITIVITY_PX per BPM
            const steps = deltaY / DRAG_SENSITIVITY_PX;
            const newBpm = Math.max(BPM_MIN, Math.min(BPM_MAX, startBpmRef.current + steps));
            onBpmChange(newBpm);
        };

        const handleMouseUp = () => {
            setIsBpmDragging(false);
            bpmDragControllerRef.current?.abort();

            if (isBpmClickRef.current) {
                // Delay entering edit mode to allow double-click to fire
                bpmEditTimeoutRef.current = setTimeout(() => {
                    setIsBpmEditing(true);
                    setBpmInputValue(currentBpm.toFixed(2));
                }, EDIT_MODE_DELAY_MS);
            }
        };

        window.addEventListener('mousemove', handleMouseMove, { signal });
        window.addEventListener('mouseup', handleMouseUp, { signal });
    }, [isBpmEditing, currentBpm, onBpmChange]);

    // Cleanup BPM drag listeners on unmount
    useEffect(() => {
        return () => {
            bpmDragControllerRef.current?.abort();
            if (bpmEditTimeoutRef.current) {
                clearTimeout(bpmEditTimeoutRef.current);
            }
        };
    }, []);

    const handleBpmDoubleClick = () => {
        // Cancel pending edit mode
        if (bpmEditTimeoutRef.current) {
            clearTimeout(bpmEditTimeoutRef.current);
            bpmEditTimeoutRef.current = null;
        }
        if (detectedBpm) {
            onBpmChange(detectedBpm);
        }
    };

    const validateAndUpdateBpm = (valueStr: string) => {
        const val = parseFloat(valueStr);
        if (!isNaN(val) && val >= BPM_MIN && val <= BPM_MAX) {
            onBpmChange(val);
        }
        setIsBpmEditing(false);
    };

    const handleBpmInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            validateAndUpdateBpm(bpmInputValue);
        } else if (e.key === 'Escape') {
            setIsBpmEditing(false);
        }
    };

    const handleBpmInputBlur = () => {
        validateAndUpdateBpm(bpmInputValue);
    };

    // ========== Computed Values ==========
    const keys = keyMode === 'sharp' ? KEYS_SHARP : KEYS_FLAT;
    let noteName = '--';
    if (detectedKeyIndex !== null) {
        const currentKeyIndex = ((detectedKeyIndex + globalKeyShift) % 12 + 12) % 12;
        noteName = keys[currentKeyIndex];
    }
    const sign = globalKeyShift > 0 ? '+' : '';
    const offsetText = detectedKeyIndex !== null ? `${sign}${globalKeyShift}` : '-';

    const keyBaseColor = detectedKeyIndex !== null ? 'text-gray-200' : 'text-gray-600';
    const bpmBaseColor = currentBpm ? 'text-gray-200' : 'text-gray-600';

    return (
        <div className="flex items-center gap-4">
            {/* Key Control */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 select-none">KEY</span>
                <div
                    onMouseDown={handleKeyMouseDown}
                    onDoubleClick={handleKeyDoubleClick}
                    className={`group bg-background-dark rounded-sm w-20 h-8 px-2 flex items-center justify-between font-semibold shadow-ui-element-inset transition-colors 
                        ${detectedKeyIndex !== null ? 'cursor-ns-resize' : 'cursor-not-allowed opacity-50'}`}
                    title={detectedKeyIndex !== null ? "Click to edit, Drag to change, Double-click to reset" : "Upload file to enable"}
                >
                    <span className={`text-base text-left font-mono ${keyBaseColor} ${detectedKeyIndex !== null ? 'group-hover:text-primary' : ''} ${isKeyDragging ? 'text-primary' : ''}`}>{noteName}</span>
                    {isKeyEditing ? (
                        <input
                            ref={keyInputRef}
                            type="text"
                            value={keyInputValue}
                            onChange={(e) => setKeyInputValue(e.target.value)}
                            onKeyDown={handleKeyInputKeyDown}
                            onBlur={handleKeyInputBlur}
                            className={`w-8 h-full bg-transparent text-right text-xs font-mono outline-none ${keyBaseColor}`}
                        />
                    ) : (
                        <span className={`text-xs text-right font-mono text-gray-500 ${detectedKeyIndex !== null ? 'group-hover:text-primary/70' : ''} ${isKeyDragging ? 'text-primary/70' : ''}`}>{offsetText}</span>
                    )}
                </div>
            </div>

            {/* BPM Control */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 select-none">BPM</span>
                <div
                    onMouseDown={handleBpmMouseDown}
                    onDoubleClick={handleBpmDoubleClick}
                    className={`group bg-background-dark rounded-sm w-16 h-8 px-1 flex items-center justify-center font-semibold shadow-ui-element-inset transition-colors 
                        ${currentBpm ? 'cursor-ns-resize' : 'cursor-not-allowed opacity-50'}`}
                    title={currentBpm ? "Click to edit, Drag to change, Double-click to reset" : "Upload file to enable"}
                >
                    {isBpmEditing ? (
                        <input
                            ref={bpmInputRef}
                            type="text"
                            value={bpmInputValue}
                            onChange={(e) => setBpmInputValue(e.target.value)}
                            onKeyDown={handleBpmInputKeyDown}
                            onBlur={handleBpmInputBlur}
                            className={`w-full h-full bg-transparent text-center text-base font-mono outline-none ${bpmBaseColor}`}
                        />
                    ) : (
                        <span className={`text-base font-mono select-none ${bpmBaseColor} ${currentBpm ? 'group-hover:text-primary' : ''} ${isBpmDragging ? 'text-primary' : ''}`}>
                            {isAnalyzing ? '--' : (currentBpm ? currentBpm.toFixed(2) : '--')}
                        </span>
                    )}
                </div>
            </div>

            {/* Play Mode */}
            <div className="flex items-center gap-1 bg-background-dark rounded-sm p-1 shadow-ui-element-inset">
                <button
                    onClick={() => setPlayMode('gate')}
                    className={`p-1 rounded-sm transition-all flex items-center justify-center ${playMode === 'gate' ? 'text-primary bg-surface-light shadow-ui-element-raised' : 'text-gray-500 hover:text-white hover:bg-surface-light active:shadow-ui-element-pressed'}`}
                    title="Gate Mode"
                >
                    <RiContractRightFill className="text-xl" />
                </button>
                <button
                    onClick={() => setPlayMode('trigger')}
                    className={`p-1 rounded-sm transition-all flex items-center justify-center ${playMode === 'trigger' ? 'text-primary bg-surface-light shadow-ui-element-raised' : 'text-gray-500 hover:text-white hover:bg-surface-light active:shadow-ui-element-pressed'}`}
                    title="Trigger Mode"
                >
                    <RiArrowRightFill className="text-xl" />
                </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2 w-48">
                <RiVolumeUpFill className="text-lg text-gray-400" />
                <input
                    className="w-full h-1.5 bg-surface-light rounded-lg appearance-none cursor-pointer shadow-ui-element-inset [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                    type="range"
                    min="0"
                    max="100"
                    value={masterVolume}
                    onChange={(e) => setMasterVolume(parseInt(e.target.value))}
                />
            </div>
        </div>
    );
};
