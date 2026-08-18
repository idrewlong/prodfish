// PLACEHOLDER CONTENT — swap for real credits and bio.
// This is the only file that needs to change; nothing here is referenced by
// name anywhere else, so edits cannot break the scene.

// `spotify` is where the row points: "the work" is finished records people
// want to hear, and BeatStars is already the whole beats panel. It is optional
// on purpose. A credit without a real Spotify URL renders as plain text rather
// than as a link to nowhere (see creditLink below), so these can be filled in
// one at a time and each row starts working the moment its URL lands — no
// other file needs touching.
export const CREDITS = [
  { artist: 'placeholder artist one',   track: 'nightshade',     spotify: null },
  { artist: 'placeholder artist two',   track: 'delta psalm',    spotify: null },
  { artist: 'placeholder artist three', track: 'kerosene choir', spotify: null },
  { artist: 'placeholder artist four',  track: 'low country',    spotify: null },
  { artist: 'placeholder artist five',  track: 'revival tent',   spotify: null },
  { artist: 'placeholder artist six',   track: 'hollow point',   spotify: null },
  { artist: 'placeholder artist seven', track: 'saltwater hymn', spotify: null },
  { artist: 'placeholder artist eight', track: 'crooked mile',   spotify: null },
  { artist: 'placeholder artist nine',  track: 'blackwater',     spotify: null },
  { artist: 'placeholder artist ten',   track: 'last rites',     spotify: null },
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
  // Matches /track/, /album/, /artist/ and /episode/ — anything Spotify links
  // out to — followed by at least one id character.
  return /^https:\/\/open\.spotify\.com\/[a-z]+\/[^/\s]+/i.test(trimmed) ? trimmed : null;
}

export const BIO =
  'Placeholder bio. prodfish makes beats out of the dark south — tape hiss, '
  + 'bent guitars, and drums that sound like they were recorded in an empty '
  + 'room after midnight. Credits span independent releases and label work; '
  + 'the full catalog lives on BeatStars.';

// Carved into the rider's chapel wall, and rendered as real links in the
// static portfolio section for keyboard, screen-reader and crawler access.
// These two are real and verified; index.html's JSON-LD lists the same pair
// as `sameAs`, so add there too if this list grows. YouTube and TikTok were
// here as PLACEHOLDER URLs and have been removed rather than left pointing
// nowhere — put them back the moment there are real ones.
export const SOCIALS = [
  { label: 'instagram', url: 'https://www.instagram.com/prodfish/' },
  { label: 'twitter', url: 'https://x.com/prodfish' },
];

export const CATALOG_URL = 'https://www.beatstars.com/PLACEHOLDER';
