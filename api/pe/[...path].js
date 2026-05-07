export const config = { runtime: 'edge' };

const STRIP = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'x-content-type-options',
  'strict-transport-security',
]);

export default async function handler(req) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/pe/, '') || '/';
  const target = 'https://pizzaedition.win' + path + url.search;

  let upstream;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'accept': req.headers.get('accept') || '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'referer': 'https://pizzaedition.win/',
        'origin': 'https://pizzaedition.win',
      },
      redirect: 'follow',
    });
  } catch (e) {
    return new Response('Gateway error', { status: 502 });
  }

  const headers = new Headers();
  for (const [k, v] of upstream.headers.entries()) {
    if (!STRIP.has(k.toLowerCase())) headers.set(k, v);
  }
  headers.set('x-frame-options', 'ALLOWALL');
  headers.set('access-control-allow-origin', '*');

  return new Response(upstream.body, { status: upstream.status, headers });
}
