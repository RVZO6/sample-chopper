import { YOUTUBE_API_SOURCES, APIType } from '../config/YouTubeSources';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface AudioStream {
    url: string;
    mimeType: string;
    quality: string;
    audioQuality?: string;
    bitrate: number;
    type?: string; // For Piped compatibility
}

export interface AudioFetchResult {
    url: string;
    source: string;
    apiType: APIType;
    mimeType: string;
    extension: string;
}

interface PipedStream {
    url: string;
    format: string;
    quality: string;
    mimeType: string;
    bitrate: number;
}

interface PipedResponse {
    audioStreams: PipedStream[];
    title: string;
}

interface InvidiousResponse {
    adaptiveFormats: AudioStream[];
    title: string;
    videoId: string;
}

// ============================================================================
// YouTube Service
// ============================================================================

/**
 * Service for extracting audio from YouTube videos via Piped/Invidious APIs.
 * Handles video ID extraction, API failover, and stream selection.
 */
export class YouTubeService {
    /**
     * Extracts video ID from various YouTube URL formats.
     */
    static extractVideoId(url: string): string | null {
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[7].length === 11) ? match[7] : null;
    }

    private static async handlePipedResponse(response: Response): Promise<{ url: string, mimeType: string, extension: string }> {
        const data = await response.json() as PipedResponse;
        if (!data.audioStreams || data.audioStreams.length === 0) {
            throw new Error('[YouTubeService] No audio streams found in Piped response');
        }
        // Sort by bitrate descending
        const sorted = data.audioStreams.sort((a, b) => b.bitrate - a.bitrate);
        const stream = sorted[0];

        // Determine extension based on mimeType
        let extension = 'mp3'; // Default
        if (stream.mimeType === 'audio/mp4' || stream.mimeType.includes('mp4')) {
            extension = 'm4a';
        } else if (stream.mimeType === 'audio/webm' || stream.mimeType.includes('webm')) {
            extension = 'webm';
        }

        return {
            url: stream.url,
            mimeType: stream.mimeType,
            extension
        };
    }

    private static async handleInvidiousResponse(response: Response): Promise<{ url: string, mimeType: string, extension: string }> {
        const data = await response.json() as InvidiousResponse;
        if (!data.adaptiveFormats || data.adaptiveFormats.length === 0) {
            throw new Error('[YouTubeService] No adaptive formats found in Invidious response');
        }
        // Filter for audio only
        const audioStreams = data.adaptiveFormats.filter(f =>
            f.mimeType.startsWith('audio/') || (f.type && f.type.startsWith('audio/'))
        );

        if (audioStreams.length === 0) {
            throw new Error('[YouTubeService] No audio streams found in Invidious response');
        }

        // Sort by bitrate descending
        const sorted = audioStreams.sort((a, b) => b.bitrate - a.bitrate);
        const stream = sorted[0];

        // Determine extension based on mimeType
        let extension = 'mp3'; // Default
        const mime = stream.mimeType || stream.type || '';
        if (mime.includes('mp4')) {
            extension = 'm4a';
        } else if (mime.includes('webm')) {
            extension = 'webm';
        }

        return {
            url: stream.url,
            mimeType: mime.split(';')[0], // Clean up mime type (remove codecs)
            extension
        };
    }

    /**
     * Attempts to fetch the best available audio stream for a video ID.
     * Tries multiple configured sources (Piped, Invidious) until one succeeds.
     */
    static async getBestAudioUrl(videoId: string, onStatus?: (msg: string) => void): Promise<AudioFetchResult> {
        const errors: string[] = [];

        for (const source of YOUTUBE_API_SOURCES) {
            try {
                const msg = `Checking ${source.name}...`;

                onStatus?.(msg);

                let url = '';
                if (source.type === 'piped') {
                    url = `${source.baseUrl}/streams/${videoId}`;
                } else if (source.type === 'invidious') {
                    url = `${source.baseUrl}/api/v1/videos/${videoId}`;
                }

                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} ${response.statusText}`);
                }

                let resultData: { url: string, mimeType: string, extension: string };
                if (source.type === 'piped') {
                    resultData = await this.handlePipedResponse(response);
                } else {
                    resultData = await this.handleInvidiousResponse(response);
                }


                return {
                    url: resultData.url,
                    source: source.name,
                    apiType: source.type,
                    mimeType: resultData.mimeType,
                    extension: resultData.extension
                };

            } catch (error) {
                const msg = `Failed ${source.name}, skipping...`;
                console.warn(`[YouTubeService] ${msg}`, error);
                onStatus?.(msg);
                errors.push(`${source.name}: ${error}`);
                // Continue to next source
            }
        }

        throw new Error(`[YouTubeService] Failed to fetch audio from all configured sources:\n${errors.join('\n')}`);
    }
}
