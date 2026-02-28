import { Innertube, UniversalCache } from 'youtubei.js';

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const MIN_CACHE_TTL_MS = 30 * 1000;
type SupportedInnertubeClient = 'IOS' | 'ANDROID' | 'YTMUSIC_ANDROID' | 'MWEB';
const CLIENT_ORDER: SupportedInnertubeClient[] = ['IOS', 'ANDROID', 'YTMUSIC_ANDROID', 'MWEB'];

export interface ResolvedAudioResult {
    url: string;
    source: string;
    apiType: 'youtubei';
    mimeType: string;
    extension: string;
    bitrate: number;
    cached: boolean;
}

interface CacheEntry {
    expiresAt: number;
    value: Omit<ResolvedAudioResult, 'cached'>;
}

const audioCache = new Map<string, CacheEntry>();

let youtubeClientPromise: Promise<Innertube> | null = null;

function normalizeVideoId(input: string): string | null {
    if (!input) return null;
    const trimmed = input.trim();
    return /^[\w-]{11}$/.test(trimmed) ? trimmed : null;
}

function extensionFromMime(mimeType: string): string {
    const normalized = mimeType.toLowerCase();
    if (normalized.includes('mp4') || normalized.includes('m4a')) return 'm4a';
    if (normalized.includes('webm') || normalized.includes('opus')) return 'webm';
    if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
    return 'm4a';
}

function computeCacheTtlMs(url: string): number {
    try {
        const expires = Number(new URL(url).searchParams.get('expire'));
        if (!Number.isFinite(expires)) {
            return DEFAULT_CACHE_TTL_MS;
        }
        const expiresAt = (expires * 1000) - (60 * 1000);
        return Math.max(MIN_CACHE_TTL_MS, Math.min(DEFAULT_CACHE_TTL_MS, expiresAt - Date.now()));
    } catch {
        return DEFAULT_CACHE_TTL_MS;
    }
}

async function getInnertubeClient(): Promise<Innertube> {
    if (!youtubeClientPromise) {
        youtubeClientPromise = Innertube.create({
            cache: new UniversalCache(false),
            cookie: process.env.YOUTUBE_COOKIE,
            generate_session_locally: true
        }).catch((error) => {
            youtubeClientPromise = null;
            throw error;
        });
    }
    return youtubeClientPromise;
}

export async function resolveYouTubeAudio(videoId: string): Promise<ResolvedAudioResult> {
    const normalizedVideoId = normalizeVideoId(videoId);
    if (!normalizedVideoId) {
        throw new Error('Invalid video ID');
    }

    const cached = audioCache.get(normalizedVideoId);
    if (cached && cached.expiresAt > Date.now()) {
        return { ...cached.value, cached: true };
    }

    audioCache.delete(normalizedVideoId);

    const youtube = await getInnertubeClient();
    const errors: string[] = [];

    for (const client of CLIENT_ORDER) {
        try {
            const format = await youtube.getStreamingData(normalizedVideoId, {
                client,
                format: 'any',
                quality: 'best',
                type: 'audio'
            });

            if (!format.url || !format.mime_type.startsWith('audio/')) {
                throw new Error('Missing resolved audio URL');
            }

            const mimeType = format.mime_type.split(';')[0].trim();
            const result = {
                apiType: 'youtubei' as const,
                bitrate: format.bitrate,
                extension: extensionFromMime(mimeType),
                mimeType,
                source: `youtubei.js (${client})`,
                url: format.url
            };

            audioCache.set(normalizedVideoId, {
                expiresAt: Date.now() + computeCacheTtlMs(result.url),
                value: result
            });

            return { ...result, cached: false };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(`${client}: ${message}`);
        }
    }

    throw new Error(`Failed to resolve an audio stream. ${errors.join(' | ')}`);
}
