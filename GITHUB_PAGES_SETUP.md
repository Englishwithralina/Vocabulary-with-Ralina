# GitHub Pages: English with Ralina

Адрес сайта: **https://englishwithralina.github.io/Vocabulary-with-Ralina/**

## Почему была белая страница

Pages публиковал исходники из `main / (root)`. Проверка публичной страницы показала HTTP 200 для HTML, но он ссылался на `/src/main.js`, который возвращал HTTP 404. Vite-приложение необходимо сначала собрать, затем опубликовать только `dist`.

## Что настроено

- `.github/workflows/deploy-pages.yml`: при push в `main` или ручном запуске устанавливает зависимости через `npm ci`, запускает модульные тесты, собирает приложение, проверяет сборку в браузере и публикует только `dist`.
- `npm run build:pages` использует режим `github-pages` и `base: '/Vocabulary-with-Ralina/'`. Локальный `npm run dev` и обычный `npm run build` сохраняют прежний путь; вариант для Firebase Hosting не изменён.
- Версии официальных GitHub Actions закреплены полными SHA. Публикация имеет только необходимые `pages: write` и `id-token: write`; задача сборки — `contents: read`.
- Четыре Firebase Web значения поступают из Repository Secrets на этапе сборки. При отсутствии хотя бы одного сборка останавливается до публикации. Значения не печатаются в журнал.
- `.env*` исключены из Git, кроме пустого шаблона `.env.example`. Не добавляйте `.env.local` через `git add -f`.

## Что нажать в GitHub

1. Откройте репозиторий → **Settings → Pages → Build and deployment → Source → GitHub Actions**. Это заменяет прежний режим `Deploy from a branch / main / (root)`. Создавать дополнительный шаблон workflow не нужно: файл уже подготовлен в проекте.
2. Откройте **Settings → Secrets and variables → Actions → Secrets → New repository secret**. Создайте четыре записи:

   | Name | Secret |
   | --- | --- |
   | `VITE_FIREBASE_API_KEY` | Значение одноимённой строки из локального `.env.local` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | Значение одноимённой строки из локального `.env.local` |
   | `VITE_FIREBASE_PROJECT_ID` | Значение одноимённой строки из локального `.env.local` |
   | `VITE_FIREBASE_APP_ID` | Значение одноимённой строки из локального `.env.local` |

   Копируйте только значение после `=`, без кавычек, пробелов по краям и самого имени. Не вставляйте весь файл, JSON service account, пароль преподавателя или admin key. Используйте именно **repository secrets**, доступные задаче сборки, а не только секреты environment `github-pages`.
3. В VS Code сохраните подготовленные изменения в Git: **Source Control → Stage Changes → Commit → Push / Sync Changes** в ветку `main`. Проверьте список: `.env.local` и `dist` в нём быть не должно. Этот шаг отправит workflow в GitHub и запустит деплой.
4. В репозитории откройте **Actions → Deploy Vite to GitHub Pages**. Дождитесь зелёных задач **build** и **deploy**. Если файл уже отправлен, а секреты добавлены позже: **Run workflow → main → Run workflow**, либо **Re-run all jobs** у неудачного запуска.
5. Откройте адрес сайта выше и обновите через **Ctrl+F5**. Войдите в Teacher Studio; откройте существующую практику → **Share → Copy link**. Проверьте ссылку в приватном окне браузера.

Настройки Pages/Secrets и публикация не выполняются локальными правками: эти действия нужны в вашем GitHub. Для деплоя используется временный `GITHUB_TOKEN`, отдельный персональный токен не нужен. Если GitHub просит разрешить deployment environment, проверьте **Settings → Environments → github-pages**: ветка `main` должна быть разрешена.

## Firebase и безопасность

Сохранены существующие `src/firebase.js`, Auth, Firestore, UID владельца, коллекции, правила и формат данных. Workflow не развёртывает правила Firebase и не изменяет данные. GitHub Pages размещает только интерфейс; Firebase продолжает обслуживать вход и базу.

Firebase Web config — публичные идентификаторы клиентского приложения. Они неизбежно входят в браузерную сборку, даже если передаются через GitHub Secrets. Secrets предотвращают их случайное размещение в исходных файлах и журналах; они не превращают браузерную конфигурацию в серверный секрет. Настоящие секреты и service-account credentials в `VITE_*` помещать нельзя. Доступ к приватной библиотеке по-прежнему контролируют Firebase Auth и Firestore rules.

В Firebase Console → **Authentication → Settings → Authorized domains** проверьте `englishwithralina.github.io` и при необходимости добавьте этот домен — без `https://` и без `/Vocabulary-with-Ralina/`. Это особенно важно для операций Auth, использующих проверку домена. `VITE_FIREBASE_AUTH_DOMAIN` оставьте исходным значением из Firebase Web config; не заменяйте его на GitHub Pages URL. Если у Web API key настроены ограничения HTTP referrer, они также должны допускать новый адрес сайта; отключать защиту ради деплоя не нужно.

## Ссылки и SPA

Приложение уже использует query-маршрут: `/Vocabulary-with-Ralina/?practice=ID`. Teacher Studio переключает разделы внутри страницы, без History API путей `/dashboard` или `/library`. Поэтому серверные rewrite/404-перенаправления не нужны: и прямое открытие, и перезагрузка загружают тот же реальный `index.html`, сохраняя `?practice=…`.

Создание ссылки использует текущие `location.origin` и `location.pathname`, поэтому автоматически сохраняет префикс репозитория. ID опубликованных практик и данные не меняются. Старый адрес с `127.0.0.1` остаётся локальным: для учеников скопируйте Share на опубликованном сайте. Ссылка с другого действующего хостинга продолжит работать на том хостинге.

Не переименовывайте репозиторий без обновления Pages base. Не добавляйте BrowserRouter/404 hacks для существующих query-ссылок.

## Локальная проверка

```sh
npm test
npm run build:pages
npm run test:pages
npm run preview:pages
```

При стандартном порте preview откройте `http://127.0.0.1:4173/Vocabulary-with-Ralina/`. `test:pages` использует отдельный строгий статический сервер без SPA fallback, проверяет пути всех файлов сборки, входной экран, прямую ссылку `?practice=…`, вариант `index.html?practice=…` и перезагрузку. Тест блокирует внешние обращения, поэтому не читает и не изменяет рабочую базу Firebase. Для smoke-теста локально нужен Chrome; Actions устанавливает Chromium автоматически. Нормальные учебные сценарии и правила проверяются существующими `npm run test:e2e` и `npm run test:rules` в эмуляторах.

Официальные инструкции: [Vite — GitHub Pages](https://vite.dev/guide/static-deploy.html#github-pages), [GitHub — custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Firebase — Web API keys](https://firebase.google.com/docs/projects/api-keys).

## Выполненные проверки

29 сентября 2026: production Pages build прошёл; 14 модульных тестов, 10 проверок правил Firestore и 10 браузерных сценариев прошли. Дополнительный Pages smoke-тест подтвердил загрузку всех assets под префиксом репозитория, инициализацию входа, ленивую загрузку Teacher Studio, query-ссылки и reload. Проверены YAML workflow, доступность закреплённых версий Actions и согласованность зависимостей с package-lock. `git diff` подтвердил отсутствие изменений в `src`, `firestore.rules` и `firebase.json`; `.env.local` не отслеживается Git. Сам workflow ещё не запускался в GitHub: для этого нужны шаги настройки и push выше.
