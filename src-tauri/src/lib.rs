//! Нативная часть «Доски». Здесь только системные операции
//! (атомарная запись, слежение за папкой, системные пути, превью ссылок, открытие файлов);
//! бизнес-логика живёт в TypeScript.

mod storage;
mod system;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(storage::ProjectRoots::default())
        .manage(storage::Watchers::default())
        .invoke_handler(tauri::generate_handler![
            storage::commands::storage_open_root,
            storage::commands::storage_open_app_folder,
            storage::commands::storage_latest_change,
            storage::commands::storage_read,
            storage::commands::storage_write_atomic,
            storage::commands::storage_append,
            storage::commands::storage_list,
            storage::commands::storage_remove,
            storage::commands::storage_remove_directory,
            storage::commands::storage_watch,
            storage::commands::storage_unwatch,
            system::net::net_fetch,
            system::open::system_open_url,
            system::open::system_open_file,
        ])
        .run(tauri::generate_context!())
        .expect("не удалось запустить приложение Tauri");
}
