import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CREDITS, BIO, CATALOG_URL, SOCIALS, creditLink } from '../src/content/portfolio.js';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
const jsonLd = JSON.parse(
  html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
);

describe('portfolio content', () => {
  it('has exactly ten credits, one per monument stone', () => {
    expect(CREDITS).toHaveLength(10);
  });
  // The ledger renders artist and track for every row whether or not it links
  // anywhere, so those two are required; `spotify` is optional by design.
  it('every credit has an artist and a track', () => {
    for (const c of CREDITS) {
      expect(typeof c.artist).toBe('string');
      expect(c.artist.length).toBeGreaterThan(0);
      expect(typeof c.track).toBe('string');
      expect(c.track.length).toBeGreaterThan(0);
    }
  });

  it('any credit that declares a spotify url declares a usable one', () => {
    // Guards against a half-pasted URL silently rendering the row inert: if
    // the field is filled in at all, creditLink() must accept it.
    for (const c of CREDITS) {
      if (c.spotify === null || c.spotify === undefined) continue;
      expect(creditLink(c), `${c.track} has an unusable spotify url`).not.toBeNull();
    }
  });
  it('bio is a few sentences, not a stub', () => {
    expect(BIO.length).toBeGreaterThan(80);
  });
  it('exposes a catalog url', () => {
    expect(CATALOG_URL).toMatch(/^https?:\/\//);
  });
});

// The about panel renders SOCIALS; index.html's JSON-LD repeats the same URLs
// as `sameAs`, which is the claim that this domain and those profiles are one
// entity. The two are written in different files and different languages, so
// nothing but this stops someone adding a profile to one and not the other --
// and a `sameAs` that lists a profile the page does not link is precisely the
// mismatch that gets structured data distrusted.
describe('social links', () => {
  it('are all real urls, no leftover placeholders', () => {
    expect(SOCIALS.length).toBeGreaterThan(0);
    for (const s of SOCIALS) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.url).not.toMatch(/PLACEHOLDER/i);
      expect(s.label.length).toBeGreaterThan(0);
    }
  });

  it("match the JSON-LD sameAs in index.html exactly", () => {
    expect([...jsonLd.sameAs].sort()).toEqual(SOCIALS.map((s) => s.url).sort());
  });

  it('describe the same entity the page canonicalises to', () => {
    expect(jsonLd.url).toBe(html.match(/rel="canonical" href="([^"]+)"/)[1]);
  });
});

// Every credit's URL is still PLACEHOLDER, so the ledger must be able to render
// a row that has nowhere to go. creditLink() is the single place that decides:
// a real Spotify URL makes the row a link, anything else makes it plain text.
// Shipping a row that LOOKS clickable and goes nowhere is worse than a row
// that is honestly inert, and this is what keeps that from happening by
// accident as real URLs are pasted in one at a time.
describe('creditLink', () => {
  it('returns the spotify url when there is a real one', () => {
    expect(creditLink({ spotify: 'https://open.spotify.com/track/abc' }))
      .toBe('https://open.spotify.com/track/abc');
  });

  it('accepts album and artist urls, not just tracks', () => {
    expect(creditLink({ spotify: 'https://open.spotify.com/album/xyz' }))
      .toBe('https://open.spotify.com/album/xyz');
  });

  it.each([
    ['missing', {}],
    ['null', { spotify: null }],
    ['empty', { spotify: '' }],
    ['whitespace', { spotify: '   ' }],
    ['a placeholder', { spotify: 'https://open.spotify.com/track/PLACEHOLDER' }],
    ['not a url', { spotify: 'coming soon' }],
    ['insecure', { spotify: 'http://open.spotify.com/track/abc' }],
    ['off-platform', { spotify: 'https://example.com/track/abc' }],
  ])('returns null when the url is %s', (_label, credit) => {
    expect(creditLink(credit)).toBeNull();
  });

  it('never throws on a malformed credit', () => {
    expect(() => creditLink({})).not.toThrow();
    expect(() => creditLink({ spotify: 42 })).not.toThrow();
  });
});
