# Сборка установщика «Доски» для Windows (шаг 3.14). Запуск: build-windows.cmd в корне проекта.
# Лог: build-windows-log.txt. Готовый установщик кладётся в папку release.

$ErrorActionPreference = 'Continue'
$projectDir = Split-Path -Parent $PSScriptRoot
Start-Transcript -Path (Join-Path $projectDir 'build-windows-log.txt') -Force | Out-Null
Set-Location $projectDir

function Step($text) { Write-Host ''; Write-Host "=== $text ===" -ForegroundColor Cyan }
function Fail($text) {
    Write-Host $text -ForegroundColor Red
    Stop-Transcript | Out-Null
    Read-Host 'Нажмите Enter, чтобы закрыть'
    exit 1
}
$machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
$user = [Environment]::GetEnvironmentVariable('Path', 'User')
$env:Path = "$machine;$user;$env:USERPROFILE\.cargo\bin"

$version = (Get-Content 'src-tauri\tauri.conf.json' -Raw -Encoding UTF8 | ConvertFrom-Json).version
Write-Host "Версия: $version"

Step 'Зависимости'
pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { Fail 'pnpm install не прошёл.' }

Step 'Проверки (типы, линтер, тесты, слои)'
pnpm check
if ($LASTEXITCODE -ne 0) { Fail 'Проверки не прошли — сборка остановлена. Пришлите build-windows-log.txt.' }

Step 'Сборка установщика (первый раз — 5–15 минут)'
pnpm tauri build --bundles nsis
if ($LASTEXITCODE -ne 0) { Fail 'Сборка не прошла. Пришлите build-windows-log.txt.' }

$setup = Get-ChildItem 'src-tauri\target\release\bundle\nsis' -Filter '*-setup.exe' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $setup) { Fail 'Не найден установщик в src-tauri\target\release\bundle\nsis.' }
New-Item -ItemType Directory -Force 'release' | Out-Null
$target = Join-Path $projectDir "release\Doska-$version-setup.exe"
Copy-Item $setup.FullName $target -Force

Step 'Готово'
Write-Host "Установщик: $target" -ForegroundColor Green
Write-Host 'Запустите его: приложение встанет для текущего пользователя, права администратора не нужны.'
Stop-Transcript | Out-Null
Start-Process explorer.exe "/select,`"$target`""
Read-Host 'Нажмите Enter, чтобы закрыть'
