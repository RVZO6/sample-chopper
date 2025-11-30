import React, { useState, useRef } from 'react';
import { useAudio } from '../context/AudioContext';

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BASE_KEY_INDEX = 3; // D#

export const Header: React.FC = () => {
  const {
    playMode, setPlayMode,
    masterVolume, setMasterVolume,
    globalKeyShift, setGlobalKeyShift
  } = useAudio();

  const [isDraggingKey, setIsDraggingKey] = useState(false);

  const startTransposeRef = useRef(0);
  const accumulatedYRef = useRef(0);

  const handleKeyDragStart = async (e: React.MouseEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;

    // Request pointer lock for infinite dragging
    try {
      await target.requestPointerLock();
    } catch (err) {
      console.error("Pointer lock failed:", err);
    }

    setIsDraggingKey(true);
    startTransposeRef.current = globalKeyShift;
    accumulatedYRef.current = 0;

    const handleMouseMove = (ev: MouseEvent) => {
      // With pointer lock, use movementY instead of clientY
      // Negative movementY means moving up, which should increase value
      accumulatedYRef.current -= ev.movementY;

      // Sensitivity: 15px per semitone
      const steps = Math.floor(accumulatedYRef.current / 15);

      setGlobalKeyShift(startTransposeRef.current + steps);
    };

    const handleMouseUp = () => {
      document.exitPointerLock();
      setIsDraggingKey(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Calculate display values
  const currentKeyIndex = ((BASE_KEY_INDEX + globalKeyShift) % 12 + 12) % 12;
  const noteName = KEYS[currentKeyIndex];
  const sign = globalKeyShift > 0 ? '+' : '';
  const offsetText = `${sign}${globalKeyShift}`;

  return (
    <header className="bg-surface-dark border-b border-black/50 p-2 flex items-center justify-between text-sm flex-shrink-0 z-10">
      <div className="flex items-center gap-3">
        <button className="p-2 rounded hover:bg-surface-light transition-colors shadow-ui-element-raised active:shadow-ui-element-pressed text-gray-400 hover:text-white">
          <span className="material-symbols-outlined text-lg">upload</span>
        </button>
      </div>

      <div className="flex items-center gap-4">
        {/* Key Display - Draggable */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 select-none">KEY</span>
          <div
            onMouseDown={handleKeyDragStart}
            className={`bg-background-dark rounded w-20 h-8 px-2 flex items-center justify-between font-semibold shadow-ui-element-inset cursor-ns-resize select-none transition-colors ${isDraggingKey ? 'text-primary' : ''}`}
            title="Drag up/down to transpose"
          >
            <span className={`text-base text-left font-mono ${isDraggingKey ? 'text-primary' : 'text-gray-200'}`}>{noteName}</span>
            <span className={`text-xs text-right font-mono ${isDraggingKey ? 'text-primary/70' : 'text-gray-500'}`}>{offsetText}</span>
          </div>
        </div>

        {/* Play Mode Toggle (Gate vs Trigger) */}
        <div className="flex items-center gap-1 bg-background-dark rounded p-1 shadow-ui-element-inset">
          {/* Gate Mode: Arrow with block end ->| (keyboard_tab) */}
          <button
            onClick={() => setPlayMode('gate')}
            className={`p-1 rounded transition-all flex items-center justify-center ${playMode === 'gate' ? 'text-primary bg-surface-light shadow-ui-element-raised' : 'text-gray-500 hover:text-white hover:bg-surface-light active:shadow-ui-element-pressed'}`}
            title="Gate Mode"
          >
            <span className="material-symbols-outlined text-xl">keyboard_tab</span>
          </button>

          {/* Trigger Mode: Arrow with arrow end -> (arrow_right_alt) */}
          <button
            onClick={() => setPlayMode('trigger')}
            className={`p-1 rounded transition-all flex items-center justify-center ${playMode === 'trigger' ? 'text-primary bg-surface-light shadow-ui-element-raised' : 'text-gray-500 hover:text-white hover:bg-surface-light active:shadow-ui-element-pressed'}`}
            title="Trigger Mode"
          >
            <span className="material-symbols-outlined text-xl">arrow_right_alt</span>
          </button>
        </div>

        {/* Master Volume */}
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
    </header>
  );
};