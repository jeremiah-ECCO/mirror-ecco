#!/usr/bin/env node
/**
 * ECCO — link integrity check (v4)
 * ---------------------------------------------------------------
 * Doctrine: "Every external claim verifiable. Every link live."
 * Live = reachable by a human in a browser. Not "reachable by every bot."
 *
 * v4 changes (May 2 build #3):
 *   - CLOUD_BLOCK_TOLERANT whitelist: known cloud-IP-blocked hosts
 *     (federal regulators, large publishers) that return 4xx/5xx to
 *     AWS/GCP-origin traffic but resolve fine for humans. Non-2xx
 *     responses from these hosts are logged and treated as TOLERATED
 *     instead of failing the build.
 *
 * v3 carried forward:
 *   - Timeout 30s, concurrency 4, retries 2 (gov sites are slow under
 *     automation; reduces rate-limit pressure; survives transient 5xx).
 *   - GET-first (HEAD is rejected by many gov sites even with browser UA).
 *
 * Status taxonomy:
 *   - 2xx / 3xx                       → PASS (live)
 *   - 401 / 403 / 451 / 999           → TOLERATED globally
 *   - any non-2xx from CLOUD_BLOCK    → TOLERATED (logged)
 *   - 4xx (other) / 5xx / network err → FAIL build
 *
 * Domains skipped entirely (not verified):
 *   - own subdomains, Google Fonts, w3.org, GAS endpoints, LinkedIn
 *
 * Run:  node check-links.mjs index.html
 *       node check-links.mjs index.html intake.html
 * ---------------------------------------------------------------
 *
 * On the cloud-block whitelist (read this before adding a host):
 * The hosts below have been observed to return 403/404/5xx to cloud
 * runner traffic while serving the same URL fine to a residential
 * browser. This is anti-bot policy, not link rot. We tolerate them
 * here so the build doesn't lie — a TOLERATED entry is a written
 * acknowledgement that this host is verified by quarterly editorial
 * review, not by the build pipeline.
 *
 * Add to this list ONLY when (a) a host fails repeatedly in CI AND
 * (b) the URL has been confirmed live in a residential browser. Do
 * not add hosts on faith. The whitelist weakens the doctrine; that
 * weakening is acceptable only when it's traded for a documented
 * manual review cadence.
 */

import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const SOURCE_FILES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['index.html'];

const TIMEOUT_MS = 30_000;
const CONCURRENCY = 4;
const RETRIES = 2;

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const ACCEPT_HEADERS = {
  'User-Agent': BROWSER_UA,
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,' +
    'image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
};

// Globally tolerated status codes — "site rejects automation, not 404."
const TOLERATED_STATUS = new Set([401, 403, 451, 999]);

// Hosts that block cloud-IP traffic at the network/WAF level. For these,
// any non-2xx is treated as TOLERATED. Verified manually on quarterly cadence.
const CLOUD_BLOCK_TOLERANT = [
  // Federal regulators (observed cloud-IP blocks May 2)
  'fda.gov',
  'usda.gov',
  'fcc.gov',
  'epa.gov',
  'ftc.gov',
  'healthit.gov',
  'nvlpubs.nist.gov',
  'airc.nist.gov',
  'justice.gov',
  // Large publishers / professional bodies
  'ama-assn.org',
  'usnews.com',
];

// Domains we don't verify at all.
const SKIP_PATTERNS = [
  /etherealconnectionsco\.com/,
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/,
  /www\.w3\.org/,
  /script\.google\.com/,
  /linkedin\.com/, // always 999 to bots — verification is pointless
];

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isCloudBlockTolerant(url) {
  const h = hostOf(url);
  return CLOUD_BLOCK_TOLERANT.some(
    (suffix) => h === suffix || h.endsWith('.' + suffix),
  );
}

function extractUrls(html) {
  const re = /https?:\/\/[^\s"'<>)]+/g;
  const found = new Set();
  let m;
  while ((m = re.exec(html)) !== null) {
    let url = m[0];
    // Strip trailing punctuation likely sentence-final, not URL-final.
    url = url.replace(/[,;)]+$/, '');
    if (!SKIP_PATTERNS.some((p) => p.test(url))) {
      found.add(url);
    }
  }
  return [...found].sort();
}

async function checkOne(url, attempt = 0) {
  const ctrl = new AbortController();
  const t = globalThis.setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // GET first — HEAD is rejected by many gov sites even with browser UA.
    const res = await fetch(url, {
      method: 'GET',
      headers: ACCEPT_HEADERS,
      redirect: 'follow',
      signal: ctrl.signal,
    });
    globalThis.clearTimeout(t);

    if (res.status >= 200 && res.status < 400) {
      return { url, status: res.status, kind: 'OK' };
    }
    if (TOLERATED_STATUS.has(res.status)) {
      return { url, status: res.status, kind: 'TOLERATED' };
    }
    if (isCloudBlockTolerant(url)) {
      return { url, status: res.status, kind: 'TOLERATED', reason: 'cloud-block' };
    }
    // Retry on 5xx
    if (res.status >= 500 && attempt < RETRIES) {
      await sleep(500 * (attempt + 1));
      return checkOne(url, attempt + 1);
    }
    return { url, status: res.status, kind: 'BROKEN' };
  } catch (err) {
    globalThis.clearTimeout(t);
    if (attempt < RETRIES) {
      await sleep(500 * (attempt + 1));
      return checkOne(url, attempt + 1);
    }
    if (isCloudBlockTolerant(url)) {
      return { url, status: 'NETERR', kind: 'TOLERATED', reason: 'cloud-block' };
    }
    return { url, status: 'NETERR', kind: 'BROKEN', err: String(err.message || err) };
  }
}

async function runPool(urls) {
  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < urls.length) {
      const i = cursor++;
      results[i] = await checkOne(urls[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, urls.length) }, () => worker()),
  );
  return results;
}

(async () => {
  // Aggregate URLs across all source files.
  const all = new Set();
  for (const f of SOURCE_FILES) {
    let html;
    try {
      html = readFileSync(f, 'utf8');
    } catch (e) {
      console.error(`✗ cannot read ${f}: ${e.message}`);
      process.exit(2);
    }
    for (const u of extractUrls(html)) all.add(u);
  }
  const urls = [...all].sort();

  console.log(`\n  ECCO link integrity check (v4)`);
  console.log(`  source: ${SOURCE_FILES.join(', ')}`);
  console.log(`  found ${urls.length} external URLs\n`);

  const results = await runPool(urls);
  const ok = results.filter((r) => r.kind === 'OK');
  const tolerated = results.filter((r) => r.kind === 'TOLERATED');
  const broken = results.filter((r) => r.kind === 'BROKEN');

  console.log(`  ✓ ${ok.length} OK`);
  console.log(`  ⚠ ${tolerated.length} TOLERATED`);
  console.log(`  ✗ ${broken.length} BROKEN\n`);

  if (tolerated.length) {
    console.log('  TOLERATED:');
    for (const r of tolerated) {
      const tag = r.reason ? ` (${r.reason})` : '';
      console.log(`    [${r.status}]${tag} ${r.url}`);
    }
    console.log('');
  }

  if (broken.length) {
    console.log('  BROKEN URLS:');
    for (const r of broken) {
      const detail = r.err ? ` — ${r.err}` : '';
      console.log(`    [${r.status}] ${r.url}${detail}`);
    }
    console.log('');
    process.exit(1);
  }

  console.log('  build gate: PASS\n');
  process.exit(0);
})();
