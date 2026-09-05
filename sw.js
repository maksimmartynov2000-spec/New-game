// Service worker: без него приложение только выглядело как PWA — иконка на экране «Домой»
// была, а офлайн-работы не было, и Safari мог в любой момент выбросить кеш, после чего
// игра просто не открывалась. Для инструмента, который берут с собой на занятие, это плохо.
//
// Стратегия намеренно простая и разная для двух видов файлов:
//   — оболочка (index.html, библиотека, иконки, манифест) — сначала сеть, потом кеш.
//     Так обновление приложения доезжает сразу, а если сети нет, открывается сохранённое.
//   — картинки — сначала кеш. Они неизменяемые: файл IMG_2427.png всегда один и тот же,
//     перекачивать его незачем.
//
// Запросы к Supabase через service worker не проходят вообще (см. fetch ниже): кешировать
// синхронизацию прогресса нельзя ни в каком виде — отдать старый ответ здесь означало бы
// показать ученику вчерашние цифры и, хуже того, слить их обратно на сервер.

const VERSION = 'kluch-v4';
const SHELL_CACHE = `${VERSION}-shell`;
const IMAGE_CACHE = `${VERSION}-img`;

// Все подключённые скрипты обязаны быть в этом списке. index.html постепенно
// разрезается на файлы, и каждый вынесенный кусок — это ещё один запрос, без которого
// приложение либо теряет часть, либо не запускается вовсе. Проверка в тестах сверяет
// этот список с тегами <script src> в index.html, чтобы следующий вынос не забыли.
const SHELL_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './vendor/supabase.js',
    './js/i18n.js',
    './js/topics.js',
    './js/generator.js',
    './js/mistakes.js',
    './js/charts.js',
    './js/progress.js',
    './content/paradoxes.js',
    './content/hints.js',
    './content/challenges.js',
    './content/i18n.js',
    './content/maintenance.js',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE)
            // addAll падает целиком, если хоть один файл не скачался, — поэтому кладём
            // по одному и не срываем установку из-за отсутствующей иконки.
            .then(cache => Promise.all(SHELL_ASSETS.map(url =>
                cache.add(url).catch(() => null)
            )))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Чужие домены (в первую очередь Supabase) не трогаем совсем — пусть идут напрямую.
    if (url.origin !== self.location.origin) return;

    // Картинки: сначала кеш. Файлы неизменяемые, гонять их по сети повторно незачем.
    if (/\.(png|webp|jpg|jpeg|svg|ico)$/i.test(url.pathname)) {
        event.respondWith(
            caches.match(req).then(hit => hit || fetch(req).then(res => {
                if (res && res.ok) {
                    const copy = res.clone();
                    caches.open(IMAGE_CACHE).then(c => c.put(req, copy));
                }
                return res;
            }).catch(() => hit))
        );
        return;
    }

    // Оболочка: сначала сеть, чтобы обновления приезжали без плясок с очисткой кеша;
    // при отсутствии сети отдаём сохранённое.
    event.respondWith(
        fetch(req).then(res => {
            if (res && res.ok) {
                const copy = res.clone();
                caches.open(SHELL_CACHE).then(c => c.put(req, copy));
            }
            return res;
        }).catch(() => caches.match(req).then(hit => {
            if (hit) return hit;
            // Запасной index.html годится только для перехода на страницу. Раньше он
            // отдавался в ответ на ЛЮБОЙ несохранённый запрос — в том числе на <script>,
            // и тогда браузер получал HTML вместо кода и пытался его исполнить. Теперь
            // такой запрос честно падает: не загрузившийся скрипт виден сразу, а игра
            // с молча пропавшим модулем — нет.
            if (req.mode === 'navigate') return caches.match('./index.html');
            return new Response('', { status: 504, statusText: 'offline' });
        }))
    );
});
