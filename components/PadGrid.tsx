import React, { useEffect } from 'react';
import { Pad } from './Pad';
import { useAudio } from '../context/AudioContext';

export const PadGrid: React.FC = () => {
  const { pads, currentTime, triggerPad, setPadCuePoint, clearPad } = useAudio();

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const pad = pads.find(p => p.key === e.code);
      if (pad) {
        e.preventDefault();
        if (pad.cuePoint !== null) {
          triggerPad(pad.id);
        } else {
          // Optional: Assign on key press if empty? 
          // For now, let's stick to click-to-assign as per request, 
          // but maybe flash the pad or something.
          // Actually, standard behavior is often "play if set", "set if empty" is usually a specific mode.
          // User said: "if you click one of those pads or press its relevant key, it starts playing from that location."
          // User also said: "to add an empty pad... you left click the pad"
          // So let's keep key press for triggering only for now to avoid accidental sets.
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pads, triggerPad]);

  const handlePadClick = (id: string, e: React.MouseEvent) => {
    // Only allow left click (button 0) to trigger/set pads
    // Also check for Ctrl key (Mac right-click) which often registers as button 0
    if (e.button !== 0 || e.ctrlKey) return;

    const pad = pads.find(p => p.id === id);
    if (!pad) return;

    if (pad.cuePoint !== null) {
      triggerPad(id);
    } else {
      setPadCuePoint(id, currentTime);
    }
  };

  const handlePadContextMenu = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Stop event from bubbling up
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
          onClick={(e) => handlePadClick(pad.id, e)}
          onContextMenu={(e) => handlePadContextMenu(pad.id, e)}
        />
      ))}
    </div>
  );
};