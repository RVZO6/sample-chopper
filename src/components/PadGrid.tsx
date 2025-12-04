import React, { useEffect, useRef, useState } from 'react';
import { Pad } from './Pad';
import { useAudio, useAudioTime } from '@/context/AudioContext';

export const PadGrid: React.FC = () => {
  const { pads, triggerPad, stopPad, setPadCuePoint, clearPad, playMode } = useAudio();
  const currentTime = useAudioTime();

  // Track active keys to prevent repeat firing and handle gate mode
  const activeKeysRef = useRef<Set<string>>(new Set());
  const currentlyPlayingPadRef = useRef<string | null>(null);

  // Track pressed pads for visual feedback
  const [pressedPads, setPressedPads] = useState<Set<string>>(new Set());

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return; // Ignore auto-repeat
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const pad = pads.find(p => p.key === e.code);
      if (pad) {
        e.preventDefault();
        activeKeysRef.current.add(pad.id);

        // Visual feedback - add to pressed set
        setPressedPads(prev => new Set(prev).add(pad.id));

        if (pad.cuePoint !== null) {
          triggerPad(pad.id);
          currentlyPlayingPadRef.current = pad.id; // Track which pad is now active
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const pad = pads.find(p => p.key === e.code);
      if (pad) {
        e.preventDefault();
        activeKeysRef.current.delete(pad.id);

        // Visual feedback - remove from pressed set
        setPressedPads(prev => {
          const next = new Set(prev);
          next.delete(pad.id);
          return next;
        });

        // Only stop if this is the CURRENTLY PLAYING pad
        if (playMode === 'gate' && pad.cuePoint !== null && currentlyPlayingPadRef.current === pad.id) {
          stopPad(pad.id);
          currentlyPlayingPadRef.current = null;
        }
        // If a different pad is playing, do nothing
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
      currentlyPlayingPadRef.current = id; // Track which pad is now active
    } else {
      setPadCuePoint(id, currentTime);
    }
  };

  const handlePadMouseUp = (id: string) => {
    // Only stop if this is the CURRENTLY PLAYING pad
    if (playMode === 'gate' && currentlyPlayingPadRef.current === id) {
      stopPad(id);
      currentlyPlayingPadRef.current = null;
    }
  };

  const handlePadMouseLeave = (id: string) => {
    // Only stop if this is the CURRENTLY PLAYING pad
    if (playMode === 'gate' && currentlyPlayingPadRef.current === id) {
      stopPad(id);
      currentlyPlayingPadRef.current = null;
    }
  };

  const handlePadContextMenu = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    clearPad(id);
  };

  return (
    <div className="grow grid grid-cols-5 grid-rows-4 gap-3 min-h-[300px]">
      {pads.map((pad) => (
        <Pad
          key={pad.id}
          label={pad.label}
          colorClass={pad.color}
          isEmpty={pad.cuePoint === null}
          isPressed={pressedPads.has(pad.id)}
          onMouseDown={(e) => handlePadMouseDown(pad.id, e)}
          onMouseUp={() => handlePadMouseUp(pad.id)}
          onMouseLeave={() => handlePadMouseLeave(pad.id)}
          onContextMenu={(e) => handlePadContextMenu(pad.id, e)}
        />
      ))}
    </div>
  );
};