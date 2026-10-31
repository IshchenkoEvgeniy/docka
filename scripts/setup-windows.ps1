# Установка инструментов для «Доски» и первая сборка.
# Запускается через setup-windows.cmd в корне проекта. Лог пишется в setup-log.txt.

$ErrorActionPreference = 'Continue'
# Полоса прогресса Invoke-WebRequest в PowerShell 5 замедляет скачивание в разы.
$ProgressPreference = 'SilentlyContinue'
$projectDir = Split-Path -Parent $PSScriptRoot

# Установщикам нужны права администратора: перезапускаемся с повышением.
$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

$log = Join-Path $projectDir 'setup-log.txt'
Start-Transcript -Path $log -Force | Out-Null
Set-Location $projectDir

function Step($text) { Write-Host ''; Write-Host "=== $text ===" -ForegroundColor Cyan }

function Refresh-Path {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machine;$user;$env:USERPROFILE\.cargo\bin"
}

function Require-Command($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        Write-Host "НЕ НАЙДЕНА КОМАНДА $name. Установка прервана, пришлите setup-log.txt." -ForegroundColor Red
        Stop-Transcript | Out-Null
        Read-Host 'Нажмите Enter, чтобы закрыть'
        exit 1
    }
}

function Install-WingetPackage($id, $extra) {
    Write-Host "winget install $id"
    $wingetArgs = @('install', '--id', $id, '-e', '--silent', '--accept-package-agreements', '--accept-source-agreements') + $extra
    & winget @wingetArgs
    Write-Host "winget exit code: $LASTEXITCODE"
}

Step 'Проверка winget'
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host 'НЕТ WINGET. Установите «Установщик приложений» (App Installer) из Microsoft Store и запустите скрипт снова.' -ForegroundColor Red
    Stop-Transcript | Out-Null
    exit 1
}
winget --version

Step 'Windows и WebView2'
[Environment]::OSVersion.VersionString
Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty pv

Step '1/4 Microsoft C++ Build Tools (5-15 минут)'
Install-WingetPackage 'Microsoft.VisualStudio.2022.BuildTools' @('--override', '--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended')

Step '2/4 Rust'
Install-WingetPackage 'Rustlang.Rustup' @()
Refresh-Path
Require-Command 'rustup'
rustup default stable-msvc
rustc -V
cargo -V

Step '3/4 Node.js LTS и pnpm'
Install-WingetPackage 'OpenJS.NodeJS.LTS' @()
Refresh-Path
Require-Command 'node'
node -v
# В Node.js 25+ нет встроенного corepack, поэтому pnpm ставится через npm.
npm install -g pnpm@10.28.0
Refresh-Path
Require-Command 'pnpm'
pnpm -v

Step '4/4 Git'
Install-WingetPackage 'Git.Git' @()
Refresh-Path
git --version

Step 'Зависимости проекта: pnpm install'
$env:CI = 'true'
pnpm install --frozen-lockfile
Write-Host "pnpm install exit code: $LASTEXITCODE"

Step 'Проверки: pnpm check'
pnpm check
Write-Host "pnpm check exit code: $LASTEXITCODE"

Step 'Сборка приложения: pnpm tauri build --debug --no-bundle'
pnpm tauri build --debug --no-bundle
Write-Host "tauri build exit code: $LASTEXITCODE"

Step 'Готово'
Write-Host 'Лог сохранён в setup-log.txt. Можно закрыть окно.' -ForegroundColor Green
Stop-Transcript | Out-Null
Read-Host 'Нажмите Enter, чтобы закрыть'
