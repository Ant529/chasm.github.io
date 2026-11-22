/* sw.js —— 深渊之底的离线兜底（PWA_v2）
   策略：
     · 页面导航：network-first + `cache: 'no-cache'`（回源带 ETag 校验，
       没变就是 304、变了立刻拿到新的），断网/超时才回缓存
     · 其它静态资源：stale-while-revalidate（先用缓存秒开，后台拉新的覆盖回去）
   缓存名带构建戳 `1122-1855-f32157` —— 每次构建都是新名字，activate 一定清掉上一版。
   注意：只有 https 或 localhost 才会注册成功；file:// 双击打开时 SW 不生效，
        但游戏本身是单文件自包含的，不需要 SW 也能玩。 */
var V = 'abyss-1122-1855-f32157';
var PRE = ['./', './index.html', './game.html', './game-pc.html', './cover.png',
           './manifest.json', './assets/img/goba-dark.png',
           './assets/img/icon-180.png', './assets/img/icon-192.png',
           './assets/img/icon-512.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(V).then(function (c) {
    return Promise.all(PRE.map(function (u) {
      return c.add(new Request(u, { cache: 'reload' })).catch(function () { });
    }));
  }));
});

self.addEventListener('activate', function (e) {
  var hadOld = false;      /* 有没有上一版的缓存 = 这次是「升级」还是「首次安装」 */
  e.waitUntil(caches.keys().then(function (ks) {
    /* 只清自己的：ant529.github.io 是整个域共享 origin，别把别的项目缓存端了 */
    var olds = ks.filter(function (k) { return k.indexOf('abyss-') === 0 && k !== V; });
    hadOld = olds.length > 0;
    return Promise.all(olds.map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); })
    .then(function () { return self.clients.matchAll({ type: 'window' }); })
    .then(function (cs) {
      /* ★ 只有「升级」才把窗口重进一次 —— 这一屏是「旧 SW + HTTP 缓存」发出去的旧 HTML
         （GitHub Pages 给 HTML 打 max-age=600，旧 SW 直接 fetch() 就吃到了 10 分钟内的
         旧副本），新 SW 接管了也换不掉已经交付的页面。重进之后下一次请求才走下面
         fetch 的 no-cache 分支。
         首次安装不重进（没有旧缓存），新访客不会白刷一遍。
         activate 每个版本只跑一次，所以只重进一次，不会循环。 */
      if (!hadOld) return;
      (cs || []).forEach(function (c) {
        if (c.frameType && c.frameType !== 'top-level') return;
        try { var pr = c.navigate(c.url); if (pr && pr.catch) pr.catch(function () { }); }
        catch (err) { }
      });
    }));
});

self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;

  if (r.mode === 'navigate') {
    e.respondWith(fetch(r.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then(function (res) {
        if (res && res.ok) {
          var cp = res.clone();
          caches.open(V).then(function (c) { return c.put(r.url, cp); }).catch(function () { });
        }
        return res;
      })
      .catch(function () {
        return caches.match(r.url, { ignoreSearch: true }).then(function (m) {
          return m || caches.match('./index.html');
        });
      }));
    return;
  }

  e.respondWith(caches.match(r).then(function (m) {
    var net = fetch(r).then(function (res) {
      if (res && res.ok) {
        var cp = res.clone();
        caches.open(V).then(function (c) { return c.put(r, cp); }).catch(function () { });
      }
      return res;
    }).catch(function () { return m; });
    return m || net;
  }));
});
