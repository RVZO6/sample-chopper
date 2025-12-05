import React, { useState } from 'react';
import { RiUpload2Fill } from 'react-icons/ri';
import { useAudio } from '@/context/AudioContext';
import { HeaderControls } from './header/HeaderControls';
import { ImportModal } from './header/ImportModal';

/**
 * Application header containing global controls.
 * Includes file upload, YouTube import, BPM/Key display and adjustment, and master volume.
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

  const [showUploadModal, setShowUploadModal] = useState(false);

  return (
    <header className="bg-surface-dark border-b border-black/50 p-2 flex items-center justify-between text-sm shrink-0 z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowUploadModal(true)}
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

      {showUploadModal && (
        <ImportModal
          onLoadFile={loadFile}
          onClose={() => setShowUploadModal(false)}
        />
      )}
    </header>
  );
};