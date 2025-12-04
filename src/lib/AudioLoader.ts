/**
 * Utility class for loading and decoding audio files.
 * Supports loading from URL (fetch) and local File objects.
 */
export class AudioLoader {
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
    static async loadFromFile(file: File, context: AudioContext): Promise<AudioBuffer> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                if (!e.target?.result) {
                    reject(new Error('[AudioLoader] Failed to read file: No result'));
                    return;
                }

                try {
                    const arrayBuffer = e.target.result as ArrayBuffer;
                    const buffer = await context.decodeAudioData(arrayBuffer);
                    resolve(buffer);
                } catch (err) {
                    console.error('[AudioLoader] Error decoding audio data:', err);
                    reject(new Error('[AudioLoader] Failed to decode audio data. Format may not be supported.'));
                }
            };

            reader.onerror = () => {
                reject(new Error('[AudioLoader] Failed to read file'));
            };

            reader.readAsArrayBuffer(file);
        });
    }
}
