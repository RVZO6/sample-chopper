import React, { useEffect, useRef } from 'react';
import { Pad } from './Pad';
import { useAudio } from '../context/AudioContext';

export const PadGrid: React.FC = () => {
  const { pads, currentTime, triggerPad, stopPad, setPadCuePoint, clearPad, playMode } = useAudio();

  // Track active keys to prevent repeat firing and handle gate mode
  const activeKeysRef = useRef<Set<string>>(new Set());

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return; // Ignore auto-repeat
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const pad = pads.find(p => p.key === e.code);
      if (pad) {
        e.preventDefault();
        activeKeysRef.current.add(pad.id);

        if (pad.cuePoint !== null) {
          triggerPad(pad.id);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const pad = pads.find(p => p.key === e.code);
      if (pad) {
        e.preventDefault();
        activeKeysRef.current.delete(pad.id);

        if (playMode === 'gate' && pad.cuePoint !== null) {
          stopPad(pad.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [pads, triggerPad, stopPad, playMode]);

  const handlePadMouseDown = (id: string, e: React.MouseEvent) => {
    if (e.button !== 0 || e.ctrlKey) return;

    const pad = pads.find(p => p.id === id);
    if (!pad) return;

    if (pad.cuePoint !== null) {
      triggerPad(id);
    } else {
      setPadCuePoint(id, currentTime);
    }
  };

  const handlePadMouseUp = (id: string) => {
    if (playMode === 'gate') {
      stopPad(id);
    }
  };

  const handlePadMouseLeave = (id: string) => {
    if (playMode === 'gate') {
      stopPad(id);
    }
  };

  const handlePadContextMenu = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    clearPad(id);
  };

  return (
    <div className="flex-grow grid grid-cols-5 grid-rows-4 gap-3 min-h-[300px]">
      {pads.map((pad) => (
        <Pad
          key={pad.id}
          label={pad.label}
          colorClass={pad.color}
          isEmpty={pad.cuePoint === null}
          onMouseDown={(e) => handlePadMouseDown(pad.id, e)}
          onMouseUp={() => handlePadMouseUp(pad.id)}
          onMouseLeave={() => handlePadMouseLeave(pad.id)}
          onContextMenu={(e) => handlePadContextMenu(pad.id, e)}
        />
      ))}
    </div>
  );
};