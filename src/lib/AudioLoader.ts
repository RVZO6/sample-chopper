export class AudioLoader {
    static async loadFromUrl(url: string, context: AudioContext): Promise<AudioBuffer> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch audio file: ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return await context.decodeAudioData(arrayBuffer);
    }

    static async loadFromFile(file: File, context: AudioContext): Promise<AudioBuffer> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                if (!e.target?.result) {
                    reject(new Error('Failed to read file'));
                    return;
                }

                try {
                    const arrayBuffer = e.target.result as ArrayBuffer;
                    const buffer = await context.decodeAudioData(arrayBuffer);
                    resolve(buffer);
                } catch (err) {
                    console.error('Error decoding audio data:', err);
                    reject(new Error('Failed to decode audio data. The file format might not be supported.'));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsArrayBuffer(file);
        });
    }
}
