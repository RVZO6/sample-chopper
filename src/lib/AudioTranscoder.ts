import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

const ffmpeg = new FFmpeg();
let ffmpegLoadPromise: Promise<void> | null = null;

async function ensureFFmpegLoaded(): Promise<void> {
    if (ffmpeg.loaded) {
        return;
    }

    if (!ffmpegLoadPromise) {
        ffmpegLoadPromise = ffmpeg.load({
            classWorkerURL: '/ffmpeg/worker.js',
            coreURL: '/ffmpeg/ffmpeg-core.js',
            wasmURL: '/ffmpeg/ffmpeg-core.wasm',
        }).then(() => undefined).catch((error) => {
            ffmpegLoadPromise = null;
            throw error;
        });
    }

    await ffmpegLoadPromise;
}

function sanitizeFileStem(fileName: string): string {
    return fileName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'audio';
}

export async function transcodeAudioFileToWav(file: File): Promise<ArrayBuffer> {
    await ensureFFmpegLoaded();

    const inputName = `input-${crypto.randomUUID()}-${sanitizeFileStem(file.name)}`;
    const outputName = `output-${crypto.randomUUID()}.wav`;

    try {
        await ffmpeg.writeFile(inputName, await fetchFile(file));
        const exitCode = await ffmpeg.exec([
            '-i', inputName,
            '-map', '0:a:0',
            '-acodec', 'pcm_s16le',
            '-ac', '2',
            '-ar', '44100',
            outputName,
        ]);

        if (exitCode !== 0) {
            throw new Error(`FFmpeg exited with code ${exitCode}`);
        }

        const output = await ffmpeg.readFile(outputName);
        if (!(output instanceof Uint8Array)) {
            throw new Error('FFmpeg returned unexpected output data.');
        }

        return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
    } finally {
        await Promise.allSettled([
            ffmpeg.deleteFile(inputName),
            ffmpeg.deleteFile(outputName),
        ]);
    }
}
