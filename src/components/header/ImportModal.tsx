import React, { useState, useRef } from 'react';
import { FiPlusCircle, FiLink, FiLoader, FiDownload, FiMusic } from 'react-icons/fi';
import { YouTubeService } from '@/lib/YouTubeService';

interface ImportModalProps {
    onLoadFile: (file: File) => Promise<void>;
    onClose: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ onLoadFile, onClose }) => {
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
            const blob = new Blob(chunks, { type: result.mimeType });
            const file = new File([blob], `youtube-${videoId}.${result.extension}`, { type: result.mimeType });

            await onLoadFile(file);
            onClose();
        } catch (error) {
            console.error('YouTube load failed:', error);
            alert(`Failed to load YouTube video: ${error}`);
            setStatusMessage('Failed');
        } finally {
            setIsLoadingYoutube(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            await onLoadFile(file);
            onClose();
        } catch (error) {
            console.error('Failed to load audio file:', error);
            alert(`Failed to load audio file: ${error}`);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-surface-dark rounded-xl shadow-pad-raised p-6 w-[400px] transform transition-all"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                    <FiPlusCircle className="text-primary" />
                    Import Audio
                </h2>

                <div className="mb-6">
                    <label className="block text-[10px] text-gray-400 mb-2 uppercase tracking-wider font-bold">From YouTube</label>
                    <div className="flex gap-2 mb-3">
                        <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                <FiLink className="text-gray-500 text-lg" />
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
                                <FiLoader className="animate-spin text-lg" />
                            ) : (
                                <FiDownload className="text-lg" />
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
                            <FiMusic className="text-xl block" />
                        </div>
                        <span className="text-sm text-gray-400 group-hover:text-white font-medium transition-colors">Click to browse audio files</span>
                    </button>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-sm font-medium px-4 py-2 hover:bg-white/5 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};
