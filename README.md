# mirror-ecco

Source for **mirror.etherealconnectionsco.com** — the ECCO Mirror surface.
Provenance Architecture for a single human life. Commission funnel plus
case-study sample (the Jordan / `/jowi/` sample, published with consent).

## Posture

**Public repository.** Mirror is a case-study surface; visibility supports
discovery, provenance verification, and the demonstration that ECCO's
Mirror methodology produces work worth commissioning. Licensed under
[CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/) —
read, cite, link, share for non-commercial purposes; do not repackage
or rebrand. See `LICENSE` for full terms.

**Subject-narrative carve-out.** The personal narrative content within
`/jowi/` (and any future Mirror sample) is the property of the named
subject, not ECCO. It is published with that subject's consent and is
**NOT** included in the CC BY-NC-ND 4.0 grant. Reproducing, excerpting,
or redistributing subject narratives requires separate written
permission from both the subject and ECCO. This is named explicitly in
`LICENSE`.

The build pipeline runs against the same `check-links.mjs` v4 gate as
the rest of ECCO so the doctrine is enforced uniformly — the integrity
is structural across every surface, public or private.

## Doctrine

> Every external claim verifiable. Every link live.
> Live = reachable by a human in a browser. Not "reachable by every bot."

The build pipeline enforces this. A push that introduces a dead external
URL fails the build before it can ship; the last good version stays live.

## What the gate catches on this surface

The Mirror landing page is nearly all internal — hash anchors and the
`/jowi/` relative link to the sample. The sample itself (`/jowi/index.html`)
contains a small set of external citations to the institutions named in
the subject's professional history (NYC hospital and research-institution
career pages). The build gate verifies these on every push; if any are
moved or genuinely 404, the build fails and the patch is one URL fix.

Some of these institutional career pages may return 403 to cloud-runner
traffic (anti-bot policy) — those are logged as TOLERATED and the build
passes. The doctrine here is the same as on Scanner and Library:
mechanical enforcement where possible, named limitations where it isn't,
quarterly editorial review across every external citation regardless.

## Build

```
node check-links.mjs index.html 404.html jowi/index.html thank-you/index.html
```

Runs on Netlify Node 20, no local install required. Auto-deploys on push
to `main`. Configuration in `netlify.toml`.

Status taxonomy:
- **OK** (2xx / 3xx) — verified live.
- **TOLERATED** (401 / 403 / 451 / 999, or any non-2xx from the cloud-block
  whitelist) — site refuses automation but resolves for humans. Logged,
  build passes.
- **BROKEN** (other 4xx / 5xx / network error) — build fails.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Mirror landing page — commission funnel, three tiers |
| `404.html` | Custom 404 |
| `jowi/index.html` | The Jordan sample (published with consent) |
| `thank-you/index.html` | Post-intake confirmation page |
| `check-links.mjs` | Build-gate link integrity checker (v4) |
| `render_pdf.py` | Local archival tool — Playwright-driven HTML→PDF capture for consented sample archive |
| `netlify.toml` | Build configuration |
| `LICENSE` | CC BY-NC-ND 4.0 (with subject-narrative carve-out) |
| `.gitignore` | Standard exclusions |

## Local tooling

`render_pdf.py` is a local archival utility, not part of the Netlify
build. It captures a print-fidelity PDF of any deployed Mirror sample
so the consented version at point of publication can be frozen, hashed,
and committed alongside the source HTML.

This is the Mirror layer of SPA v0.1 §3.2 (Provenance) and §3.5
(Sanctioning) made operational: the source HTML is the live surface;
the archived PDF is the tamper-evident receipt that the consented form
was honored on the date it was published.

Setup once:

```bash
pip install playwright
playwright install chromium
```

Then, at the moment a sample is published:

```bash
python render_pdf.py jowi/index.html archive/jowi-2026-05-04.pdf
```

The resulting PDF is intended to be committed to the repo as part of
the immutable record. The named subject can link to a stable URL for
their own canonical copy.

## License & use

This repository is published under
[CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/).
See `LICENSE` for full terms.

**You may:** read, link to, cite the Mirror methodology and design, and
share for non-commercial purposes with attribution to Ethereal
Connections Co.

**You may not:** repackage, rebrand, fork-and-resell, incorporate into
paid products, paid courses, paid newsletters, or any commercial
offering without prior written permission.

**You also may not** reproduce, excerpt, or redistribute the personal
narrative content of any Mirror sample (including the `/jowi/` content)
without separate written permission from the named subject and from ECCO.
The subject's life is not licensed; the sample is shown with consent.

ECCO operates this repository under a public case-study posture. Other
ECCO surfaces (commercial methodology, revenue infrastructure) are
intentionally closed. The visibility of this repository is editorial,
not an invitation to extraction.

For commercial licensing, partnership, or any use beyond the terms above:
**jeremiah@etherealconnectionsco.com**

## Doctrinal artifacts in play

This repo joins `scan-ecco` (public, CC BY-NC-ND 4.0) and `toolkit-ecco`
(public, CC BY-NC-ND 4.0) on the public-surface side, and
`commission-ecco` (private, all rights reserved) on the closed-methodology
side. The build pipeline is the same on every surface; what differs is
the visibility posture and the surface-specific integrity profile.

---

*Part of the Track G Phase 2 migration from Netlify Drop to Git-driven CI.*

*Provenance over performance. Infrastructure over influence. Doctrine over excuse.*
