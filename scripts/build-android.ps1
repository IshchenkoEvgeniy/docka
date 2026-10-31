# Подписанный release-APK «Доски» (шаг 3.14). Запуск: build-android.cmd в корне проекта.
# Инструменты (JDK, Android SDK, NDK) ставит setup-android.cmd — его нужно запустить хотя бы раз.
# Лог: build-android-log.txt. Готовый APK кладётся в папку release.

$ErrorActionPreference = 'Continue'
$projectDir = Split-Path -Parent $PSScriptRoot
Start-Transcript -Path (Join-Path $projectDir 'build-android-log.txt') -Force | Out-Null
Set-Location $projectDir

function Step($text) { Write-Host ''; Write-Host "=== $text ===" -ForegroundColor Cyan }
function Fail($text) {
    Write-Host $text -ForegroundColor Red
    Stop-Transcript | Out-Null
    Read-Host 'Нажмите Enter, чтобы закрыть'
    exit 1
}
foreach ($name in 'JAVA_HOME', 'ANDROID_HOME', 'NDK_HOME') {
    $value = [Environment]::GetEnvironmentVariable($name, 'User')
    if (-not $value) { $value = [Environment]::GetEnvironmentVariable($name, 'Machine') }
    if (-not $value) { Fail "Не задана переменная $name. Сначала запустите setup-android.cmd." }
    Set-Item "env:$name" $value
    Write-Host "$name=$value"
}
$machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
$user = [Environment]::GetEnvironmentVariable('Path', 'User')
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$machine;$user;$env:USERPROFILE\.cargo\bin"

$version = (Get-Content 'src-tauri\tauri.conf.json' -Raw -Encoding UTF8 | ConvertFrom-Json).version
Write-Host "Версия: $version"

Step 'Ключ подписи'
# Ключ живёт вне проекта: он не должен попасть в git или Syncthing, но должен пережить переустановку
# проекта — APK с другим ключом не встанет поверх установленного.
$keyDir = Join-Path $env:USERPROFILE '.doska'
$keystore = Join-Path $keyDir 'doska-release.jks'
$keyProps = Join-Path $keyDir 'keystore.properties'
if (-not (Test-Path $keystore)) {
    New-Item -ItemType Directory -Force $keyDir | Out-Null
    $password = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
    & "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v -keystore $keystore -storetype PKCS12 `
        -keyalg RSA -keysize 2048 -validity 10000 -alias doska `
        -storepass $password -keypass $password -dname 'CN=Doska, O=Personal'
    if ($LASTEXITCODE -ne 0) { Fail 'keytool не смог создать ключ.' }
    $storePath = $keystore -replace '\\', '/'
    $lines = @("storeFile=$storePath", "storePassword=$password", 'keyAlias=doska', "keyPassword=$password")
    [IO.File]::WriteAllLines($keyProps, $lines)
    Write-Host "Создан ключ: $keystore" -ForegroundColor Yellow
    Write-Host 'Сохраните папку .doska (например, в резервную копию): без неё обновления не встанут.' -ForegroundColor Yellow
} else {
    Write-Host "Ключ: $keystore"
}
if (-not (Test-Path $keyProps)) { Fail "Нет $keyProps рядом с ключом." }
Copy-Item $keyProps 'src-tauri\gen\android\keystore.properties' -Force

Step 'Зависимости'
pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { Fail 'pnpm install не прошёл.' }

Step 'Сборка release-APK (arm64)'
pnpm tauri android build --apk --target aarch64
if ($LASTEXITCODE -ne 0) { Fail 'Сборка не прошла. Пришлите build-android-log.txt.' }

$apk = Get-ChildItem 'src-tauri\gen\android\app\build\outputs\apk' -Recurse -Filter '*-release.apk' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $apk) { Fail 'Не найден *-release.apk в src-tauri\gen\android\app\build\outputs\apk.' }
New-Item -ItemType Directory -Force 'release' | Out-Null
$target = Join-Path $projectDir "release\Doska-$version.apk"
Copy-Item $apk.FullName $target -Force
Write-Host "APK: $target" -ForegroundColor Green

Step 'Установка на телефон (если подключён по USB)'
$devices = adb devices | Select-String '\tdevice$'
if ($devices) {
    $result = adb install -r $target 2>&1 | Out-String
    Write-Host $result
    if ($result -match 'INSTALL_FAILED_UPDATE_INCOMPATIBLE') {
        Write-Host 'На телефоне стоит сборка с другим ключом (отладочная). Удалите «Доску» с телефона' -ForegroundColor Yellow
        Write-Host 'и запустите этот файл ещё раз. Проекты в папке Doska останутся.' -ForegroundColor Yellow
    }
} else {
    Write-Host 'Телефон не подключён. Перекиньте APK на телефон любым способом и откройте его.'
}

Step 'Готово'
Stop-Transcript | Out-Null
Start-Process explorer.exe "/select,`"$target`""
Read-Host 'Нажмите Enter, чтобы закрыть'
