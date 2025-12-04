import React, { useEffect, useRef, useState } from 'react';
import { Pad } from './Pad';
import { useAudio, useAudioTime } from '@/context/AudioContext';

/**
 * Grid of 20 pads with keyboard and mouse interaction support.
 * Handles gate/trigger modes and visual feedback for pressed states.
 */
export const PadGrid: React.FC = () => {
  const { pads, triggerPad, stopPad, setPadCuePoint, clearPad, playMode } = useAudio();
  const currentTime = useAudioTime();

  const activeKeysRef = useRef<Set<string>>(new Set());
  const currentlyPlayingPadRef = useRef<string | null>(null);
  const [pressedPads, setPressedPads] = useState<Set<string>>(new Set());


  // Keep track of current time without triggering re-renders of the effect
  const currentTimeRef = useRef(currentTime);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const pad = pads.find(p => p.key === e.code);
      if (pad) {
        e.preventDefault();
        activeKeysRef.current.add(pad.id);
        setPressedPads(prev => new Set(prev).add(pad.id));

        if (pad.cuePoint !== null) {
          triggerPad(pad.id);
          currentlyPlayingPadRef.current = pad.id;
        } else {
          // Create new pad at current time if empty
          setPadCuePoint(pad.id, currentTimeRef.current);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const pad = pads.find(p => p.key === e.code);
      if (pad) {
        e.preventDefault();
        activeKeysRef.current.delete(pad.id);
        setPressedPads(prev => {
          const next = new Set(prev);
          next.delete(pad.id);
          return next;
        });

        if (playMode === 'gate' && pad.cuePoint !== null && currentlyPlayingPadRef.current === pad.id) {
          stopPad(pad.id);
          currentlyPlayingPadRef.current = null;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [pads, triggerPad, stopPad, playMode, setPadCuePoint]);

  const handlePadMouseDown = (id: string, e: React.MouseEvent) => {
    if (e.button !== 0 || e.ctrlKey) return;

    const pad = pads.find(p => p.id === id);
    if (!pad) return;

    setPressedPads(prev => new Set(prev).add(id));

    if (pad.cuePoint !== null) {
      triggerPad(id);
      currentlyPlayingPadRef.current = id; // Track which pad is now active
    } else {
      setPadCuePoint(id, currentTime);
    }
  };

  const handlePadMouseUp = (id: string) => {
    setPressedPads(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    if (playMode === 'gate' && currentlyPlayingPadRef.current === id) {
      stopPad(id);
      currentlyPlayingPadRef.current = null;
    }
  };

  const handlePadMouseLeave = (id: string) => {
    // Visual feedback - remove from pressed set
    setPressedPads(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

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