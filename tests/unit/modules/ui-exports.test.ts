import * as contract from '@contract';
import * as deep from '@deep';
import * as demo from '@demo';
import * as projects from '@projects';
import * as run from '@run';
import * as settings from '@settings';
import * as snippet from '@snippet';
import { describe, expect, it } from 'vitest';

// SPEC-ARCH-11: every index.ts declares its full public API from Step 0, UI components included (stubs until lane C).
const UI: [string, Record<string, unknown>, string[]][] = [
  ['projects', projects, ['ProjectsScreen', 'ProjectInputs', 'ImageDropZone']],
  ['contract', contract, ['ContractScreen', 'RequirementRow', 'RequirementEditor']],
  ['run', run, ['RunScreen', 'FindingList', 'FindingDetail', 'ComparisonView', 'EngineTrace', 'RunHistory']],
  ['deep-analysis', deep, ['DeepAnalysisButton', 'DeepConfirmSheet']],
  ['demo', demo, ['TrySampleButton', 'SampleBanner', 'LoadFixedButton']],
  [
    'settings',
    settings,
    ['SettingsScreen', 'EnginePanel', 'EngineBadge', 'PrivacyCounter', 'OnboardingScreen', 'ConsentSheet'],
  ],
  ['dom-snippet', snippet, ['SnippetPanel', 'SnapshotPasteField']],
];

describe('SPEC-ARCH-11: UI component names are declared in each module index', () => {
  for (const [name, mod, names] of UI) {
    it(`SPEC-ARCH-11: ${name} exports ${names.join(', ')} as stubs that throw 'not implemented'`, () => {
      for (const n of names) {
        const component = mod[n] as (props: unknown) => unknown;
        expect(typeof component, n).toBe('function');
        expect(() => component({}), n).toThrow('not implemented');
      }
    });
  }
});
