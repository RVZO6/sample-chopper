
/**
 * Maps a UI attack value (0-100) to engine seconds.
 * Assumption: 0-100 maps to 0-2 seconds.
 */
export const mapAttackToSeconds = (value: number): number => {
    return (value / 100) * 2;
};

/**
 * Maps a UI release value (0-100) to engine seconds.
 * Assumption: 0-100 maps to 0-5 seconds.
 */
export const mapReleaseToSeconds = (value: number): number => {
    return (value / 100) * 5;
};

/**
 * Maps a UI speed value (percentage) to engine playback rate.
 * Example: 100 -> 1.0, 50 -> 0.5, 200 -> 2.0
 */
export const mapSpeedToRate = (value: number): number => {
    return value / 100;
};

/**
 * Formats seconds into milliseconds (ms)
 */
export const formatTime = (seconds: number): string => {
    const ms = Math.round(seconds * 1000);
    return `${ms}ms`;
};
