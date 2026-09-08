/**
 * Utility functions for Semantic Versioning comparisons.
 */

export function isNewerVersion(latest?: string | null, current?: string | null): boolean {
  if (!latest || !current) return false;

  const parse = (v: string): [number, number, number] => {
    const clean = v.replace(/^v/, '').trim();
    const parts = clean.split('.');
    const major = parseInt(parts[0], 10) || 0;
    const minor = parseInt(parts[1], 10) || 0;
    const patch = parseInt((parts[2] || '').split('-')[0], 10) || 0;
    return [major, minor, patch];
  };

  const [lMaj, lMin, lPat] = parse(latest);
  const [cMaj, cMin, cPat] = parse(current);

  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPat > cPat;
}
