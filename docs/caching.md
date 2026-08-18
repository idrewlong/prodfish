# Caching, and why `vercel.json` looks the way it does

`vercel.json` is validated against a strict schema at deploy time and rejects
unknown properties, so it cannot carry comments. The reasoning lives here.

Nearly the whole cost of visiting this site is ~9MB of models and the Draco
decoder. Everything below is about not charging a returning visitor for them
twice, without ever pinning one to a stale build.

### `/assets/*` — one year, `immutable`

Vite content-hashes every file it emits, so a changed file is a changed URL.
There is no staleness risk to trade against, and `immutable` additionally
stops the browser revalidating on a hard refresh.

### `/models/*`, `/draco/*` — one day, then a month of `stale-while-revalidate`

These are the big ones, and they are served from `public/` under stable,
unhashed names — `church.glb` is `church.glb` forever. `immutable` here would
be a trap: a rebuilt chapel would not reach anyone who had already visited
until their cache expired, and the whole point of a long max-age is that it
does not expire.

`stale-while-revalidate` buys the same instant load without that. For a day
the cached copy is served outright. For the month after, it is still served
immediately — no waiting — while the browser refreshes it in the background,
so the next visit has the new file. A rebuilt model reaches every returning
visitor within one visit of shipping, and nobody ever blocks on revalidating
4MB.

The real fix is content-hashed model filenames, which would let these join
`/assets/*` on the permanent tier. That is a bigger change: the paths are
written as literal strings in `src/main.js`, `src/world/world.js` and the
preload script in `index.html`. Worth doing if the models start changing
often; over-engineering while they change twice a year.

### `/` — always revalidate

`index.html` is the file that names the current content-hashed bundles. Cache
it and a deploy never reaches anyone.

### Security headers

`nosniff`, `strict-origin-when-cross-origin` and `SAMEORIGIN` on everything.
Note that `X-Frame-Options: SAMEORIGIN` stops *this* page being framed by
others; it has no effect on the BeatStars player this page frames.
