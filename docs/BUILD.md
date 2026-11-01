# Сборка и запуск

## Один раз: установить инструменты (Windows 10/11)

1. **Microsoft C++ Build Tools** — https://visualstudio.microsoft.com/visual-cpp-build-tools/
   В установщике отметить «Разработка классических приложений на C++» (Desktop development with C++).
2. **WebView2** — уже есть в Windows 10/11. Если нет: https://developer.microsoft.com/microsoft-edge/webview2/
3. **Rust** — https://rustup.rs → запустить `rustup-init.exe`, выбрать вариант по умолчанию (MSVC).
4. **Node.js 22 или 24 LTS** — https://nodejs.org
5. **pnpm** — в терминале: `npm install -g pnpm@10.28.0` (в Node.js 25+ нет встроенного corepack).
6. **Git** — https://git-scm.com (по желанию, но рекомендуется).

Проверка: `rustc -V`, `node -v`, `pnpm -v` печатают версии.

## Каждый день

Все команды — в папке проекта `L:\project\docka`.

| Команда | Что делает |
| --- | --- |
| `pnpm install` | Ставит зависимости (после клонирования или изменения package.json) |
| `pnpm tauri dev` | Запускает приложение в режиме разработки с горячей перезагрузкой |
| `pnpm check` | Все проверки: типы, линтер, форматирование, тесты, правила слоёв |
| `pnpm test:e2e` | Chromium: PNG, диалоги, мобильный viewport и замер 1000 карточек |
| `pnpm format` | Автоматически форматирует код |
| `pnpm tauri build` | Собирает установщики для Windows |

Готовые установщики после `pnpm tauri build`:
`src-tauri\target\release\bundle\msi\` и `src-tauri\target\release\bundle\nsis\`.

Для первого запуска сквозных тестов: `pnpm exec playwright install chromium`.
Тесты запускают собственный Vite на порту 1420; перед ними остановите `pnpm dev`.
Тестовые проекты живут в памяти браузера, рабочие папки не затрагиваются.
Результаты и изображения — `test-results/` (не попадают в git).

Экспорт PNG — кнопка «Экспорт» на панели доски: вся доска или выделение, 1–3×,
прозрачный или цветной фон текущей темы. Предел — 8192 пикселя по стороне и 32 млн пикселей.
Медиа экспортируются статичными подписанными карточками; ещё не синхронизированные файлы —
заглушками. Системное сохранение на устройствах нужно проверить вручную.

## Сборки для себя (шаг 3.14)

| Файл | Что делает |
| --- | --- |
| `build-windows.cmd` | Проверки, затем установщик `release\Doska-<версия>-setup.exe` |
| `build-android.cmd` | Подписанный APK `release\Doska-<версия>.apk`; если телефон подключён по USB — ставит его |

Ключ подписи Android создаётся при первом запуске в `%USERPROFILE%\.doska\doska-release.jks`
(пароль — рядом в `keystore.properties`). **Сохраните эту папку**: APK, подписанный другим
ключом, не встанет поверх установленного — придётся удалять приложение. Проекты при этом не
пропадут (они в общей папке `Doska`), сбросятся только настройки устройства.

Отладочную сборку из `setup-android.cmd` перед первой установкой release-APK нужно удалить с
телефона: у них разные ключи.

Первая сборка Rust идёт 3–10 минут, дальше — секунды.

## Android (шаг 0.3)

Проще всего запустить `setup-android.cmd`: он найдёт или поставит JDK и Android SDK, пропишет переменные среды и соберёт APK. Ниже — то же самое вручную.

0. Включить **режим разработчика Windows**: Параметры → Система → Для разработчиков (`ms-settings:developers`). Без него сборка падает с ошибкой «Creation symbolic link is not allowed».
1. JDK 17+ (например, `winget install Microsoft.OpenJDK.21`) и Android SDK. Android Studio не обязателен, но удобен: https://developer.android.com/studio
2. В Android Studio → SDK Manager:
   - вкладка SDK Platforms: последняя Android;
   - вкладка SDK Tools: Android SDK Build-Tools, Android SDK Command-line Tools,
     Android SDK Platform-Tools, NDK (Side by side).
3. Переменные среды Windows (Параметры → Система → О программе → Доп. параметры → Переменные среды):
   - `JAVA_HOME` = `C:\Program Files\Android\Android Studio\jbr`
   - `ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk`
   - `NDK_HOME` = `%ANDROID_HOME%\ndk\<версия>`
4. Цели Rust для Android:
   `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`
5. В папке проекта один раз: `pnpm tauri android init` (создаст `src-tauri\gen\android`, её коммитим).
6. Запуск на телефоне по USB (включена отладка по USB) или в эмуляторе: `pnpm tauri android dev`.
7. Сборка APK: `pnpm tauri android build --apk`.

## Иконка

Исходник — `src-tauri\icons\app-icon.png` (1024×1024). После его замены:
`pnpm tauri icon src-tauri\icons\app-icon.png` — пересоздаст все размеры для Windows и Android.

## Git и GitHub

Репозиторий: https://github.com/IshchenkoEvgeniy/docka

Первый раз — `push-github.cmd`: поставит Git (если его нет), подключит историю из
`docka-history.bundle` (коммиты по этапам), привяжет папку к GitHub и отправит ветку `main`.
При первой отправке Git откроет окно входа в GitHub. Файлы проекта при этом не меняются.

Дальше — обычные команды в папке проекта:

```
git add -A
git commit -m "что сделано"
git push
```
