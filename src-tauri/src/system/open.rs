//! Открытие ссылок в браузере и файлов проекта в системных программах (ADR 0005).
//! Права плагина opener фронтенду не выдаются: открыть можно только то, что проверено здесь.

use super::net::check_url;
use crate::storage::ProjectRoots;
use tauri::{AppHandle, Runtime, State};
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub async fn system_open_url<R: Runtime>(app: AppHandle<R>, url: String) -> Result<(), String> {
    let url = check_url(&url)?;
    app.opener()
        .open_url(url.as_str(), None::<&str>)
        .map_err(|error| format!("OPEN: {error}"))
}

/// Файл внутри открытой папки (проекта или папки проектов) — системной программой.
/// На Android файлы открывает мост DoskaAndroid.openFile (FileProvider).
#[tauri::command]
pub async fn system_open_file<R: Runtime>(
    app: AppHandle<R>,
    roots: State<'_, ProjectRoots>,
    root: String,
    path: String,
) -> Result<(), String> {
    let target = roots.resolve(&root, &path)?;
    if !target.is_file() {
        return Err("NOT_FOUND: файла нет".to_string());
    }
    app.opener()
        .open_path(target.to_string_lossy(), None::<&str>)
        .map_err(|error| format!("OPEN: {error}"))
}
