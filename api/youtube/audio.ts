import { resolveYouTubeAudio } from '../_lib/youtubeAudio';

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

    try {
        const result = await resolveYouTubeAudio(videoId);
        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        res.status(200).json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to resolve YouTube audio stream';
        res.status(502).json({ error: message });
    }
}
