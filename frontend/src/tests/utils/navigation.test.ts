import { describe, it, expect } from 'vitest';
import { preloadRoute } from '../../utils/navigation';

describe('navigation utilities', () => {
  it('preloads routes without throwing and handles query strings/hashes', () => {
    expect(() => preloadRoute('/containers')).not.toThrow();
    expect(() => preloadRoute('/metrics?tab=network')).not.toThrow();
    expect(() => preloadRoute('/store#custom')).not.toThrow();
    expect(() => preloadRoute('')).not.toThrow();
    expect(() => preloadRoute('/unknown-route')).not.toThrow();
  });

  it('tolerates repeated preload calls idempotently', () => {
    expect(() => {
      preloadRoute('/containers');
      preloadRoute('/containers');
      preloadRoute('/containers');
    }).not.toThrow();
  });
});
