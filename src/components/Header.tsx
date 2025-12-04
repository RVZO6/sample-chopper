import React, { useState, useRef } from 'react';
import { useAudio } from '@/context/AudioContext';
import { YouTubeService } from '@/lib/YouTubeService';

const KEYS_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const KEYS_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

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
    detectedBpm, detectedKey,
    currentBpm, setBpm,
    isAnalyzing,
    keyMode, detectedKeyIndex
  } = useAudio();

  const [isDraggingKey, setIsDraggingKey] = useState(false);
  const [isDraggingBpm, setIsDraggingBpm] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isLoadingYoutube, setIsLoadingYoutube] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleYoutubeLoad = async () => {
    if (!youtubeUrl) return;

    const videoId = YouTubeService.extractVideoId(youtubeUrl);
    if (!videoId) {
      alert('Invalid YouTube URL');
      return;
    }

    setIsLoadingYoutube(true);
    setDownloadProgress(0);
    setStatusMessage('Resolving URL...');

    try {
      const result = await YouTubeService.getBestAudioUrl(videoId, (msg) => setStatusMessage(msg));

      setStatusMessage(`${result.source} - Starting download...`);

      // Try to fetch with a CORS proxy if direct fetch fails
      // We'll try direct first, then a public proxy
      let response;
      try {
        response = await fetch(result.url);
      } catch (e) {
        console.warn("Direct fetch failed, trying proxy...", e);
        // Fallback to a CORS proxy (using corsproxy.io for demo purposes)
        response = await fetch(`https://corsproxy.io/?${encodeURIComponent(result.url)}`);
      }

      if (!response.ok) throw new Error(`Failed to fetch audio: ${response.statusText}`);

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let loaded = 0;

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Failed to get response reader');

      const chunks: BlobPart[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loaded += value.length;

        if (total) {
          setDownloadProgress((loaded / total) * 100);
          // Don't show percentage in text, it's already in the progress bar
          setStatusMessage(`${result.source} - Downloading...`);
        } else {
          setStatusMessage(`${result.source} - Downloading ${(loaded / 1024 / 1024).toFixed(2)} MB`);
        }
      }

      setStatusMessage(`${result.source} - Processing audio...`);
      const blob = new Blob(chunks, { type: 'audio/mp4' }); // Assuming mp4/m4a from YouTube
      const file = new File([blob], `youtube-${videoId}.mp4`, { type: blob.type || 'audio/mp4' });

      await loadFile(file);
      setShowUploadModal(false);
      setYoutubeUrl('');
      setDownloadProgress(0);
      setStatusMessage('');
    } catch (error) {
      console.error('YouTube load failed:', error);
      alert(`Failed to load YouTube video: ${error}`);
      setStatusMessage('Failed');
    } finally {
      setIsLoadingYoutube(false);
    }
  };

  const startTransposeRef = useRef(0);
  const startBpmRef = useRef(0);
  const accumulatedYRef = useRef(0);

  const handleKeyDragStart = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (detectedKeyIndex === null) return; // Lock if no key detected

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

  const handleBpmDragStart = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentBpm) return; // Lock if no BPM

    const target = e.currentTarget as HTMLElement;

    try {
      await target.requestPointerLock();
    } catch (err) {
      console.error("Pointer lock failed:", err);
    }

    setIsDraggingBpm(true);
    startBpmRef.current = currentBpm;
    accumulatedYRef.current = 0;

    const handleMouseMove = (ev: MouseEvent) => {
      accumulatedYRef.current -= ev.movementY;
      // Sensitivity: 10px per BPM (allowing for decimals)
      const steps = accumulatedYRef.current / 10;
      setBpm(Math.max(50, Math.min(250, startBpmRef.current + steps)));
    };
    const handleMouseUp = () => {
      document.exitPointerLock();
      setIsDraggingBpm(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await loadFile(file);
      setShowUploadModal(false);
    } catch (error) {
      console.error('Failed to load audio file:', error);
      alert(`Failed to load audio file: ${error}`);
    }
  };

  // Calculate display values
  const keys = keyMode === 'sharp' ? KEYS_SHARP : KEYS_FLAT;
  let noteName = '--';

  if (detectedKeyIndex !== null) {
    const currentKeyIndex = ((detectedKeyIndex + globalKeyShift) % 12 + 12) % 12;
    noteName = keys[currentKeyIndex];
  }

  const sign = globalKeyShift > 0 ? '+' : '';
  const offsetText = detectedKeyIndex !== null ? `${sign}${globalKeyShift}` : '-';

  return (
    <header className="bg-surface-dark border-b border-black/50 p-2 flex items-center justify-between text-sm shrink-0 z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowUploadModal(true)}
          className="p-2 rounded-sm hover:bg-surface-light transition-colors shadow-ui-element-raised active:shadow-ui-element-pressed text-gray-400 hover:text-white"
        >
          <span className="material-symbols-outlined text-lg">upload</span>
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 select-none">KEY</span>
          <div
            onMouseDown={handleKeyDragStart}
            className={`bg-background-dark rounded-sm w-20 h-8 px-2 flex items-center justify-between font-semibold shadow-ui-element-inset select-none transition-colors 
              ${detectedKeyIndex !== null ? 'cursor-ns-resize hover:text-white' : 'cursor-not-allowed opacity-50 text-gray-600'} 
              ${isDraggingKey ? 'text-primary' : ''}`}
            title={detectedKeyIndex !== null ? "Drag up/down to transpose" : "Upload file to enable"}
          >
            <span className={`text-base text-left font-mono ${isDraggingKey ? 'text-primary' : (detectedKeyIndex !== null ? 'text-gray-200' : 'text-gray-600')}`}>{noteName}</span>
            <span className={`text-xs text-right font-mono ${isDraggingKey ? 'text-primary/70' : 'text-gray-500'}`}>{offsetText}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 select-none">BPM</span>
          <div
            onMouseDown={handleBpmDragStart}
            className={`bg-background-dark rounded-sm w-16 h-8 px-1 flex items-center justify-center font-semibold shadow-ui-element-inset select-none transition-colors 
              ${currentBpm ? 'cursor-ns-resize hover:text-white' : 'cursor-not-allowed opacity-50 text-gray-600'}
              ${isDraggingBpm ? 'text-primary' : ''}`}
            title={currentBpm ? "Drag up/down to change BPM" : "Upload file to enable"}
          >
            <span className={`text-base font-mono ${isDraggingBpm ? 'text-primary' : (currentBpm ? 'text-gray-200' : 'text-gray-600')}`}>
              {isAnalyzing ? '--' : (currentBpm ? currentBpm.toFixed(2) : '--')}
            </span>
          </div>
        </div>




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

      {
        showUploadModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowUploadModal(false)}>
            <div
              className="bg-surface-dark rounded-xl shadow-pad-raised p-6 w-[400px] transform transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_circle</span>
                Import Audio
              </h2>

              <div className="mb-6">
                <label className="block text-[10px] text-gray-400 mb-2 uppercase tracking-wider font-bold">From YouTube</label>
                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <span className="material-symbols-outlined text-gray-500 text-lg">link</span>
                    </div>
                    <input
                      type="text"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="Paste YouTube URL..."
                      className="w-full bg-background-dark rounded-lg pl-10 pr-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-gray-600 shadow-ui-element-inset"
                      onKeyDown={(e) => e.key === 'Enter' && handleYoutubeLoad()}
                      disabled={isLoadingYoutube}
                    />
                  </div>
                  <button
                    onClick={handleYoutubeLoad}
                    disabled={isLoadingYoutube || !youtubeUrl}
                    className="bg-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold px-4 rounded-lg transition-all shadow-ui-element-raised active:shadow-ui-element-pressed active:translate-y-px"
                  >
                    {isLoadingYoutube ? (
                      <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-lg">download</span>
                    )}
                  </button>
                </div>

                {isLoadingYoutube && (
                  <div className="bg-background-dark rounded-lg p-3 shadow-ui-element-inset">
                    <div className="flex justify-between text-[10px] text-gray-300 mb-2 font-medium">
                      <span className="truncate pr-2">{statusMessage}</span>
                      <span className="text-primary">{downloadProgress > 0 ? `${Math.round(downloadProgress)}%` : ''}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden shadow-inner">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-orange-400 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(251,191,36,0.5)]"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className="h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent flex-1" />
                <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">OR</span>
                <div className="h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent flex-1" />
              </div>

              <div className="mb-6">
                <label className="block text-[10px] text-gray-400 mb-2 uppercase tracking-wider font-bold">From Device</label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full group h-24 bg-surface-light hover:bg-surface-light/80 rounded-xl transition-all flex flex-col items-center justify-center gap-2 shadow-ui-element-raised active:shadow-ui-element-pressed active:translate-y-px"
                >
                  <div className="p-2 bg-background-dark group-hover:bg-primary group-hover:text-black rounded-full transition-colors text-gray-400 shadow-ui-element-inset">
                    <span className="material-symbols-outlined text-xl block">audio_file</span>
                  </div>
                  <span className="text-sm text-gray-400 group-hover:text-white font-medium transition-colors">Click to browse audio files</span>
                </button>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-gray-400 hover:text-white text-sm font-medium px-4 py-2 hover:bg-white/5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      }
    </header >
  );
};