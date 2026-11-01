//! Команды Tauri хранилища. Бинарные данные идут без JSON: запись — сырым телом запроса
//! (путь в заголовках), чтение — сырым ответом с байтом-признаком наличия файла.
//! На Android WebView не отдаёт тело запроса, поэтому там запись приходит JSON `{ "base64": … }`.

use super::files;
use super::roots::ProjectRoots;
use super::watch::Watchers;
use base64::Engine as _;
use percent_encoding::percent_decode_str;
use std::borrow::Cow;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager, Runtime, State};

const ROOT_HEADER: &str = "x-doska-root";
const PATH_HEADER: &str = "x-doska-path";
const FILE_MISSING: u8 = 0;
const FILE_PRESENT: u8 = 1;

#[tauri::command]
pub async fn storage_remove_directory(
    roots: State<'_, ProjectRoots>,
    root: String,
    path: String,
) -> Result<(), String> {
    super::removal::remove_directory(&roots, &root, &path)
}

fn io_error(error: std::io::Error) -> String {
    format!("IO: {error}")
}

/// Заголовок запроса, закодированный во фронтенде через encodeURIComponent.
fn header(request: &Request<'_>, name: &str) -> Result<String, String> {
    let raw = request
        .headers()
        .get(name)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| format!("BAD_REQUEST: нет заголовка {name}"))?;
    percent_decode_str(raw)
        .decode_utf8()
        .map(|value| value.into_owned())
        .map_err(|_| format!("BAD_REQUEST: заголовок {name} не UTF-8"))
}

/// Данные записи: сырое тело (компьютер) или `{ "base64": "…" }` (Android).
fn body_bytes<'a>(body: &'a InvokeBody) -> Result<Cow<'a, [u8]>, String> {
    match body {
        InvokeBody::Raw(data) => Ok(Cow::Borrowed(data.as_slice())),
        InvokeBody::Json(value) => value
            .get("base64")
            .and_then(|encoded| encoded.as_str())
            .ok_or_else(|| "BAD_REQUEST: ожидались двоичные данные".to_string())
            .and_then(|encoded| {
                base64::engine::general_purpose::STANDARD
                    .decode(encoded)
                    .map(Cow::Owned)
                    .map_err(|_| "BAD_REQUEST: испорченный base64".to_string())
            }),
    }
}

fn raw_write_args<'a>(request: &'a Request<'_>) -> Result<(String, String, Cow<'a, [u8]>), String> {
    Ok((
        header(request, ROOT_HEADER)?,
        header(request, PATH_HEADER)?,
        body_bytes(request.body())?,
    ))
}

#[tauri::command]
pub async fn storage_open_root(
    roots: State<'_, ProjectRoots>,
    path: String,
    create: Option<bool>,
) -> Result<String, String> {
    // Своя папка проектов из настроек может ещё не существовать (например, на телефоне).
    if create == Some(true) {
        std::fs::create_dir_all(&path).map_err(io_error)?;
    }
    roots
        .open(&path)
        .map(|root| root.to_string_lossy().into_owned())
}

/// Папка проектов по умолчанию: на компьютере — «Документы/Доска», на телефоне — данные
/// приложения (общую папку для Syncthing выбирают в настройках, с доступом ко всем файлам).
fn default_projects_dir<R: Runtime>(app: &AppHandle<R>) -> Result<std::path::PathBuf, String> {
    let paths = app.path();
    #[cfg(desktop)]
    if let Ok(documents) = paths.document_dir() {
        return Ok(documents.join("Доска"));
    }
    paths
        .app_data_dir()
        .map(|dir| dir.join("projects"))
        .map_err(|e| format!("NO_APP_DIR: {e}"))
}

/// Служебные папки приложения вне синхронизации: настройки устройства, резервные копии,
/// папка проектов по умолчанию. Создаются при необходимости и сразу открываются.
#[tauri::command]
pub async fn storage_open_app_folder<R: Runtime>(
    app: AppHandle<R>,
    roots: State<'_, ProjectRoots>,
    kind: String,
) -> Result<String, String> {
    let paths = app.path();
    let dir = match kind.as_str() {
        "settings" => paths
            .app_config_dir()
            .map_err(|e| format!("NO_APP_DIR: {e}"))?,
        "backups" => paths
            .app_data_dir()
            .map_err(|e| format!("NO_APP_DIR: {e}"))?
            .join("backups"),
        "projects" => default_projects_dir(&app)?,
        other => return Err(format!("BAD_REQUEST: неизвестная папка {other}")),
    };
    std::fs::create_dir_all(&dir).map_err(io_error)?;
    roots
        .open(&dir.to_string_lossy())
        .map(|root| root.to_string_lossy().into_owned())
}

/// Время последнего изменения файлов внутри папки (мс с 1970 г.): дата изменения проекта.
#[tauri::command]
pub async fn storage_latest_change(
    roots: State<'_, ProjectRoots>,
    root: String,
    path: String,
) -> Result<Option<f64>, String> {
    let latest = files::latest_change(&roots.resolve(&root, &path)?).map_err(io_error)?;
    Ok(latest.map(|time| {
        time.duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_millis() as f64)
            .unwrap_or(0.0)
    }))
}

#[tauri::command]
pub async fn storage_read(
    roots: State<'_, ProjectRoots>,
    root: String,
    path: String,
) -> Result<Response, String> {
    let target = roots.resolve(&root, &path)?;
    let bytes = match files::read(&target).map_err(io_error)? {
        None => vec![FILE_MISSING],
        Some(data) => {
            let mut bytes = Vec::with_capacity(data.len() + 1);
            bytes.push(FILE_PRESENT);
            bytes.extend_from_slice(&data);
            bytes
        }
    };
    Ok(Response::new(bytes))
}

#[tauri::command]
pub async fn storage_write_atomic(
    roots: State<'_, ProjectRoots>,
    request: Request<'_>,
) -> Result<(), String> {
    let (root, path, data) = raw_write_args(&request)?;
    files::write_atomic(&roots.resolve(&root, &path)?, &data).map_err(io_error)
}

#[tauri::command]
pub async fn storage_append(
    roots: State<'_, ProjectRoots>,
    request: Request<'_>,
) -> Result<(), String> {
    let (root, path, data) = raw_write_args(&request)?;
    files::append(&roots.resolve(&root, &path)?, &data).map_err(io_error)
}

#[tauri::command]
pub async fn storage_list(
    roots: State<'_, ProjectRoots>,
    root: String,
    path: String,
) -> Result<Vec<String>, String> {
    files::list(&roots.resolve(&root, &path)?).map_err(io_error)
}

#[tauri::command]
pub async fn storage_remove(
    roots: State<'_, ProjectRoots>,
    root: String,
    path: String,
) -> Result<(), String> {
    if path.is_empty() {
        return Err("INVALID_PATH: нельзя удалить папку проекта".into());
    }
    files::remove(&roots.resolve(&root, &path)?).map_err(io_error)
}

#[tauri::command]
pub async fn storage_watch<R: Runtime>(
    app: AppHandle<R>,
    roots: State<'_, ProjectRoots>,
    watchers: State<'_, Watchers>,
    root: String,
) -> Result<(), String> {
    watchers.watch(app, roots.root(&root)?)
}

#[tauri::command]
pub async fn storage_unwatch(
    roots: State<'_, ProjectRoots>,
    watchers: State<'_, Watchers>,
    root: String,
) -> Result<(), String> {
    watchers.unwatch(&roots.root(&root)?)
}
