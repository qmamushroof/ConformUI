import { z } from 'zod';

// Spike D1 (4.5): zod 4 probes `new Function` at module load, which the enforced CSP forbids (no 'unsafe-eval').
// This side-effect module must be the first import of `main.tsx`, before anything that imports `@kernel`, so every
// schema is built in jitless mode. The kernel itself is unchanged.
z.config({ jitless: true });
