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
const SFX = 'mountainbike';

// Injected first-thing into every PE HTML page:
// - Spoofs hostname/origin so PE domain-checks pass
// - Spoofs window.top/parent so PE iframe-detection fails
// - Intercepts link clicks before React/Next.js router, forces full reload through /api/pe/
// - Adds ?mountainbike suffix to all proxied navigations
const NAV_SHIM = `<script>(function(){
try{Object.defineProperty(location,'hostname',{get:function(){return 'pizzaedition.win';}});}catch(e){}
try{Object.defineProperty(location,'host',{get:function(){return 'pizzaedition.win';}});}catch(e){}
try{Object.defineProperty(location,'origin',{get:function(){return 'https://pizzaedition.win';}});}catch(e){}
try{Object.defineProperty(window,'top',{get:function(){return window;}});}catch(e){}
try{Object.defineProperty(window,'parent',{get:function(){return window;}});}catch(e){}
try{Object.defineProperty(window,'frameElement',{get:function(){return null;}});}catch(e){}
function isPE(s){return s.indexOf('pizzaedition.win')>0&&s.indexOf('http')===0;}
function px(u){
  var s=String(u||'');
  if(!s||s[0]==='#'||s.indexOf('/api/pe')===0)return s;
  if(s.indexOf('mailto:')===0||s.indexOf('tel:')===0||s.indexOf('javascript:')===0||s.indexOf('data:')===0||s.indexOf('blob:')===0)return s;
  var path='';
  if(isPE(s)){var i=s.indexOf('://')+3;path=s.substring(s.indexOf('/',i));}
  else if(s[0]==='/')path=s;
  else return s;
  return '/api/pe'+path+(path.indexOf('?')>=0?'&':'?')+'${SFX}';
}
document.addEventListener('click',function(e){
  var a=e.target.closest('a[href]');if(!a)return;
  var h=a.getAttribute('href')||'';
  if(!h||h[0]==='#'||h.indexOf('/api/pe')===0)return;
  if(h.indexOf('mailto:')===0||h.indexOf('tel:')===0||h.indexOf('javascript:')===0)return;
  if(h.indexOf('http')===0&&!isPE(h))return;
  e.preventDefault();e.stopPropagation();location.href=px(h);
},true);
navigator.serviceWorker&&navigator.serviceWorker.getRegistrations&&
  navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister();});});
}());</script>`;

function rewriteCss(css) {
  css = css.replace(/https?:\/\/(?:[\w-]+\.)?pizzaedition\.win\//g, '/api/pe/');
  css = css.replace(/url\s*\(\s*(['"]?)\/(?!\/|api\/pe)/g, 'url($1/api/pe/');
  return css;
}

function rewriteHtml(html) {
  // Absolute PE domain URLs everywhere
  html = html.replace(/https?:\/\/(?:[\w-]+\.)?pizzaedition\.win\//g, '/api/pe/');

  // Root-relative paths in HTML attributes
  html = html.replace(
    /((?:src|href|action|poster|data-src|data-href|data-url|data-img)=["'])\/(?!\/|api\/pe)/g,
    '$1/api/pe/'
  );

  // srcset
  html = html.replace(
    /(srcset=["'][^"']*?)\s+(\/(?!\/|api\/pe))/g,
    '$1 /api/pe/'
  );

  // url() in inline styles and <style> blocks
  html = html.replace(/url\s*\(\s*(['"]?)\/(?!\/|api\/pe)/g, 'url($1/api/pe/');

  // <style> blocks – also handle absolute PE URLs in CSS
  html = html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, o, css, c) =>
    o + rewriteCss(css) + c
  );

  // Kill service worker registrations (SW would intercept our proxy requests)
  html = html.replace(/navigator\.serviceWorker\.register\s*\([^)]+\)/g, 'Promise.resolve()');

  // Inject shim immediately after <head> — runs before any PE script
  html = html.replace(
    /(<head(?:\s[^>]*)?>)/i,
    '$1' + NAV_SHIM + '<meta name="referrer" content="no-referrer">'
  );

  return html;
}

export default async function handler(req) {
  const url = new URL(req.url);

  // Strip /api/pe prefix + .json camouflage suffix added by client
  const path = url.pathname
    .replace(/^\/api\/pe/, '')
    .replace(/\.json$/, '')
    || '/';

  // Strip our bare-word cloaking suffix from query string before forwarding
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
  const isHtml = ct.includes('text/html');
  const isJs   = ct.includes('javascript');
  const isCss  = ct.includes('text/css');
  const isText = isHtml || isJs || isCss || ct.includes('text/plain');

  const headers = new Headers();
  for (const [k, v] of upstream.headers.entries()) {
    if (!STRIP.has(k.toLowerCase())) headers.set(k, v);
  }
  headers.set('x-frame-options', 'ALLOWALL');
  headers.set('access-control-allow-origin', '*');
  // Permissive CSP so PE's own scripts/styles/images all load
  headers.set('content-security-policy',
    "frame-ancestors *; default-src * data: blob: 'unsafe-inline' 'unsafe-eval';");

  if (isText) {
    const text = await upstream.text();
    headers.delete('content-length');
    headers.delete('transfer-encoding');
    if (isHtml) headers.set('content-type', 'text/html; charset=utf-8');

    let out = text;
    if (isHtml) out = rewriteHtml(text);
    else if (isCss) out = rewriteCss(text);
    else if (isJs)  out = text.replace(/https?:\/\/(?:[\w-]+\.)?pizzaedition\.win\//g, '/api/pe/');

    return new Response(out, { status: upstream.status, headers });
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}
