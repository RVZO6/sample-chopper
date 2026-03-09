import React, { useRef } from 'react';
import { RiUpload2Fill } from 'react-icons/ri';
import { useAudio } from '@/context/AudioContext';
import { HeaderControls } from './header/HeaderControls';
import { AUDIO_FILE_PICKER_ACCEPT } from '@/lib/AudioLoader';

/**
 * Application header containing global controls.
 * Includes file upload, BPM/Key display and adjustment, and master volume.
 */
export const Header: React.FC = () => {
  const {
    playMode, setPlayMode,
    masterVolume, setMasterVolume,
    globalKeyShift, setGlobalKeyShift,
    loadFile,
    detectedBpm,
    currentBpm, setBpm,
    isAnalyzing,
    keyMode, detectedKeyIndex
  } = useAudio();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    try {
      await loadFile(file);
    } catch (error) {
      console.error('Failed to load audio file:', error);
    } finally {
      input.value = '';
    }
  };

  return (
    <header className="bg-surface-dark border-b border-black/50 p-2 flex items-center justify-between text-sm shrink-0 z-10">
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept={AUDIO_FILE_PICKER_ACCEPT}
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-sm hover:bg-surface-light transition-colors shadow-ui-element-raised active:shadow-ui-element-pressed text-gray-400 hover:text-white"
        >
          <RiUpload2Fill className="text-lg" />
        </button>
      </div>

      <HeaderControls
        detectedKeyIndex={detectedKeyIndex}
        globalKeyShift={globalKeyShift}
        onKeyShiftChange={setGlobalKeyShift}
        keyMode={keyMode}
        currentBpm={currentBpm}
        detectedBpm={detectedBpm}
        onBpmChange={setBpm}
        isAnalyzing={isAnalyzing}
        playMode={playMode}
        setPlayMode={setPlayMode}
        masterVolume={masterVolume}
        setMasterVolume={setMasterVolume}
      />
    </header>
  );
};
