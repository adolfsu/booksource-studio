// 部署到 Cloudflare Workers 后，把得到的地址填进书源工坊：
//   网页代理：向导 → 第 1 步 → 网络设置（填 https://xxx.workers.dev/?url=）
//   AI 代理：AI制作 → API 设置 → API 请求代理（同一个地址即可，已支持 POST 转发）
//
// 用法：https://你的域名.workers.dev/?url=<经过 URL 编码的目标地址>
// 也可以用 {url} 占位符：https://你的域名.workers.dev/p/{url}
//
// GET  → 抓网页（带浏览器 UA，自动跟随跳转）
// POST → 原样转发请求体和 Authorization 头（用于 OpenAI 兼容接口）

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
      if (request.method === 'POST') {
        // 原样转发（API 转发）：保留 Content-Type / Authorization，透传请求体
        const headers = {};
        for (const k of ['content-type', 'authorization', 'accept', 'user-agent']) {
          const v = request.headers.get(k);
          if (v) headers[k] = v;
        }
        if (!headers['user-agent']) headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
        const upstream = await fetch(target, {
          method: 'POST',
          headers,
          body: await request.arrayBuffer(),
          redirect: 'follow',
        });
        const buf = await upstream.arrayBuffer();
        const out = { ...CORS };
        const ct = upstream.headers.get('Content-Type');
        out['Content-Type'] = ct || 'application/json; charset=utf-8';
        return new Response(buf, { status: upstream.status, headers: out });
      }

      // GET：抓网页
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
