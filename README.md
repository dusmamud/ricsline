# Ricsline — Free Online LRC Maker

> A **Dusrel** product — part of the [Dusrel](https://dusrel.com) ecosystem.

**Every line, on time.** Create perfectly synced lyrics (`.lrc` files) for your songs in minutes — free, no sign-up, your audio never leaves your browser.

🌐 Live site: _(coming soon — deploy `dist/` to Cloudflare Pages)_

## Features

- **Tap-to-sync** — play your MP3 and tap the floating button (or press `Spacebar`) to timestamp each lyric line
- **Precise timing** — `[mm:ss.xx]` centisecond format, click any line to seek, inline timestamp editing
- **Offset shifter** — shift all timestamps ± seconds in one click
- **Import existing `.lrc`** — parses tags + metadata, lets you re-sync
- **Export** — download `.lrc`, copy LRC text, copy JSON structure, save to browser
- **100% private** — MP3 is processed locally; nothing is uploaded anywhere

## Tech

- **Astro** static site (landing, about, privacy, terms) + **React** maker island (`client:only`)
- **20 languages** — every page translated with its own URL, `hreflang` SEO, RTL for Arabic/Urdu
- **Light / Dark / System** theme (sky-blue `#0EA5E9` + graphite)
- **Phosphor Icons**, self-hosted fonts (Sora + Inter, zero CDN), CSS animations + view transitions

### Locales

`en` `hi` `bn` `as` `es` `pt` `fr` `ar` `ur` `zh` `ja` `ko` `ru` `id` `de` `tr` `it` `vi` `th` `ta`

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # static output in dist/
npm run preview  # preview the build
```

## Deploy

`dist/` is fully static — drag it into [Cloudflare Pages](https://pages.cloudflare.com/), Netlify, or any static host. No server needed.

## License

All rights reserved.
Tip: press `Spacebar` (or tap the floating button) while the MP3 plays to timestamp each lyric line as you hear it.
Tip: if every line is slightly early or late, use the offset shifter to move all timestamps by ± seconds at once instead of editing lines one by one.
