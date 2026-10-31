# Поиск и настройка Android-инструментов для «Доски», затем сборка APK.
# Запускается через setup-android.cmd в корне проекта. Права администратора не нужны.
# Лог: setup-android-log.txt.

$ErrorActionPreference = 'Continue'
# Полоса прогресса Invoke-WebRequest в PowerShell 5 замедляет скачивание в разы.
$ProgressPreference = 'SilentlyContinue'
$projectDir = Split-Path -Parent $PSScriptRoot
$log = Join-Path $projectDir 'setup-android-log.txt'
Start-Transcript -Path $log -Force | Out-Null
Set-Location $projectDir

function Step($text) { Write-Host ''; Write-Host "=== $text ===" -ForegroundColor Cyan }
function Fail($text) {
    Write-Host $text -ForegroundColor Red
    Stop-Transcript | Out-Null
    Read-Host 'Нажмите Enter, чтобы закрыть'
    exit 1
}
function Refresh-Path {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machine;$user;$env:USERPROFILE\.cargo\bin"
}
function First-Existing($paths, $marker) {
    foreach ($p in $paths) {
        if ($p -and (Test-Path (Join-Path $p $marker))) { return (Resolve-Path $p).Path }
    }
    return $null
}

Step 'Поиск Android Studio, SDK и Java'
$studioCandidates = @(
    "$env:ProgramFiles\Android\Android Studio",
    "$env:LOCALAPPDATA\Programs\Android Studio",
    "$env:USERPROFILE\scoop\apps\android-studio\current"
) + (Get-ChildItem "$env:LOCALAPPDATA\JetBrains\Toolbox\apps" -Directory -ErrorAction SilentlyContinue | ForEach-Object { Get-ChildItem $_.FullName -Recurse -Depth 3 -Filter 'studio64.exe' -ErrorAction SilentlyContinue | ForEach-Object { Split-Path (Split-Path $_.FullName) } })
$studio = First-Existing $studioCandidates 'bin\studio64.exe'
Write-Host "Android Studio: $studio"

$sdkCandidates = @(
    $env:ANDROID_HOME, $env:ANDROID_SDK_ROOT,
    "$env:LOCALAPPDATA\Android\Sdk",
    "$env:USERPROFILE\scoop\apps\android-clt\current",
    "$env:USERPROFILE\scoop\persist\android-clt"
)
$sdk = First-Existing $sdkCandidates 'platform-tools'
if (-not $sdk) { $sdk = First-Existing $sdkCandidates 'cmdline-tools' }
Write-Host "Android SDK: $sdk"

function Find-Jdk {
    $candidates = @($env:JAVA_HOME)
    if ($studio) { $candidates += @("$studio\jbr", "$studio\jre") }
    # Отдельно установленные JDK 17+: Microsoft, Eclipse Adoptium (Temurin), Oracle, scoop.
    foreach ($root in "$env:ProgramFiles\Microsoft", "$env:ProgramFiles\Eclipse Adoptium", "$env:ProgramFiles\Java", "$env:USERPROFILE\scoop\apps") {
        $candidates += Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match '(jdk|openjdk|temurin)[^\d]*(1[7-9]|[2-9]\d)' } |
            Sort-Object Name -Descending | ForEach-Object { $_.FullName; "$($_.FullName)\current" }
    }
    return First-Existing $candidates 'bin\java.exe'
}
$jdk = Find-Jdk
Write-Host "Java (JDK): $jdk"

Write-Host "Переменные: ANDROID_HOME=$env:ANDROID_HOME NDK_HOME=$env:NDK_HOME JAVA_HOME=$env:JAVA_HOME"
if ($sdk) {
    Write-Host 'Содержимое SDK:'
    Get-ChildItem $sdk -Directory | ForEach-Object { Write-Host "  $($_.Name)" }
    foreach ($sub in 'platforms', 'build-tools', 'ndk', 'cmdline-tools') {
        $dir = Join-Path $sdk $sub
        if (Test-Path $dir) { Write-Host "  ${sub}: $((Get-ChildItem $dir -Directory).Name -join ', ')" }
    }
}

$devMode = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock' -ErrorAction SilentlyContinue).AllowDevelopmentWithoutDevLicense
Write-Host "Режим разработчика Windows: $devMode"

Step 'Установка недостающего'
if (-not $jdk) {
    # Android Studio целиком (1,4 ГБ) не нужен: для сборки достаточно JDK (~180 МБ).
    Write-Host 'JDK не найден, ставлю Microsoft OpenJDK 21 через winget (может спросить права администратора)'
    winget install --id Microsoft.OpenJDK.21 -e --silent --accept-package-agreements --accept-source-agreements
    $jdk = Find-Jdk
    if (-not $jdk) { Fail 'НЕ НАЙДЕН JDK после установки. Пришлите setup-android-log.txt.' }
}
$env:JAVA_HOME = $jdk
$env:Path = "$jdk\bin;$env:Path"
& "$jdk\bin\java.exe" -version

if (-not $sdk) { $sdk = "$env:LOCALAPPDATA\Android\Sdk"; New-Item -ItemType Directory -Force $sdk | Out-Null }
$env:ANDROID_HOME = $sdk

$sdkmanager = Get-ChildItem "$sdk\cmdline-tools" -Recurse -Filter 'sdkmanager.bat' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $sdkmanager) {
    Write-Host 'Нет Android command-line tools, скачиваю'
    $zip = Join-Path $env:TEMP 'android-cmdline-tools.zip'
    Invoke-WebRequest 'https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip' -OutFile $zip
    $tmp = Join-Path $env:TEMP 'android-cmdline-tools'
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    Expand-Archive $zip $tmp
    New-Item -ItemType Directory -Force "$sdk\cmdline-tools" | Out-Null
    Move-Item "$tmp\cmdline-tools" "$sdk\cmdline-tools\latest" -Force
    $sdkmanager = Get-Item "$sdk\cmdline-tools\latest\bin\sdkmanager.bat" -ErrorAction SilentlyContinue
    if (-not $sdkmanager) { Fail 'НЕ УДАЛОСЬ поставить command-line tools. Пришлите setup-android-log.txt.' }
}
Write-Host "sdkmanager: $($sdkmanager.FullName)"

# Самые свежие стабильные платформа, build-tools и NDK из списка доступных.
$available = & $sdkmanager.FullName --list 2>$null | ForEach-Object { ($_ -split '\|')[0].Trim() }
function Latest($prefix, $pattern) {
    $available | Where-Object { $_ -like "$prefix*" -and $_ -match $pattern } |
        Sort-Object { [version](($_ -replace "^$([regex]::Escape($prefix))", '') -replace '[^0-9.].*$', '') } |
        Select-Object -Last 1
}
$platform = $available | Where-Object { $_ -match '^platforms;android-\d+$' } | Sort-Object { [int]($_ -replace '\D', '') } | Select-Object -Last 1
$buildTools = Latest 'build-tools;' '^build-tools;[\d.]+$'
$ndk = Latest 'ndk;' '^ndk;[\d.]+$'
$packages = @('platform-tools', $platform, $buildTools, $ndk) | Where-Object { $_ }
Write-Host "Пакеты SDK: $($packages -join ', ')"
1..30 | ForEach-Object { 'y' } | & $sdkmanager.FullName --licenses | Out-Null
& $sdkmanager.FullName @packages

$ndkDir = Get-ChildItem "$sdk\ndk" -Directory -ErrorAction SilentlyContinue | Sort-Object { [version]$_.Name } | Select-Object -Last 1
if (-not $ndkDir) { Fail 'НЕ НАЙДЕН NDK после установки. Пришлите setup-android-log.txt.' }
$env:NDK_HOME = $ndkDir.FullName

Step 'Переменные среды (для вашего пользователя)'
[Environment]::SetEnvironmentVariable('JAVA_HOME', $env:JAVA_HOME, 'User')
[Environment]::SetEnvironmentVariable('ANDROID_HOME', $env:ANDROID_HOME, 'User')
[Environment]::SetEnvironmentVariable('NDK_HOME', $env:NDK_HOME, 'User')
Write-Host "JAVA_HOME=$env:JAVA_HOME"
Write-Host "ANDROID_HOME=$env:ANDROID_HOME"
Write-Host "NDK_HOME=$env:NDK_HOME"
$env:Path = "$sdk\platform-tools;$env:Path"

Step 'Цели Rust для Android'
Refresh-Path
$env:Path = "$jdk\bin;$sdk\platform-tools;$env:Path"
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android

Step 'Android-проект Tauri'
pnpm install --frozen-lockfile
if (-not (Test-Path 'src-tauri\gen\android')) { pnpm tauri android init --ci }
Write-Host "tauri android init exit code: $LASTEXITCODE"

Step 'Подключённые устройства (adb devices)'
adb devices -l

Step 'Режим разработчика Windows'
# Tauri кладёт собранную библиотеку в Android-проект символической ссылкой,
# а Windows разрешает их без прав администратора только в режиме разработчика.
function Test-DevMode {
    (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock' -ErrorAction SilentlyContinue).AllowDevelopmentWithoutDevLicense -eq 1
}
if (-not (Test-DevMode)) {
    Write-Host 'Режим разработчика выключен. Открываю настройки: включите «Режим разработчика».' -ForegroundColor Yellow
    Start-Process 'ms-settings:developers'
    Read-Host 'Включите режим и нажмите Enter'
    if (-not (Test-DevMode)) { Fail 'Режим разработчика всё ещё выключен — без него сборка под Android не пройдёт.' }
}
Write-Host 'Режим разработчика включён.'

Step 'Сборка APK (только arm64, отладочная)'
pnpm tauri android build --apk --debug --target aarch64
Write-Host "android build exit code: $LASTEXITCODE"
Get-ChildItem 'src-tauri\gen\android' -Recurse -Filter '*.apk' -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "APK: $($_.FullName)" }

Step 'Готово'
Write-Host 'Лог сохранён в setup-android-log.txt. Можно закрыть окно.' -ForegroundColor Green
Stop-Transcript | Out-Null
Read-Host 'Нажмите Enter, чтобы закрыть'
