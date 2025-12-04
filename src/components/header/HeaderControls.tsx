import React, { useState, useRef, useEffect } from 'react';

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
    const handleKeyMouseDown = (e: React.MouseEvent) => {
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

        const handleMouseMove = (ev: MouseEvent) => {
            const deltaY = startKeyYRef.current - ev.clientY;
            if (Math.abs(deltaY) > 2) {
                isKeyClickRef.current = false;
                setIsKeyDragging(true);
            }
            // Sensitivity: 3px per semitone
            const steps = Math.floor(deltaY / 3);
            onKeyShiftChange(startKeyShiftRef.current + steps);
        };

        const handleMouseUp = () => {
            setIsKeyDragging(false);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);

            if (isKeyClickRef.current) {
                // Delay entering edit mode to allow double-click to fire
                keyEditTimeoutRef.current = setTimeout(() => {
                    setIsKeyEditing(true);
                    setKeyInputValue(String(globalKeyShift));
                }, 100);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

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
    const handleBpmMouseDown = (e: React.MouseEvent) => {
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

        const handleMouseMove = (ev: MouseEvent) => {
            const deltaY = startBpmYRef.current - ev.clientY;
            if (Math.abs(deltaY) > 2) {
                isBpmClickRef.current = false;
                setIsBpmDragging(true);
            }
            // Sensitivity: 3px per BPM
            const steps = deltaY / 3;
            const newBpm = Math.max(50, Math.min(250, startBpmRef.current + steps));
            onBpmChange(newBpm);
        };

        const handleMouseUp = () => {
            setIsBpmDragging(false);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);

            if (isBpmClickRef.current) {
                // Delay entering edit mode to allow double-click to fire
                bpmEditTimeoutRef.current = setTimeout(() => {
                    setIsBpmEditing(true);
                    setBpmInputValue(currentBpm.toFixed(2));
                }, 100);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

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

    const handleBpmInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            const val = parseFloat(bpmInputValue);
            if (!isNaN(val) && val >= 50 && val <= 250) {
                onBpmChange(val);
            }
            setIsBpmEditing(false);
        } else if (e.key === 'Escape') {
            setIsBpmEditing(false);
        }
    };

    const handleBpmInputBlur = () => {
        const val = parseFloat(bpmInputValue);
        if (!isNaN(val) && val >= 50 && val <= 250) {
            onBpmChange(val);
        }
        setIsBpmEditing(false);
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
                    <span className="material-symbols-outlined text-xl">keyboard_tab</span>
                </button>
                <button
                    onClick={() => setPlayMode('trigger')}
                    className={`p-1 rounded-sm transition-all flex items-center justify-center ${playMode === 'trigger' ? 'text-primary bg-surface-light shadow-ui-element-raised' : 'text-gray-500 hover:text-white hover:bg-surface-light active:shadow-ui-element-pressed'}`}
                    title="Trigger Mode"
                >
                    <span className="material-symbols-outlined text-xl">arrow_right_alt</span>
                </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2 w-48">
                <span className="material-symbols-outlined text-lg text-gray-400">volume_up</span>
                <input
                    className="w-full h-1.5 bg-surface-light rounded-lg appearance-none cursor-pointer accent-primary shadow-ui-element-inset"
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
