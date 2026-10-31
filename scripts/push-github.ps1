# Первая отправка проекта на GitHub (история по этапам из docka-history.bundle).
# Запуск: push-github.cmd в корне проекта. Файлы проекта не меняются.

$ErrorActionPreference = 'Continue'
$projectDir = Split-Path -Parent $PSScriptRoot
Set-Location $projectDir
$remote = 'https://github.com/IshchenkoEvgeniy/docka.git'
$bundle = Join-Path $projectDir 'docka-history.bundle'

function Fail($text) {
    Write-Host $text -ForegroundColor Red
    Read-Host 'Нажмите Enter, чтобы закрыть'
    exit 1
}
function Refresh-Path {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machine;$user"
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host 'Git не найден, ставлю через winget'
    winget install --id Git.Git -e --silent --accept-package-agreements --accept-source-agreements
    Refresh-Path
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail 'Git не установился. Поставьте его с https://git-scm.com и запустите снова.' }
}
git --version

if (-not (Test-Path '.git')) {
    if (-not (Test-Path $bundle)) { Fail "Нет файла $bundle." }
    git init -b main
    # Ветка main ещё пустая и «выбрана» — без --update-head-ok Git в неё не пишет.
    git fetch --update-head-ok $bundle main:main
    if ($LASTEXITCODE -ne 0) { Fail 'Не удалось прочитать историю из docka-history.bundle.' }
    # Индекс — по последнему коммиту; рабочие файлы не трогаются.
    git reset -q
} else {
    Write-Host 'Папка уже под Git — историю из bundle не подключаю.'
}

if (-not (git config user.name)) { git config user.name 'IshchenkoEvgeniy' }
if (-not (git config user.email)) {
    $email = Read-Host 'Ваш e-mail для коммитов (как в GitHub)'
    git config user.email $email
}
if (-not (git remote | Select-String '^origin$')) { git remote add origin $remote }

Write-Host ''
Write-Host 'Отличия рабочей папки от последнего коммита (пусто — всё совпадает):' -ForegroundColor Cyan
git status --short
git log --oneline

Write-Host ''
Write-Host 'Отправка на GitHub (при первом разе откроется вход в GitHub)…' -ForegroundColor Cyan
git push -u origin main
if ($LASTEXITCODE -ne 0) { Fail 'Отправка не прошла. Пришлите текст из этого окна.' }
Write-Host "Готово: $remote" -ForegroundColor Green
Read-Host 'Нажмите Enter, чтобы закрыть'
