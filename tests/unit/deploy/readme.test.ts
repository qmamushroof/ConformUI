import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readme = readFileSync('README.md', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { repository: { url: string } };

describe('README', () => {
  it('SPEC-DEPLOY-04, SPEC-AI-13: names all three InferenceMode values', () => {
    for (const m of ['ONLY_ON_DEVICE', 'PREFER_ON_DEVICE', 'ONLY_IN_CLOUD']) expect(readme).toContain(m);
  });
  it('SPEC-DEPLOY-04, PRD-D-30: no placeholders, real hosted and repo URLs', () => {
    expect(readme).not.toContain('<HOSTED_URL>');
    expect(readme).not.toContain('<REPO_URL>');
    expect(readme).toContain('https://conformui.web.app');
    expect(readme).toContain(pkg.repository.url);
  });
  it('SPEC-DEPLOY-04: sections appear in SPEC order', () => {
    const order = [
      '## What it does',
      '## How Firebase AI Logic is used',
      '## The three engines',
      '## Features and value',
      '## Screenshots',
      '## Quick start',
      '## Setup',
      '## Enabling on-device AI in Chrome',
      '## Tested browsers',
      '## Deploy',
      '## Verify checklist',
      '## Demo video',
      '## Honest limits',
      '## Privacy',
      '## License',
    ].map((h) => readme.indexOf(h));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
  it('SPEC-DEPLOY-04, SPEC §4.11.2: states the hand-authored sample limit and links the AI code', () => {
    expect(readme).toContain("The sample's pre-computed results are hand-authored");
    expect(readme).toContain('src/platform/ai-engine/');
  });
  it('PRD-D-15: no em dash and no build-tool names', () => {
    expect(readme).not.toContain('—');
    expect(readme).not.toMatch(/\b(vite|biome|claude|copilot|cursor)\b/i);
  });
});
