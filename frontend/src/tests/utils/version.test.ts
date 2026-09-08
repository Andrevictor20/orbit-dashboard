import { describe, it, expect } from 'vitest';
import { isNewerVersion } from '../../utils/version';

describe('isNewerVersion', () => {
  it('returns true when latest is strictly newer than current', () => {
    expect(isNewerVersion('2.7.1', '2.7.0')).toBe(true);
    expect(isNewerVersion('v2.7.1', 'v2.7.0')).toBe(true);
    expect(isNewerVersion('v2.8.0', '2.7.0')).toBe(true);
    expect(isNewerVersion('3.0.0', '2.7.0')).toBe(true);
    expect(isNewerVersion('2.7.0-rc1', '2.6.9')).toBe(true);
  });

  it('returns false when latest is equal to current', () => {
    expect(isNewerVersion('2.7.0', '2.7.0')).toBe(false);
    expect(isNewerVersion('v2.7.0', 'v2.7.0')).toBe(false);
    expect(isNewerVersion('v2.7.0', '2.7.0')).toBe(false);
    expect(isNewerVersion('2.7.0', 'v2.7.0')).toBe(false);
  });

  it('returns false when latest is older than current', () => {
    expect(isNewerVersion('2.6.9', '2.7.0')).toBe(false);
    expect(isNewerVersion('v2.5.0', 'v2.7.0')).toBe(false);
    expect(isNewerVersion('1.9.9', '2.7.0')).toBe(false);
  });

  it('returns false for null, undefined or empty strings', () => {
    expect(isNewerVersion(null, '2.7.0')).toBe(false);
    expect(isNewerVersion('2.7.0', null)).toBe(false);
    expect(isNewerVersion(undefined, undefined)).toBe(false);
    expect(isNewerVersion('', '')).toBe(false);
  });
});
