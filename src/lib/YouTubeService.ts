export type APIType = 'youtubei';

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
    cached?: boolean;
}

interface AudioApiErrorResponse {
    error?: string;
}

const YOUTUBE_AUDIO_ENDPOINT = '/api/youtube/audio';
const YOUTUBE_AUDIO_CACHE = 'sample-chopper-pro:youtube-audio:v1';

/**
 * Service for extracting and caching YouTube audio.
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

    private static cacheRequest(videoId: string): Request {
        return new Request(`https://sample-chopper.local/youtube-audio/${videoId}`);
    }

    private static extensionFromMime(mimeType: string): string {
        if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
            return 'm4a';
        }
        if (mimeType.includes('webm') || mimeType.includes('opus')) {
            return 'webm';
        }
        if (mimeType.includes('mpeg') || mimeType.includes('mp3')) {
            return 'mp3';
        }
        return 'm4a';
    }

    static async getCachedAudioFile(videoId: string): Promise<File | null> {
        if (typeof window === 'undefined' || !('caches' in window)) {
            return null;
        }

        const cache = await caches.open(YOUTUBE_AUDIO_CACHE);
        const match = await cache.match(this.cacheRequest(videoId));
        if (!match) {
            return null;
        }

        const blob = await match.blob();
        const mimeType = match.headers.get('content-type') || blob.type || 'audio/mp4';
        const extension = match.headers.get('x-audio-extension') || this.extensionFromMime(mimeType);

        return new File([blob], `youtube-${videoId}.${extension}`, { type: mimeType });
    }

    static async cacheAudioBlob(videoId: string, blob: Blob, mimeType: string, extension: string): Promise<void> {
        if (typeof window === 'undefined' || !('caches' in window)) {
            return;
        }

        const cache = await caches.open(YOUTUBE_AUDIO_CACHE);
        await cache.put(this.cacheRequest(videoId), new Response(blob, {
            headers: {
                'content-type': mimeType,
                'x-audio-extension': extension,
                'cache-control': 'public, max-age=31536000, immutable'
            }
        }));
    }

    /**
     * Fetches the best available YouTube audio stream URL from the backend resolver.
     */
    static async getBestAudioUrl(videoId: string, onStatus?: (msg: string) => void): Promise<AudioFetchResult> {
        onStatus?.('Resolving direct YouTube audio stream...');
        const response = await fetch(`${YOUTUBE_AUDIO_ENDPOINT}?videoId=${encodeURIComponent(videoId)}`);

        if (!response.ok) {
            const errorData = await response.json() as AudioApiErrorResponse;
            throw new Error(errorData.error || `HTTP ${response.status} ${response.statusText}`);
        }

        const result = await response.json() as AudioFetchResult;
        if (!result?.url || !result?.mimeType || !result?.extension) {
            throw new Error('[YouTubeService] Invalid audio response from backend');
        }

        onStatus?.(result.cached ? 'Using warm backend cache...' : 'Audio stream ready');
        return result;
    }
}
