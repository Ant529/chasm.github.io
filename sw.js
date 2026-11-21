/* sw.js —— 深渊之底的离线兜底（PWA_v1）
   策略：
     · 页面导航：network-first（联网永远最新，避免「更新了还是旧版」的坑），断网回缓存
     · 其它 GET：cache-first（封面、图标这类不会变的）
   注意：只有 https 或 localhost 才会注册成功；file:// 双击打开时 SW 不生效，
        但游戏本身是单文件自包含的，不需要 SW 也能玩。 */
var V = 'abyss-v1';
var PRE = ['./', './index.html', './game.html', './cover.png',
           './manifest.json', './assets/img/goba-dark.png', './assets/img/icon-192.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(V).then(function (c) {
    return Promise.all(PRE.map(function (u) {
      return c.add(new Request(u, { cache: 'reload' })).catch(function () { });
    }));
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V; })
                        .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then(function (res) {
      var cp = res.clone();
      caches.open(V).then(function (c) { c.put(r, cp); });
      return res;
    }).catch(function () {
      return caches.match(r).then(function (m) { return m || caches.match('./index.html'); });
    }));
    return;
  }
  e.respondWith(caches.match(r).then(function (m) { return m || fetch(r); }));
});
