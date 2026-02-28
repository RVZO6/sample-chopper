import { Innertube, UniversalCache } from 'youtubei.js';

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const MIN_CACHE_TTL_MS = 30 * 1000;
type SupportedInnertubeClient = 'IOS' | 'ANDROID' | 'YTMUSIC_ANDROID' | 'MWEB';
const CLIENT_ORDER: SupportedInnertubeClient[] = ['IOS', 'ANDROID', 'YTMUSIC_ANDROID', 'MWEB'];

export interface ResolvedAudioResult {
    url: string;
    source: string;
    client: SupportedInnertubeClient;
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

function getClientOrder(preferred?: SupportedInnertubeClient): SupportedInnertubeClient[] {
    if (!preferred) return CLIENT_ORDER;
    return [preferred, ...CLIENT_ORDER.filter((client) => client !== preferred)];
}

async function streamToBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        chunks.push(value);
        totalLength += value.byteLength;
    }

    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return merged;
}

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
                client,
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

export async function downloadAudioBytes(videoId: string, preferredClient?: SupportedInnertubeClient): Promise<Uint8Array> {
    const youtube = await getInnertubeClient();
    const errors: string[] = [];

    for (const client of getClientOrder(preferredClient)) {
        try {
            const stream = await youtube.download(videoId, {
                client,
                format: 'any',
                quality: 'best',
                type: 'audio'
            });
            const bytes = await streamToBytes(stream);
            if (bytes.byteLength === 0) {
                throw new Error('Received empty audio stream');
            }
            return bytes;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(`${client}: ${message}`);
        }
    }

    throw new Error(`Failed to download audio bytes. ${errors.join(' | ')}`);
}

function getVideoId(query: unknown): string | null {
    if (Array.isArray(query)) {
        return typeof query[0] === 'string' ? query[0] : null;
    }
    return typeof query === 'string' ? query : null;
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const videoId = getVideoId(req.query?.videoId);
    if (!videoId) {
        res.status(400).json({ error: 'Missing videoId query param' });
        return;
    }

    const download = req.query?.download === '1' || req.query?.download === 'true';

    try {
        const result = await resolveYouTubeAudio(videoId);

        if (download) {
            const bytes = await downloadAudioBytes(videoId, result.client);
            const buffer = Buffer.from(bytes);

            res.setHeader('Content-Type', result.mimeType);
            res.setHeader('Content-Disposition', `inline; filename="youtube-${videoId}.${result.extension}"`);
            res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
            res.setHeader('Content-Length', String(buffer.byteLength));
            res.status(200).send(buffer);
            return;
        }

        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        res.status(200).json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to resolve YouTube audio stream';
        res.status(502).json({ error: message });
    }
}
