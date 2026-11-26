import { readFileSync } from 'node:fs';

// Test-only parsing of tokens.css: custom properties per theme, with var() and oklch() resolved to sRGB.

export const read = (p: string): string => readFileSync(p, 'utf8');

export type Vars = Record<string, string>;

function declarations(block: string): Vars {
  const out: Vars = {};
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1] as string] = (m[2] as string).trim();
  return out;
}

/** Body of the first `{ ... }` block that follows `selector` (no nested braces expected). */
function blockAfter(css: string, selector: string): string {
  const at = css.indexOf(selector);
  if (at < 0) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf('{', at);
  return css.slice(open + 1, css.indexOf('}', open));
}

export function lightVars(css: string): Vars {
  return declarations(blockAfter(css, ':root {'));
}

export function darkVars(css: string): Vars {
  const media = css.indexOf('@media (prefers-color-scheme: dark)');
  if (media < 0) throw new Error('no dark media query');
  return { ...lightVars(css), ...declarations(blockAfter(css.slice(media), ':root:not([data-theme="light"])')) };
}

/** Canonical comparable form of a value: lowercase, single spaces, `0.010` equals `0.01`. */
export function normalise(v: string): string {
  return v
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(\d+\.\d*?)0+(?=\D|$)/g, '$1')
    .replace(/(\d+)\.(?=\D|$)/g, '$1')
    .trim();
}

export function resolve(vars: Vars, name: string, depth = 0): string {
  const raw = vars[name];
  if (raw === undefined) throw new Error(`unknown token ${name}`);
  const ref = /^var\((--[\w-]+)\)$/.exec(raw);
  if (!ref) return raw;
  if (depth > 8) throw new Error(`token cycle at ${name}`);
  return resolve(vars, ref[1] as string, depth + 1);
}

type Rgb = [number, number, number];

function oklchToLinear(l: number, c: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return [
    clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

function hexToLinear(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
}

export function luminance(vars: Vars, name: string): number {
  const v = resolve(vars, name);
  let rgb: Rgb;
  const ok = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(v);
  if (ok) rgb = oklchToLinear(Number(ok[1]) / 100, Number(ok[2]), Number(ok[3]));
  else if (/^#[0-9a-f]{6}$/i.test(v)) rgb = hexToLinear(v);
  else throw new Error(`unsupported colour for ${name}: ${v}`);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

export function ratio(vars: Vars, fg: string, bg: string): number {
  const a = luminance(vars, fg);
  const b = luminance(vars, bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const GROUND = ['--bg', '--surface', '--surface-raised', '--surface-sunken'];

/** SPEC-UI-03 pairs: [foreground, background, minimum ratio]. */
export const PAIRS: readonly [string, string, number][] = [
  ...['--text', '--text-muted', '--text-subtle'].flatMap((fg) =>
    GROUND.map((bg): [string, string, number] => [fg, bg, 4.5]),
  ),
  ...['--text', '--text-muted', '--accent'].map((fg): [string, string, number] => [fg, '--accent-subtle', 4.5]),
  ['--accent', '--bg', 4.5],
  ['--accent', '--surface', 4.5],
  ['--accent-fg', '--accent', 4.5],
  ['--accent-fg', '--accent-hover', 4.5],
  ['--danger-fg', '--danger', 4.5],
  ['--success-fg', '--success', 4.5],
  ['--danger', '--bg', 4.5],
  ['--danger', '--surface', 4.5],
  ['--danger', '--surface-raised', 4.5],
  ['--success', '--bg', 4.5],
  ['--success', '--surface', 4.5],
  ['--border-strong', '--bg', 3],
  ['--border-strong', '--surface', 3],
  ['--focus', '--bg', 3],
  ['--focus', '--surface', 3],
];

export function failingPairs(vars: Vars): string[] {
  return PAIRS.flatMap(([fg, bg, min]) => {
    const r = ratio(vars, fg, bg);
    return r < min ? [`${fg} on ${bg}: ${r.toFixed(2)} < ${min}`] : [];
  });
}
