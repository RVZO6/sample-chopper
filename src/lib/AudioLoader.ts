import { transcodeAudioFileToWav } from './AudioTranscoder';

type LoadStatusCallback = (status: string) => void;

const AUDIO_FILE_EXTENSIONS = [
    '.aac',
    '.aif',
    '.aiff',
    '.alac',
    '.amr',
    '.au',
    '.caf',
    '.flac',
    '.m4a',
    '.mid',
    '.midi',
    '.mp3',
    '.mp4',
    '.oga',
    '.ogg',
    '.opus',
    '.wav',
    '.wave',
    '.weba',
    '.webm',
    '.wma'
] as const;

const AUDIO_FILE_EXTENSION_SET = new Set(AUDIO_FILE_EXTENSIONS);

export const AUDIO_FILE_PICKER_ACCEPT = ['audio/*', ...AUDIO_FILE_EXTENSIONS].join(',');

/**
 * Utility class for loading and decoding audio files.
 * Supports loading from URL (fetch) and local File objects.
 */
export class AudioLoader {
    static isLikelyAudioFile(file: File): boolean {
        if (file.type.startsWith('audio/')) {
            return true;
        }

        const extensionMatch = /\.[^.]+$/.exec(file.name.toLowerCase());
        return extensionMatch ? AUDIO_FILE_EXTENSION_SET.has(extensionMatch[0] as typeof AUDIO_FILE_EXTENSIONS[number]) : false;
    }

    /**
     * Loads audio from a URL.
     * @param url URL to fetch audio from
     * @param context AudioContext to use for decoding
     */
    static async loadFromUrl(url: string, context: AudioContext): Promise<AudioBuffer> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`[AudioLoader] Failed to fetch audio: ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return await context.decodeAudioData(arrayBuffer);
    }

    /**
     * Loads audio from a local File object.
     * @param file File object to load
     * @param context AudioContext to use for decoding
     */
    static async loadFromFile(file: File, context: AudioContext, onStatus?: LoadStatusCallback): Promise<AudioBuffer> {
        if (!this.isLikelyAudioFile(file)) {
            throw new Error('[AudioLoader] Please choose an audio file.');
        }

        onStatus?.('Reading audio');
        const arrayBuffer = await file.arrayBuffer();

        try {
            onStatus?.('Decoding audio');
            return await context.decodeAudioData(arrayBuffer);
        } catch (err) {
            console.warn('[AudioLoader] Native decode failed, transcoding with FFmpeg:', err);

            try {
                const transcodedBuffer = await transcodeAudioFileToWav(file, onStatus);
                onStatus?.('Decoding transcoded audio');
                return await context.decodeAudioData(transcodedBuffer);
            } catch (transcodeError) {
                console.error('[AudioLoader] Error decoding audio data:', transcodeError);
                throw new Error('[AudioLoader] Failed to decode audio data, even after transcoding.');
            }
        }
    }
}
