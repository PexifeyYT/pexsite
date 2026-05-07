export const config = { runtime: 'edge' };

const STRIP = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'x-content-type-options',
  'strict-transport-security',
]);

const PE = 'https://pizzaedition.win';

function rewriteHtml(html) {
  // Rewrite absolute pizzaedition.win URLs to /api/pe/
  html = html.replace(/https?:\/\/(?:[\w-]+\.)?pizzaedition\.win\//g, '/api/pe/');

  // Rewrite root-relative paths in HTML attributes to /api/pe/
  html = html.replace(
    /((?:src|href|action|poster|data-src|data-href)=["'])\/(?!\/|api\/pe)/g,
    '$1/api/pe/'
  );

  // Rewrite root-relative paths inside srcset
  html = html.replace(
    /(srcset=["'][^"']*?)\s+(\/(?!\/|api\/pe))/g,
    '$1 /api/pe/'
  );

  // Inject no-referrer (bypasses CDN hotlink protection for any remaining direct loads)
  html = html.replace(/(<head(?:\s[^>]*)?>)/i, '$1<meta name="referrer" content="no-referrer">');

  return html;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/pe/, '') || '/';
  const target = PE + path + url.search;

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

  const contentType = (upstream.headers.get('content-type') || '').toLowerCase();

  const headers = new Headers();
  for (const [k, v] of upstream.headers.entries()) {
    if (!STRIP.has(k.toLowerCase())) headers.set(k, v);
  }
  headers.set('x-frame-options', 'ALLOWALL');
  headers.set('access-control-allow-origin', '*');

  if (contentType.includes('text/html')) {
    const text = await upstream.text();
    headers.set('content-type', 'text/html; charset=utf-8');
    headers.delete('content-length');
    headers.delete('transfer-encoding');
    return new Response(rewriteHtml(text), { status: upstream.status, headers });
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}
