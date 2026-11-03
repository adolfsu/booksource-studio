// 部署到 Cloudflare Workers 后，把得到的地址（如 https://xxx.workers.dev/?url=）
// 填进书源工坊「向导 → 第 1 步 → 网络设置」里即可。
//
// 用法：https://你的域名.workers.dev/?url=<经过 URL 编码的目标地址>
// 也可以用 {url} 占位符：https://你的域名.workers.dev/p/{url}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const u = new URL(request.url);
    let target = u.searchParams.get('url');
    if (!target) {
      const m = u.pathname.match(/\/p\/(.+)/);
      if (m) target = decodeURIComponent(m[1]);
    }
    if (!target || !/^https?:\/\//i.test(target)) {
      return new Response('Usage: ?url=https://example.com', {
        status: 400, headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    try {
      const upstream = await fetch(target, {
        redirect: 'follow',
        headers: {
          'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9',
        },
      });
      const buf = await upstream.arrayBuffer();
      const headers = { ...CORS };
      const ct = upstream.headers.get('Content-Type');
      headers['Content-Type'] = ct || 'text/html; charset=utf-8';
      return new Response(buf, { status: upstream.status, headers });
    } catch (e) {
      return new Response('Upstream error: ' + e.message, {
        status: 502, headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  },
};
