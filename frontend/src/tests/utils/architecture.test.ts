import { describe, it, expect } from 'vitest';
import { parseAppArchitectures, isArchCompatibleWithHost } from '../../utils/architecture';

describe('Architecture Utilities', () => {
  describe('parseAppArchitectures', () => {
    it('treats empty or undefined architectures as multi-arch universal default', () => {
      const parsedUndefined = parseAppArchitectures(undefined);
      expect(parsedUndefined.supportsX86).toBe(true);
      expect(parsedUndefined.supportsArm).toBe(true);
      expect(parsedUndefined.isMultiArch).toBe(true);
      expect(parsedUndefined.isOnlyX86).toBe(false);
      expect(parsedUndefined.isOnlyArm).toBe(false);

      const parsedEmpty = parseAppArchitectures([]);
      expect(parsedEmpty.isMultiArch).toBe(true);
    });

    it('identifies multi-arch apps correctly', () => {
      const parsed = parseAppArchitectures(['amd64', 'arm64']);
      expect(parsed.supportsX86).toBe(true);
      expect(parsed.supportsArm).toBe(true);
      expect(parsed.isMultiArch).toBe(true);
      expect(parsed.isOnlyX86).toBe(false);
      expect(parsed.isOnlyArm).toBe(false);
      expect(parsed.family).toBe('multi');
    });

    it('identifies x86_64-only apps correctly and marks as not supporting ARM', () => {
      const parsed = parseAppArchitectures(['amd64']);
      expect(parsed.supportsX86).toBe(true);
      expect(parsed.supportsArm).toBe(false);
      expect(parsed.isMultiArch).toBe(false);
      expect(parsed.isOnlyX86).toBe(true);
      expect(parsed.isOnlyArm).toBe(false);
      expect(parsed.family).toBe('x86');
    });

    it('identifies ARM-only apps correctly and marks as not supporting x86', () => {
      const parsed = parseAppArchitectures(['arm64']);
      expect(parsed.supportsX86).toBe(false);
      expect(parsed.supportsArm).toBe(true);
      expect(parsed.isMultiArch).toBe(false);
      expect(parsed.isOnlyX86).toBe(false);
      expect(parsed.isOnlyArm).toBe(true);
      expect(parsed.family).toBe('arm');
    });

    it('supports multiple variants like x86_64, aarch64, armv7', () => {
      const parsed = parseAppArchitectures(['x86_64', 'aarch64', 'armv7']);
      expect(parsed.supportsX86).toBe(true);
      expect(parsed.supportsArm).toBe(true);
      expect(parsed.isMultiArch).toBe(true);
    });
  });

  describe('isArchCompatibleWithHost', () => {
    it('returns warning when host is unknown but app is only x86', () => {
      const parsed = parseAppArchitectures(['amd64']);
      const result = isArchCompatibleWithHost(parsed, undefined);
      expect(result.isCompatible).toBe(true);
      expect(result.severity).toBe('warning');
      expect(result.warningMessage).toContain('ARM');
    });

    it('returns warning when host is unknown but app is only ARM', () => {
      const parsed = parseAppArchitectures(['arm64']);
      const result = isArchCompatibleWithHost(parsed, undefined);
      expect(result.isCompatible).toBe(true);
      expect(result.severity).toBe('warning');
      expect(result.warningMessage).toContain('x86');
    });

    it('flags incompatibility when host is ARM and app is only x86', () => {
      const parsed = parseAppArchitectures(['amd64']);
      const result = isArchCompatibleWithHost(parsed, 'aarch64');
      expect(result.isCompatible).toBe(false);
      expect(result.severity).toBe('incompatible');
      expect(result.warningMessage).toContain('Incompatível');
    });

    it('flags incompatibility when host is x86 and app is only ARM', () => {
      const parsed = parseAppArchitectures(['arm64']);
      const result = isArchCompatibleWithHost(parsed, 'x86_64');
      expect(result.isCompatible).toBe(false);
      expect(result.severity).toBe('incompatible');
      expect(result.warningMessage).toContain('Incompatível');
    });

    it('confirms compatibility when both host and app match', () => {
      const parsedMulti = parseAppArchitectures(['amd64', 'arm64']);
      const resArm = isArchCompatibleWithHost(parsedMulti, 'aarch64');
      expect(resArm.isCompatible).toBe(true);
      expect(resArm.severity).toBe('none');

      const resX86 = isArchCompatibleWithHost(parsedMulti, 'x86_64');
      expect(resX86.isCompatible).toBe(true);
      expect(resX86.severity).toBe('none');
    });
  });
});
