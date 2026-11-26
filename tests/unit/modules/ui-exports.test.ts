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
  ['run', run, ['RunScreen', 'FindingList', 'FindingDetail', 'ComparisonView', 'EngineTrace', 'RunHistory']],
  ['deep-analysis', deep, ['DeepAnalysisButton', 'DeepConfirmSheet']],
  ['demo', demo, ['TrySampleButton', 'SampleBanner', 'LoadFixedButton']],
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

describe('SPEC-ARCH-11, 13.2: settings UI names are implemented components', () => {
  it('SPEC-ARCH-11: settings exports its six components as functions', () => {
    for (const n of [
      'SettingsScreen',
      'EnginePanel',
      'EngineBadge',
      'PrivacyCounter',
      'OnboardingScreen',
      'ConsentSheet',
    ]) {
      expect(typeof (settings as Record<string, unknown>)[n], n).toBe('function');
    }
  });
});

describe('SPEC-ARCH-11, 13.4: contract UI names are implemented components', () => {
  it('SPEC-ARCH-11: contract exports ContractScreen, RequirementRow, RequirementEditor as functions', () => {
    for (const n of ['ContractScreen', 'RequirementRow', 'RequirementEditor']) {
      expect(typeof (contract as Record<string, unknown>)[n], n).toBe('function');
    }
  });
});
