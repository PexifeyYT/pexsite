export const config = { runtime: 'edge' };

const STRIP = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'x-content-type-options',
  'strict-transport-security',
  'content-encoding',
]);

const PE = 'https://pizzaedition.win';

function rewriteText(text, ct) {
  // Rewrite absolute PE domain URLs in any text content
  text = text.replace(/https?:\/\/(?:[\w-]+\.)?pizzaedition\.win\//g, '/api/pe/');

  if (ct.includes('text/html')) {
    // Rewrite root-relative paths in HTML attributes
    text = text.replace(
      /((?:src|href|action|poster|data-src|data-href)=["'])\/(?!\/|api\/pe)/g,
      '$1/api/pe/'
    );
    // Rewrite srcset
    text = text.replace(
      /(srcset=["'][^"']*?)\s+(\/(?!\/|api\/pe))/g,
      '$1 /api/pe/'
    );
    // Inject no-referrer meta to bypass CDN hotlink protection
    text = text.replace(/(<head(?:\s[^>]*)?>)/i, '$1<meta name="referrer" content="no-referrer">');
    // Block PE's own service worker registration so it doesn't intercept our proxy
    text = text.replace(/navigator\.serviceWorker\.register\s*\([^)]+\)/g, 'Promise.resolve()');
  }

  return text;
}

export default async function handler(req) {
  const url = new URL(req.url);

  // Strip /api/pe prefix; strip .json suffix (client adds it as filter-bypass camouflage)
  const path = url.pathname
    .replace(/^\/api\/pe/, '')
    .replace(/\.json$/, '')
    || '/';

  // Forward query string but strip our cloaking suffix (single bare word like ?mountainbike)
  const qs = url.search.replace(/[?&][a-z]+$/i, '') || '';

  const target = PE + path + qs;

  let upstream;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'accept': req.headers.get('accept') || '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'referer': PE + '/',
        'origin': PE,
      },
      redirect: 'follow',
    });
  } catch (e) {
    return new Response('Gateway error', { status: 502 });
  }

  const ct = (upstream.headers.get('content-type') || '').toLowerCase();
  const isText = ct.includes('text/html') || ct.includes('javascript') || ct.includes('text/css') || ct.includes('text/plain');

  const headers = new Headers();
  for (const [k, v] of upstream.headers.entries()) {
    if (!STRIP.has(k.toLowerCase())) headers.set(k, v);
  }
  headers.set('x-frame-options', 'ALLOWALL');
  headers.set('access-control-allow-origin', '*');

  if (isText) {
    const text = await upstream.text();
    headers.delete('content-length');
    headers.delete('transfer-encoding');
    if (ct.includes('text/html')) headers.set('content-type', 'text/html; charset=utf-8');
    return new Response(rewriteText(text, ct), { status: upstream.status, headers });
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}
