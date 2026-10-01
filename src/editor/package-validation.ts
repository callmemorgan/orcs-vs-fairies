import { createContentBundle, decodeContentPackage } from '../core/content-registry';
import { decodeMapPackage, validateEditorMap } from './map-package';
import { decodeScenarioPackage } from './scenario-package';

/** Community admission and installation share local play's package decoders. */
export const communityPackageValidators = {
  map(input: unknown) {
    const value = decodeMapPackage(input), validation = validateEditorMap(value.map);
    if (!validation.valid) throw new Error(`Map cannot be played: ${validation.issues.join('; ')}`);
    return value;
  },
  scenario: decodeScenarioPackage,
  mod: decodeContentPackage,
  modClosure: createContentBundle,
};
