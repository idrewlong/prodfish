import { describe, it, expect } from 'vitest';
import { CREDITS, BIO, CATALOG_URL } from '../src/content/portfolio.js';

describe('portfolio content', () => {
  it('has exactly ten credits, one per monument stone', () => {
    expect(CREDITS).toHaveLength(10);
  });
  it('every credit has artist, track and a url', () => {
    for (const c of CREDITS) {
      expect(typeof c.artist).toBe('string');
      expect(c.artist.length).toBeGreaterThan(0);
      expect(typeof c.track).toBe('string');
      expect(c.track.length).toBeGreaterThan(0);
      expect(c.url).toMatch(/^https?:\/\//);
    }
  });
  it('bio is a few sentences, not a stub', () => {
    expect(BIO.length).toBeGreaterThan(80);
  });
  it('exposes a catalog url', () => {
    expect(CATALOG_URL).toMatch(/^https?:\/\//);
  });
});
