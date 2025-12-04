import React, { useState } from 'react';
import { Knob } from './Knob';
import { useAudio } from '@/context/AudioContext';
import { mapAttackToSeconds, mapReleaseToSeconds, formatTime } from '@/lib/audioUtils';

export const ControlPanel: React.FC = () => {
  const {
    pads, selectedPadId, updateSelectedPadParams,
    isPlaying, play, pause
  } = useAudio();

  const selectedPad = selectedPadId ? pads.find(p => p.id === selectedPadId) : null;

  // Defaults if no pad selected
  const attack = selectedPad?.params.attack ?? 0;
  const release = selectedPad?.params.release ?? 30;
  const timeStretch = selectedPad?.params.timeStretch ?? 100;
  const keyShift = selectedPad?.params.keyShift ?? 0;
  const isReverse = selectedPad?.params.isReverse ?? false;

  const [isDraggingTime, setIsDraggingTime] = useState(false);
  const [isInteractingAttack, setIsInteractingAttack] = useState(false);
  const [isInteractingRelease, setIsInteractingRelease] = useState(false);

  // Time Stretch drag logic
  const handleTimeStretchDrag = (e: React.MouseEvent) => {
    if (!selectedPad) return; // Disable if no pad
    e.preventDefault();
    setIsDraggingTime(true);
    const startY = e.clientY;
    const startVal = timeStretch;

    const mouseMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      // 1px = 1%
      let newVal = startVal + delta;
      newVal = Math.max(50, Math.min(200, newVal)); // Limit 50% to 200%
      updateSelectedPadParams({ timeStretch: Math.round(newVal) });
    };

    const mouseUp = () => {
      setIsDraggingTime(false);
      window.removeEventListener('mousemove', mouseMove);
      window.removeEventListener('mouseup', mouseUp);
      document.body.style.cursor = 'default';
    };

    document.body.style.cursor = 'ns-resize';
    window.addEventListener('mousemove', mouseMove);
    window.addEventListener('mouseup', mouseUp);
  };

  return (
    <div className="shrink-0 bg-surface-dark rounded-sm p-4 flex items-center justify-center gap-4 md:gap-8 shadow-ui-element-inset overflow-x-auto">
      {/* Envelope Section */}
      <div className="flex items-center gap-6">
        <Knob
          label={isInteractingAttack ? formatTime(mapAttackToSeconds(attack)) : "Attack"}
          value={attack}
          onChange={(val) => updateSelectedPadParams({ attack: val })}
          onInteractChange={setIsInteractingAttack}
        />
        <Knob
          label={isInteractingRelease ? formatTime(mapReleaseToSeconds(release)) : "Release"}
          value={release}
          onChange={(val) => updateSelectedPadParams({ release: val })}
          onInteractChange={setIsInteractingRelease}
        />
      </div>

      <div className="h-12 w-px bg-black/50 mx-2"></div>

      {/* Pitch/Time Section */}
      <div className="flex items-center gap-6 md:gap-8">
        <div className="flex flex-col items-center gap-2">
          <div
            className={`bg-background-dark rounded-sm p-2 px-3 text-center cursor-ns-resize shadow-ui-element-inset transition-colors select-none w-24 ${isDraggingTime ? 'text-primary' : 'text-gray-300 hover:text-white'}`}
            onMouseDown={handleTimeStretchDrag}
          >
            <span className="font-mono text-lg font-bold">{timeStretch}%</span>
          </div>
          <span className="text-xs font-semibold text-gray-400 select-none">Time Stretch</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateSelectedPadParams({ keyShift: keyShift - 1 })}
              className="w-8 h-8 bg-surface-light rounded-sm hover:bg-surface-light/80 shadow-ui-element-raised active:shadow-ui-element-pressed flex items-center justify-center text-gray-300 active:text-white transition-all"
            >
              <span className="material-symbols-outlined text-sm">remove</span>
            </button>
            <div className="flex items-baseline gap-1 w-20 justify-center">
              <span className="font-mono text-lg font-bold select-none">{keyShift}</span>
              <span className="font-mono text-[10px] text-gray-400 select-none">st</span>
            </div>
            <button
              onClick={() => updateSelectedPadParams({ keyShift: keyShift + 1 })}
              className="w-8 h-8 bg-surface-light rounded-sm hover:bg-surface-light/80 shadow-ui-element-raised active:shadow-ui-element-pressed flex items-center justify-center text-gray-300 active:text-white transition-all"
            >
              <span className="material-symbols-outlined text-sm">add</span>
            </button>
          </div>
          <span className="text-xs font-semibold text-gray-400 select-none">Key Shift</span>
        </div>
      </div>

      <div className="h-12 w-px bg-black/50 mx-2"></div>

      {/* Transport/Direction */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={() => updateSelectedPadParams({ isReverse: !isReverse })}
          className={`w-16 h-12 rounded flex items-center justify-center transition-all duration-100
            ${isReverse
              ? 'bg-primary text-black shadow-ui-element-inset'
              : 'bg-surface-light text-gray-400 hover:text-white hover:bg-surface-light/80 shadow-ui-element-raised active:shadow-ui-element-pressed'
            }`}
        >
          {/* Reverse Icon - always backwards */}
          <span
            className="material-symbols-outlined text-4xl"
            style={{
              fontVariationSettings: "'FILL' 1",
              transform: 'scaleX(-1)'
            }}
          >
            play_arrow
          </span>
        </button>
        <span className="text-xs font-semibold text-gray-400 select-none">Reverse</span>
      </div>
    </div>
  );
};