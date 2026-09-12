// The site's content, and the only file that needs to change to update it.
// Nothing here is referenced by name anywhere else, so edits cannot break the
// scene.

// The ledger on "the work". `artist` is the performer; FISH is the producer on
// every one of these, which is what the panel as a whole says, so repeating it
// on each row would be noise. Order follows the Genius artist page, which sorts
// by plays -- most-heard first.
//
// `spotify` is where a row points: "the work" is finished records people want
// to hear. It is optional on purpose. A credit without a real Spotify URL
// renders as plain text rather than as a link to nowhere (see creditLink
// below), so these can be filled in one at a time and each row starts working
// the moment its URL lands -- no other file needs touching.
export const CREDITS = [
  { artist: 'BIGBABYGUCCI',        track: 'Drop Top Lexus',         spotify: null },
  { artist: 'BIGBABYGUCCI',        track: "Can't Feel Shit",        spotify: null },
  { artist: 'Weiland',             track: 'Temptation [Version 1]', spotify: null },
  { artist: 'Weiland',             track: 'Heart Stop',             spotify: null },
  { artist: 'Weiland & MIKE DEAN', track: 'Blaming Myself',         spotify: null },
  { artist: 'Weiland',             track: 'Dangerous Woman',        spotify: null },
  { artist: 'BIGBABYGUCCI',        track: 'Pressure + Layers',      spotify: null },
  { artist: 'BIGBABYGUCCI',        track: 'Seeing Ghosts',          spotify: null },
  { artist: 'Weiland',             track: 'Let Me Go (2020)',       spotify: null },
  { artist: 'Weiland',             track: 'Farewell',               spotify: null },
];

// The one place that decides whether a credit row is a link. Deliberately
// strict: it must be an https open.spotify.com URL with something after the
// type segment, so a half-filled entry ("coming soon", a bare domain, a URL
// still reading PLACEHOLDER) is treated as absent rather than shipped as a
// dead link. Returns the URL or null; callers render plain text on null.
export function creditLink(credit) {
  const url = credit?.spotify;
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (/placeholder/i.test(trimmed)) return null;
  // Matches /track/, /album/, /artist/ and /episode/ -- anything Spotify links
  // out to -- followed by at least one id character.
  return /^https:\/\/open\.spotify\.com\/[a-z]+\/[^/\s]+/i.test(trimmed) ? trimmed : null;
}

export const BIO =
  'Placeholder bio. prodfish makes beats out of the dark south -- tape hiss, '
  + 'bent guitars, and drums that sound like they were recorded in an empty '
  + 'room after midnight. Credits span independent releases and label work.';

// Carved into the rider's chapel wall, and rendered as real links in the
// static portfolio section for keyboard, screen-reader and crawler access.
// These two are real and verified; index.html's JSON-LD lists the same pair
// as `sameAs`, so add there too if this list grows. YouTube and TikTok were
// here as PLACEHOLDER URLs and have been removed rather than left pointing
// nowhere -- put them back the moment there are real ones.
export const SOCIALS = [
  { label: 'instagram', url: 'https://www.instagram.com/prodfish/' },
  { label: 'twitter', url: 'https://x.com/prodfish' },
];

// Where "the work" sends anyone who wants the rest of it. This was a BeatStars
// store URL that was never filled in -- it shipped as .../PLACEHOLDER, a link
// to nothing. Genius is the real index of the production catalog, credits and
// all, so the panel points there instead of at two links where one was broken.
export const GENIUS_URL = 'https://genius.com/artists/Fish';
