// Deliberate violation (SPEC-ARCH-06 g): a feature importing @fb.
import { firebaseApp } from '@fb';

export const measured: string = firebaseApp;
