/**
 * Application-wide constants.
 * Centralized location for magic numbers and configuration values.
 */

// ============================================================================
// Audio Constants
// ============================================================================

/** Minimum BPM value allowed */
export const BPM_MIN = 50;

/** Maximum BPM value allowed */
export const BPM_MAX = 250;

/** Minimum time stretch percentage */
export const TIME_STRETCH_MIN = 50;

/** Maximum time stretch percentage */
export const TIME_STRETCH_MAX = 200;

/** Default time stretch percentage (normal speed) */
export const TIME_STRETCH_DEFAULT = 100;

// ============================================================================
// UI Constants  
// ============================================================================

/** Drag sensitivity in pixels per unit change */
export const DRAG_SENSITIVITY_PX = 3;

/** Delay before entering edit mode (allows double-click detection) */
export const EDIT_MODE_DELAY_MS = 100;

/** Minimum release time for pad fade-out in ms */
export const MIN_RELEASE_TIMEOUT_MS = 15;
