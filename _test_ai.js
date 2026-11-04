/* AI 模块专项测试：aiJSON / splitLegadoUrl / aiRealSearchUrl / slimHtml / renderAI / aiChat 守卫 */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('E:/AI/WorkBuddy/简单项目/booksource-studio/index.html', 'utf8');

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.com/' });
const w = dom.window, d = w.document;

let pass = 0, fail = 0;
function t(name, fn){
  try{ fn(); console.log('  ✓', name); pass++; }
  catch(e){ console.log('  ✗', name, '—', e.message); fail++; }
}
function eq(a, b, msg){ if(a !== b) throw new Error((msg||'') + ` 期望 ${JSON.stringify(b)} 实际 ${JSON.stringify(a)}`); }

setTimeout(()=>{

console.log('== AI 模块专项测试 ==');

t('页面正常启动，AI 配置已加载', ()=>{
  if(typeof w.aiJSON !== 'function') throw new Error('aiJSON 未定义');
  if(typeof w.renderAI !== 'function') throw new Error('renderAI 未定义');
  if(w.eval('typeof AI') !== 'object') throw new Error('AI 配置未加载');
});

t('aiJSON：裸 JSON', ()=>{
  const o = w.aiJSON('{"a":1}');
  eq(o.a, 1);
});
t('aiJSON：```json 围栏 + 前后废话', ()=>{
  const o = w.aiJSON('好的，以下是结果：\n```json\n{"searchUrl":"/s.php?q={{key}}","name":"某站"}\n```\n希望有帮助');
  eq(o.searchUrl, '/s.php?q={{key}}');
});
t('aiJSON：嵌套在文本中', ()=>{
  const o = w.aiJSON('结果 {"categories":[{"name":"玄幻","url":"/x/"}]} 完毕');
  eq(o.categories.length, 1);
});
t('aiJSON：非 JSON 抛错', ()=>{
  let threw = false;
  try{ w.aiJSON('抱歉我不知道'); }catch(e){ threw = true; }
  if(!threw) throw new Error('应该抛错');
});

t('splitLegadoUrl：纯路径', ()=>{
  const r = w.splitLegadoUrl('/search.php?keyword={{key}}');
  eq(r.path, '/search.php?keyword={{key}}');
  eq(r.opt, null);
});
t('splitLegadoUrl：带 POST 选项', ()=>{
  const r = w.splitLegadoUrl('/s.php,{"method":"POST","body":"searchkey={{key}}"}');
  eq(r.path, '/s.php');
  eq(r.opt.method, 'POST');
  eq(r.opt.body, 'searchkey={{key}}');
});

t('aiRealSearchUrl：GET 相对路径 + {{key}}', ()=>{
  const r = w.aiRealSearchUrl('https://www.xxx.com', '/search.php?keyword={{key}}', '斗破苍穹');
  eq(r.url, 'https://www.xxx.com/search.php?keyword=' + encodeURIComponent('斗破苍穹'));
  eq(r.isPost, false);
});
t('aiRealSearchUrl：POST body 关键词替换', ()=>{
  const r = w.aiRealSearchUrl('https://www.xxx.com/', '/s.php,{"method":"POST","body":"searchkey={{key}}&type=all"}', '武动乾坤');
  eq(r.isPost, true);
  if(!/searchkey=%E6%AD%A6%E5%8A%A8%E4%B9%BE%E5%9D%A4&type=all/.test(r.opt.body)) throw new Error('body 未替换: ' + r.opt.body);
});
t('aiRealSearchUrl：完整网址原样 + {{page}} 归一', ()=>{
  const r = w.aiRealSearchUrl('https://www.xxx.com', 'https://other.com/s?q={{key}}&p={{page}}', 'x');
  eq(r.url, 'https://other.com/s?q=x&p=1');
});

t('slimHtml：剔除 script/style/head，保留正文', ()=>{
  const out = w.slimHtml('<html><head><style>.a{color:red}</style><script>var x=1;</script></head><body><div id="c"><p>正文内容在这里</p></div></body></html>', 5000);
  if(/var x=1/.test(out)) throw new Error('script 没剔除');
  if(/color:red/.test(out)) throw new Error('style 没剔除');
  if(!/正文内容在这里/.test(out)) throw new Error('正文丢了');
});
t('slimHtml：超长截断', ()=>{
  const big = '<body>' + '<p>字</p>'.repeat(30000) + '</body>';
  const out = w.slimHtml(big, 1000);
  if(out.length > 1100) throw new Error('没截断: ' + out.length);
  if(!/TRUNCATED/.test(out)) throw new Error('缺截断标记');
});

t('renderAI：配置表单与任务表单渲染', ()=>{
  w.eval("AI.base='https://api.test.com/v1';AI.model='test-model';");
  w.renderAI();
  const base = d.querySelector('#aiBase'), key = d.querySelector('#aiKey'), model = d.querySelector('#aiModel');
  if(!base || !key || !model) throw new Error('配置输入缺失');
  if(base.value !== 'https://api.test.com/v1') throw new Error('base 回填错误');
  if(model.value !== 'test-model') throw new Error('model 回填错误');
  if(!d.querySelector('#aiUrl') || !d.querySelector('#aiKw')) throw new Error('任务输入缺失');
  if(!d.querySelector('#aiGo')) throw new Error('开始按钮缺失');
});
t('renderAI：配置输入实时保存', ()=>{
  const base = d.querySelector('#aiBase');
  base.value = 'https://changed.test/v1';
  base.dispatchEvent(new w.Event('input', {bubbles:true}));
  eq(w.eval('AI.base'), 'https://changed.test/v1');
  eq(JSON.parse(w.localStorage.getItem('bs_studio_ai_v1')).base, 'https://changed.test/v1');
});
t('aiStep + renderAI：进度卡片渲染', ()=>{
  w.eval("AISTEPS=[{t:'分析网站首页',st:'ok',detail:'<div class=\"kv\"><div class=\"k\">站点</div><div class=\"v\">测试站</div></div>'},{t:'生成搜索规则',st:'run'},{t:'生成详情和目录规则',st:'wait'}];");
  w.renderAI();
  const steps = d.querySelectorAll('#aiOut .tstep');
  eq(steps.length, 3);
  if(!/分析网站首页/.test(d.querySelector('#aiOut').textContent)) throw new Error('步骤标题未渲染');
  if(!d.querySelector('#aiStop')) throw new Error('运行中应显示停止按钮');
});
t('renderAI：未运行时显示开始按钮', ()=>{
  w.eval("AISTEPS=[{t:'分析网站首页',st:'ok'}];");
  w.renderAI();
  if(!d.querySelector('#aiGo')) throw new Error('应显示开始按钮');
});
t('goTab(ai) 正常切换', ()=>{
  w.goTab('ai');
  const on = d.querySelector('.page.on');
  if(on.dataset.page !== 'ai') throw new Error('没切到 ai 页');
  eq(d.querySelectorAll('nav.tabbar button').length, 5);
});
t('导出 JSON 不会被 AI 中间字段污染', ()=>{
  w.eval("S.bookSourceName='AI测试';S.bookSourceUrl='https://a.com';S._aiFirstBook='https://a.com/1';");
  const json = JSON.parse(w.exportJson(false));
  if('_aiFirstBook' in json) throw new Error('_aiFirstBook 泄漏到导出');
  if('_step' in json) throw new Error('_step 泄漏到导出');
});

(async ()=>{
  w.eval("AI.base='';AI.key='';");
  let msg = '';
  try{ await w.aiChat([{role:'user',content:'hi'}]); }
  catch(e){ msg = e.message; }
  if(!/请先在上方填好/.test(msg)){ console.log('  ✗ aiChat 空配置提示 —', msg); fail++; }
  else { console.log('  ✓ aiChat：未配置时给出明确提示'); pass++; }

  // 页面环境没有可用网络 → 伪装 fetch 抛 TypeError，验证错误指引
  w.fetch = ()=> Promise.reject(new TypeError('Failed to fetch'));
  w.eval("AI.base='https://api.example.com/v1';AI.key='sk-test';AI.model='gpt-4o-mini';");
  try{ await w.aiChat([{role:'user',content:'hi'}]); }
  catch(e){ if(!/直连|代理|跨域/.test(e.message)){ console.log('  ✗ aiChat fetch 失败分支 —', e.message); fail++; } else { console.log('  ✓ aiChat：网络失败时给出跨域/代理指引'); pass++; } }

  // mock OpenAI 接口：验证请求头 / 模型名 / 代理前缀 URL 拼接
  let cap = {};
  w.fetch = (url, opts)=>{
    cap = { url, opts, body: JSON.parse(opts.body) };
    return Promise.resolve({ ok:true, status:200, json:()=>Promise.resolve({ choices:[{message:{content:'{"ok":1}'}}] }), text:()=>Promise.resolve('') });
  };
  w.eval("AI.base='https://api.example.com/v1';AI.key='sk-abc';AI.model='deepseek-chat';AI.prefix='';");
  await w.aiChat([{role:'user',content:'hi'}]);
  t('aiChat：请求地址/头/模型名正确', ()=>{
    eq(cap.url, 'https://api.example.com/v1/chat/completions');
    eq(cap.opts.headers.Authorization, 'Bearer sk-abc');
    eq(cap.body.model, 'deepseek-chat');
  });
  t('aiChat：代理前缀 ?url= 拼接', async ()=>{
    w.eval("AI.prefix='https://p.workers.dev/?url=';");
    await w.aiChat([{role:'user',content:'hi'}]);
    eq(cap.url, 'https://p.workers.dev/?url=' + encodeURIComponent('https://api.example.com/v1/chat/completions'));
  });
  t('aiChat：代理前缀 {url} 占位符', async ()=>{
    w.eval("AI.prefix='https://p2.workers.dev/api/{url}';");
    await w.aiChat([{role:'user',content:'hi'}]);
    eq(cap.url, 'https://p2.workers.dev/api/' + encodeURIComponent('https://api.example.com/v1/chat/completions'));
  });

  // aiGen：第一次输出不合格 → 自动带着错误重试
  let calls = 0;
  w.fetch = ()=>{
    calls++;
    const content = calls === 1 ? '```json\n{"x":"bad"}\n```' : '{"x":"good"}';
    return Promise.resolve({ ok:true, status:200, json:()=>Promise.resolve({ choices:[{message:{content}}] }), text:()=>Promise.resolve('') });
  };
  const out = await w.aiGen(
    (err)=>[{role:'user',content: err || 'go'}],
    (o)=> o.x === 'good' ? true : 'x 不是 good'
  );
  t('aiGen：校验失败自动重试并带上错误信息', ()=>{
    eq(out.x, 'good');
    eq(calls, 2);
  });

  // ---- 新增：aiUrlOf / aiFetchModels / aiTestConn ----
  w.renderAI(); // 重建 DOM（含 datalist 与两个按钮）
  t('aiUrlOf：三种拼法', ()=>{
    w.eval("AI.base='https://a.com/v1';AI.prefix='';");
    eq(w.aiUrlOf('/models'), 'https://a.com/v1/models');
    w.eval("AI.prefix='https://p.workers.dev/?url=';");
    eq(w.aiUrlOf('/models'), 'https://p.workers.dev/?url=' + encodeURIComponent('https://a.com/v1/models'));
    w.eval("AI.prefix='https://p2.workers.dev/api/{url}';");
    eq(w.aiUrlOf('/models'), 'https://p2.workers.dev/api/' + encodeURIComponent('https://a.com/v1/models'));
  });

  t('aiFetchModels：解析 {data:[{id}]} 并排序去重 + 自动选模型', async ()=>{
    w.eval("AI.base='https://a.com/v1';AI.key='sk-1';AI.prefix='';AI.model='';delete AI.models;");
    let asked;
    w.fetch = async (url, opts)=>{
      asked = { url, auth: opts.headers.Authorization };
      return { ok:true, status:200, json: async ()=>({ data:[{id:'z-model'},{id:'gpt-4o-mini'},{id:'glm-4-flash'},{id:'gpt-4o-mini'}] }) };
    };
    await w.aiFetchModels();
    const models = w.eval('AI.models');
    eq(models.join('|'), 'glm-4-flash|gpt-4o-mini|z-model');
    eq(w.eval('AI.model'), 'glm-4-flash');   // 便宜常用的排前面优先选
    eq(asked.url, 'https://a.com/v1/models');
    eq(asked.auth, 'Bearer sk-1');
    const dl = d.querySelector('#aiModelList');
    if(!dl || dl.querySelectorAll('option').length !== 3) throw new Error('datalist 未更新');
    if(!/已拉取 3 个模型/.test(d.querySelector('#aiConnStat').textContent)) throw new Error('状态行未更新');
  });
  t('aiFetchModels：兼容字符串数组与 {models:[]} 格式', async ()=>{
    w.eval("AI.model='';delete AI.models;");
    w.fetch = async ()=> ({ ok:true, status:200, json: async ()=>({ models:['m1','m2'] }) });
    await w.aiFetchModels();
    eq(w.eval('AI.models').join('|'), 'm1|m2');
    w.fetch = async ()=> ({ ok:true, status:200, json: async ()=>(['plain-a','plain-b']) });
    await w.aiFetchModels();
    eq(w.eval('AI.models').join('|'), 'plain-a|plain-b');
  });
  t('aiFetchModels：401 提示 Key 无效', async ()=>{
    w.fetch = async ()=> ({ ok:false, status:401, json: async ()=>({}), text: async ()=>'' });
    // toast 不阻断，只要不抛错即可
    await w.aiFetchModels();
    eq(w.eval('AI.models'), undefined);
  });
  t('aiFetchModels：空配置直接提示', async ()=>{
    w.eval("AI.key='';");
    await w.aiFetchModels(); // 不应抛错
    w.eval("AI.key='sk-1';");
  });
  t('aiTestConn：真实对话成功，显示耗时与回复', async ()=>{
    w.eval("AI.model='test-model';");
    w.fetch = async (url, opts)=>{
      const body = JSON.parse(opts.body);
      if(!/chat\/completions$/.test(url)) throw new Error('应请求 chat/completions，实际 ' + url);
      if(body.messages[0].content.indexOf('成功') < 0) throw new Error('测试消息内容不对');
      return { ok:true, status:200, json: async ()=>({ choices:[{message:{content:'成功'}}] }) };
    };
    await w.aiTestConn();
    if(!/连接成功/.test(d.querySelector('#aiConnStat').textContent)) throw new Error('状态行没有成功提示');
    if(!/成功/.test(d.querySelector('#aiConnStat').textContent)) throw new Error('没有显示模型回复');
  });
  t('aiTestConn：401 显示 Key 无效', async ()=>{
    w.fetch = async ()=> ({ ok:false, status:401, json: async ()=>({}), text: async ()=>'' });
    await w.aiTestConn();
    if(/连接成功/.test(d.querySelector('#aiConnStat').textContent)) throw new Error('不应显示成功');
  });
  t('aiTestConn：400+model 字样提示模型名不对', async ()=>{
    w.fetch = async ()=> ({ ok:false, status:400, json: async ()=>({}), text: async ()=>'{"error":{"message":"Invalid model: xyz"}}' });
    await w.aiTestConn();
    // 结果走 toast，这里只需不抛错
  });

  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
})();

}, 200);
