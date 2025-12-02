import { YOUTUBE_API_SOURCES, APIType } from '../config/YouTubeSources';

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

export class YouTubeService {
    static extractVideoId(url: string): string | null {
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[7].length === 11) ? match[7] : null;
    }

    private static async handlePipedResponse(response: Response): Promise<string> {
        const data = await response.json() as PipedResponse;
        if (!data.audioStreams || data.audioStreams.length === 0) {
            throw new Error('No audio streams found in Piped response');
        }
        // Sort by bitrate descending
        const sorted = data.audioStreams.sort((a, b) => b.bitrate - a.bitrate);
        return sorted[0].url;
    }

    private static async handleInvidiousResponse(response: Response): Promise<string> {
        const data = await response.json() as InvidiousResponse;
        if (!data.adaptiveFormats || data.adaptiveFormats.length === 0) {
            throw new Error('No adaptive formats found in Invidious response');
        }
        // Filter for audio only
        const audioStreams = data.adaptiveFormats.filter(f =>
            f.mimeType.startsWith('audio/') || (f.type && f.type.startsWith('audio/'))
        );

        if (audioStreams.length === 0) {
            throw new Error('No audio streams found in Invidious response');
        }

        // Sort by bitrate descending
        const sorted = audioStreams.sort((a, b) => b.bitrate - a.bitrate);
        return sorted[0].url;
    }

    static async getBestAudioUrl(videoId: string): Promise<AudioFetchResult> {
        const errors: string[] = [];

        for (const source of YOUTUBE_API_SOURCES) {
            try {
                console.log(`Trying to fetch audio from ${source.name} (${source.type})...`);

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

                let audioUrl = '';
                if (source.type === 'piped') {
                    audioUrl = await this.handlePipedResponse(response);
                } else {
                    audioUrl = await this.handleInvidiousResponse(response);
                }

                console.log(`✓ Successfully fetched audio URL from ${source.name}`);
                return {
                    url: audioUrl,
                    source: source.name,
                    apiType: source.type
                };

            } catch (error) {
                const msg = `Failed to fetch from ${source.name}: ${error}`;
                console.warn(msg);
                errors.push(msg);
                // Continue to next source
            }
        }

        throw new Error(`Failed to fetch audio from all configured sources:\n${errors.join('\n')}`);
    }
}
