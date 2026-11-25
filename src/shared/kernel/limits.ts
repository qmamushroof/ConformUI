// SPEC-KERNEL-07 limits (stated in the UI, PRD-F-02.2).

export const ACCEPTED_INPUT_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;
export const MAX_SOURCE_SIDE = 8192;
export const MAX_CSS_HEIGHT = 16_000;
export const MAX_SNAPSHOT_BYTES = 1024 * 1024;
export const MAX_SNAPSHOT_ELEMENTS = 1500;
export const MAX_REQUIREMENTS = 60;
export const MAX_PROJECTS = 50; // notice only
