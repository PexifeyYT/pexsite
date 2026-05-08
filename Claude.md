🎯 Goal
Create a high-performance HTML5 arcade website inspired by Pizza Edition (https://pizzaedition.win/).

The site must:

Feel like a modern arcade hub (fast grid browsing)

Load games instantly inside an embedded player

Work smoothly on Chromebooks / low-end devices

Support 200–1000+ HTML5 games

Use lightweight vanilla JS only

Avoid heavy frameworks or unnecessary assets

⚡ CORE SYSTEM RULES (NON-NEGOTIABLE)
❌ NO full-page redirects to external game sites

✅ ALL gameplay happens inside /open.html (was play.html)

✅ ALL games load through iframe only

❌ NO preloading full games

❌ NO heavy frameworks (React/Vue/etc.)

❌ NO multiple games running at once

✅ ONE active iframe instance only

✅ Lazy-load everything possible

🗂️ CURRENT FILE STRUCTURE
/index.html         — homepage grid (rebranded as PexSite)
/open.html          — game player page (no "game" keyword anywhere)
/data/catalog.json  — game registry (was /games/registry.json)
/_redirects         — Netlify proxy rules (CRITICAL for filter bypass)
/games/registry.json — legacy, kept for reference

🧠 GAME DATA ARCHITECTURE
All games stored in /data/catalog.json
Categories use academic labels (math, science, social, health, language, research)
No "game/games/arcade/play/unblocked" keywords anywhere in source files

Example entry (NO embed field = auto-constructs URL from char codes):
{
  "id": "slope",
  "title": "Slope",
  "category": "math",
  "tags": ["runner", "speed"]
}

Entry WITH direct embed (for IO games with own domain):
{
  "id": "shell-shockers",
  "title": "Shell Shockers",
  "category": "research",
  "embed": "https://shellshock.io"
}

🔐 URL OBFUSCATION SYSTEM (open.html)
Domain is NEVER stored as a string in any file.
Reconstructed at runtime in resolveUrl() using char code arrays:

  var d = [112,105,122,122,97,101,100,105,116,105,111,110,46,119,105,110]
            .map(function(n){return String.fromCharCode(n);}).join('');
  // assembles: pizzaedition.win

  var p = [47,112,108,97,121,47]
            .map(function(n){return String.fromCharCode(n);}).join('');
  // assembles: /play/

  return ['https://' + d + p + item.id];

srcdoc redirect technique (open.html):
iframe[src] is NEVER set to real URL.
Instead, srcdoc injects a meta-refresh tag built from String.fromCharCode(60/62).
Filters checking iframe[src] attribute see nothing.

🚨 WHY CLIENT-SIDE TRICKS ALONE FAIL
School filters (GoGuardian, Cisco Umbrella, Securly, Lightspeed) work at NETWORK layer:
- DNS filtering: blocks domain resolution before TCP connection
- SSL inspection proxy: MITM that reads all HTTPS traffic
- Browser extension (GoGuardian): monitors all navigation inside Chrome

No JavaScript obfuscation, iframe trick, srcdoc redirect, or URL encoding
can bypass a network-layer block. The domain name hits the network regardless.

✅ THE ONLY REAL FIX — NETLIFY PROXY REDIRECT
Netlify's _redirects feature proxies requests through YOUR domain.
Browser only ever connects to your Netlify domain (not blocked).
Your Netlify server fetches from pizzaedition.win server-side.

STEP 1: Create /_redirects file in project root:

  /p/*  https://pizzaedition.win/:splat  200

STEP 2: In open.html resolveUrl(), change URL construction:

  // Instead of: 'https://pizzaedition.win/play/' + item.id
  // Use local proxy path:
  return ['/p/play/' + item.id];

STEP 3: Deploy to Netlify (netlify.com, free tier works)

Result: iframe loads /p/play/slope → Netlify fetches pizzaedition.win/play/slope
        Filter sees: yoursite.netlify.app ✅ (not blocked)

IMPORTANT NOTE on Netlify proxy:
Netlify proxy only works on Netlify-hosted sites (not local file:// or other hosts).
Some game assets (JS/CSS) loaded by the game page may still reference pizzaedition.win
directly (absolute URLs in game code). Advanced fix: rewrite response headers with
Netlify Edge Functions to rewrite asset URLs too, but this is complex.

Alternative proxy hosts:
- Vercel: vercel.json rewrites → { "source": "/p/(.*)", "destination": "https://pizzaedition.win/$1" }
- Cloudflare Workers: full JS proxy, can rewrite response body/headers
- Cloudflare Pages: _redirects file same syntax as Netlify

🎨 BRANDING / KEYWORD RULES (ANTI-FILTER)
Site name: PexSite
Player page: /open.html (not play.html)
Data file: /data/catalog.json (not /games/registry.json)
No "game/games/arcade/play/unblocked/blocked" in ANY visible text or source
Element IDs: viewFrame (not gameFrame)
Categories: math, science, social, health, language, research
Search placeholder: "Search resources..."
Page title: "PexSite — Student Learning Hub"
Error messages: "Resource Unavailable", "Back to Dashboard"

🌐 HOW PIZZA EDITION ACTUALLY WORKS
pizzaedition.win IS the host — games run on their servers.
Students connect directly to their domain.
They are not embedding from another blocked site.
Their domain works because: it's either not blocked yet, or students use it outside school.
They survive blocks by: rotating domains frequently when blocked.

🚀 SMART LOADER LOGIC (open.html)
1. resolveUrl(item) → build URL array (proxy path or direct embed)
2. fetch(url, {mode:'no-cors'}) pre-check → skip instantly if DNS-blocked
3. injectSrcdoc(url) → meta-refresh inside srcdoc, never sets iframe.src
4. 8s countdown timer → auto-try next source on timeout
5. Switch Source button → manual fallback, pulses after load to signal possible blank
6. On all sources exhausted → show "Resource Unavailable" error overlay

⚡ PERFORMANCE RULES
✔ Lazy load everything — items only load on click
✔ One active iframe only — destroy previous on navigate
✔ No preload, no stacking, no background loops
✔ Chromebook safe — no WebGL preload, no physics on homepage

🧩 ADDING NEW ITEMS
Edit /data/catalog.json:
{
  "id": "new-item-id",
  "title": "Display Name",
  "category": "math",
  "tags": ["tag1", "tag2"]
}
No embed field = auto-routes through proxy or char-code URL.
Redeploy to Netlify → live instantly.

🔒 URL CLOAKING SYSTEM — /?mountainbike (ALWAYS ON)

PURPOSE
The URL suffix /?mountainbike makes the browser address bar show:
  pexsiteskibidi.vercel.app/?mountainbike
instead of just the domain root. This looks like a search/query parameter
to content filters and monitoring tools, making the site harder to identify
and block. The word "mountainbike" is arbitrary — it's configurable via Settings.

HOW IT WORKS — NEVER CHANGES ON RELOAD
The suffix is forced on every single page load using history.replaceState.
This does NOT navigate or reload the page. It silently rewrites the URL bar.

In public/index.html (runs immediately on load):
  function loadSettings(){
    document.title = localStorage.getItem('pex_title') || 'PexSite';
    var s = localStorage.getItem('pex_suffix') || 'mountainbike';
    if(location.search !== '?' + s)
      history.replaceState(null, '', '/?' + s);
  }
  loadSettings(); // called immediately, before anything else

Key rules:
- history.replaceState = changes URL bar WITHOUT navigating (no reload, no request)
- Runs on EVERY page load → suffix is always restored even if user clears it
- Default is 'mountainbike' if no localStorage entry exists
- If(location.search !== '?'+s) check prevents redundant replaceState calls

SUFFIX ADDED TO EVERY LINK THE SITE OPENS
Every URL the site opens internally must include the suffix:

1. Main page URL (always forced):
   history.replaceState(null, '', '/?' + sfx)

2. Game iframe src:
   '/api/pe/play/' + g.id + '.json?' + sfx
   e.g. /api/pe/play/slope.json?mountainbike

3. Pizza Edition embed iframe:
   '/api/pe/?' + sfx
   e.g. /api/pe/?mountainbike

4. DDG search iframe:
   '/ddg/lite/?q=' + encodeURIComponent(q) + '&kl=us-en&' + sfx
   e.g. /ddg/lite/?q=math&kl=us-en&mountainbike

5. PE internal navigation (via NAV_SHIM injected by Edge Function):
   px(url) function appends ?mountainbike to all /api/pe/ navigations
   e.g. clicking a game inside PE → /api/pe/play/slope?mountainbike

EDGE FUNCTION STRIPS SUFFIX BEFORE FORWARDING TO PE
The suffix is cloaking-only — PE must never see it.
In api/pe/[...path].js:
  const qs = url.search.replace(/[?&][a-z]+$/i, '') || '';
  // ?mountainbike → stripped → PE gets clean URL with no suffix

HOW THE SUFFIX STAYS STATIC (NEVER CHANGES ACROSS NAVIGATION)
The site is a SPA (Single Page Application). There is NO actual page navigation.
Views (#v-grid, #v-player, #v-search) are toggled with style.display.
The URL never changes because history.replaceState is used, not location.href.
On every load, loadSettings() restores the suffix immediately.
Result: the URL bar always shows /?mountainbike no matter what the user does.

CHANGING THE SUFFIX (User Settings)
Users open Settings (gear icon) and type a new suffix.
saveSettings() in index.html:
  localStorage.setItem('pex_suffix', newSuffix);
  history.replaceState(null, '', '/?' + newSuffix);
On next reload, loadSettings() reads the new value from localStorage and applies it.
If the user clears their localStorage, it falls back to 'mountainbike' automatically.

WHAT NOT TO DO WITH THE SUFFIX
- NEVER use location.href = '/?mountainbike' (causes full page reload)
- NEVER omit the suffix from iframe src URLs (defeats filter bypass)
- NEVER use window.location.replace() for the suffix (also causes reload)
- NEVER store the suffix as a hardcoded string in the Edge Function response HTML
  (must come from client-side localStorage so it's user-configurable)
- NEVER add the suffix to external embed URLs like https://shellshock.io
  (only add to internal /api/pe/ and /ddg/ paths)

CURRENT DEPLOYMENT
Project: pexsiteskibidi (Vercel)
Live URL: pexsiteskibidi-snowy.vercel.app/?mountainbike
Deploy command: vercel --prod --yes (from GameWebsite directory)
After deploy: re-alias if needed with vercel alias set <deploy-url> <alias>

🚫 WHAT NOT TO DO
Don't use iframe.src = realUrl directly (exposes URL to filter)
Don't store domain strings in any source file
Don't use React/Vue/Next.js
Don't preload embeds
Don't use "game/games/arcade/unblocked" anywhere in source
Don't expect JS tricks to bypass DNS/network-layer blocks
Don't add /:path* catch-all rewrite to vercel.json — it intercepts /api/pe/ Edge Function routes and causes 404 on all games
Don't have package.json with "scripts"."start" or "main" fields — Vercel treats it as Node.js web server and fails to find entrypoint
Do have package.json with {"private":true,"type":"module"} — required for Edge Function ESM to work without CJS compilation
