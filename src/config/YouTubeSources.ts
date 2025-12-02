
export type APIType = 'piped' | 'invidious';

export interface APISource {
    name: string;
    type: APIType;
    baseUrl: string;
}

// Add or remove instances here to update the available sources
export const YOUTUBE_API_SOURCES: APISource[] = [
    {
        name: 'Invidious (Perditum)',
        type: 'invidious',
        baseUrl: 'https://inv.perditum.com'
    },
    {
        name: 'Piped (Project Segfault)',
        type: 'piped',
        baseUrl: 'https://pipedapi.in.projectsegfau.lt'
    }
];
