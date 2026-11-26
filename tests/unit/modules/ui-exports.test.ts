import * as contract from '@contract';
import * as deep from '@deep';
import * as demo from '@demo';
import * as projects from '@projects';
import * as run from '@run';
import * as settings from '@settings';
import * as snippet from '@snippet';
import { describe, expect, it } from 'vitest';

describe('SPEC-ARCH-11, 13.6: deep-analysis and demo UI names are implemented components', () => {
  it('SPEC-ARCH-11: deep-analysis exports DeepAnalysisButton and DeepConfirmSheet as functions', () => {
    for (const n of ['DeepAnalysisButton', 'DeepConfirmSheet']) {
      expect(typeof (deep as Record<string, unknown>)[n], n).toBe('function');
    }
  });

  it('SPEC-ARCH-11: demo exports TrySampleButton, SampleBanner, LoadFixedButton as functions', () => {
    for (const n of ['TrySampleButton', 'SampleBanner', 'LoadFixedButton']) {
      expect(typeof (demo as Record<string, unknown>)[n], n).toBe('function');
    }
  });
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

describe('SPEC-ARCH-11, 13.3: projects and dom-snippet UI names are implemented components', () => {
  it('SPEC-ARCH-11: projects exports ProjectsScreen, ProjectInputs, ImageDropZone, ProjectHead as functions', () => {
    for (const n of ['ProjectsScreen', 'ProjectInputs', 'ImageDropZone', 'ProjectHead', 'StateNotice']) {
      expect(typeof (projects as Record<string, unknown>)[n], n).toBe('function');
    }
  });

  it('SPEC-ARCH-11: dom-snippet exports SnippetPanel and SnapshotPasteField as functions', () => {
    for (const n of ['SnippetPanel', 'SnapshotPasteField']) {
      expect(typeof (snippet as Record<string, unknown>)[n], n).toBe('function');
    }
  });
});

describe('SPEC-ARCH-11, 13.5: run UI names are implemented components', () => {
  it('SPEC-ARCH-11: run exports RunScreen, FindingList, FindingDetail, ComparisonView, EngineTrace, RunHistory, RunProgress as functions', () => {
    for (const n of [
      'RunScreen',
      'FindingList',
      'FindingDetail',
      'ComparisonView',
      'EngineTrace',
      'RunHistory',
      'RunProgress',
    ]) {
      expect(typeof (run as Record<string, unknown>)[n], n).toBe('function');
    }
  });
});
