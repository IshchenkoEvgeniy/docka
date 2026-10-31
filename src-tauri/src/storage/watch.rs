//! Слежение за папкой проекта: сообщает фронтенду, какие файлы изменились снаружи
//! (например, их привёз Syncthing). Временные файлы атомарной записи не сообщаются.

use super::paths::{relative_to, TEMP_SUFFIX};
use notify::{RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Runtime};

/// Имя события во фронтенде.
pub const CHANGED_EVENT: &str = "storage://changed";

#[derive(Clone, Serialize)]
pub struct ChangedPayload {
    pub root: String,
    pub paths: Vec<String>,
}

#[derive(Default)]
pub struct Watchers(Mutex<HashMap<PathBuf, notify::RecommendedWatcher>>);

impl Watchers {
    pub fn watch<R: Runtime>(&self, app: AppHandle<R>, root: PathBuf) -> Result<(), String> {
        let mut watchers = self
            .0
            .lock()
            .map_err(|_| "INTERNAL: реестр слежения повреждён")?;
        if watchers.contains_key(&root) {
            return Ok(());
        }
        let event_root = root.clone();
        let mut watcher =
            notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
                let Ok(event) = result else { return };
                let paths: Vec<String> = event
                    .paths
                    .iter()
                    .filter_map(|path| relative_to(&event_root, path))
                    .filter(|path| !path.ends_with(TEMP_SUFFIX))
                    .collect();
                if !paths.is_empty() {
                    let root = event_root.to_string_lossy().into_owned();
                    let _ = app.emit(CHANGED_EVENT, ChangedPayload { root, paths });
                }
            })
            .map_err(|e| format!("WATCH_FAILED: {e}"))?;
        watcher
            .watch(&root, RecursiveMode::Recursive)
            .map_err(|e| format!("WATCH_FAILED: {e}"))?;
        watchers.insert(root, watcher);
        Ok(())
    }

    pub fn unwatch(&self, root: &PathBuf) -> Result<(), String> {
        let mut watchers = self
            .0
            .lock()
            .map_err(|_| "INTERNAL: реестр слежения повреждён")?;
        watchers.remove(root);
        Ok(())
    }
}
