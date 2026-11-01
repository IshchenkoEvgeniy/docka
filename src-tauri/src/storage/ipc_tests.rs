//! Сквозные тесты команд хранилища через IPC Tauri: так их вызывает фронтенд
//! (JSON-аргументы, сырое тело с заголовками, сырой ответ, события слежения).

use super::commands::*;
use super::{ProjectRoots, Watchers};
use std::sync::mpsc;
use std::time::Duration;
use tauri::ipc::{CallbackFn, InvokeBody, InvokeResponseBody};
use tauri::test::{
    get_ipc_response, mock_builder, mock_context, noop_assets, MockRuntime, INVOKE_KEY,
};
use tauri::webview::InvokeRequest;
use tauri::{Listener, WebviewWindow, WebviewWindowBuilder};

fn app() -> (tauri::App<MockRuntime>, WebviewWindow<MockRuntime>) {
    let app = mock_builder()
        .manage(ProjectRoots::default())
        .manage(Watchers::default())
        .invoke_handler(tauri::generate_handler![
            storage_open_root,
            storage_read,
            storage_write_atomic,
            storage_append,
            storage_list,
            storage_remove,
            storage_watch,
            storage_unwatch,
        ])
        .build(mock_context(noop_assets()))
        .expect("тестовое приложение");
    let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .expect("окно");
    (app, webview)
}

fn request(cmd: &str, body: InvokeBody, headers: &[(&'static str, String)]) -> InvokeRequest {
    let mut header_map = tauri::http::HeaderMap::new();
    for (name, value) in headers {
        header_map.insert(*name, value.parse().expect("заголовок"));
    }
    InvokeRequest {
        cmd: cmd.into(),
        callback: CallbackFn(0),
        error: CallbackFn(1),
        // Локальный адрес приложения; с внешних адресов Tauri команды не пропускает.
        url: if cfg!(windows) {
            "http://tauri.localhost"
        } else {
            "tauri://localhost"
        }
        .parse()
        .expect("url"),
        body,
        headers: header_map,
        invoke_key: INVOKE_KEY.to_string(),
    }
}

fn json(cmd: &str, args: serde_json::Value) -> InvokeRequest {
    request(cmd, InvokeBody::Json(args), &[])
}

fn encode(value: &str) -> String {
    percent_encoding::utf8_percent_encode(value, percent_encoding::NON_ALPHANUMERIC).to_string()
}

fn raw(cmd: &str, root: &str, path: &str, data: &[u8]) -> InvokeRequest {
    let headers = [
        ("x-doska-root", encode(root)),
        ("x-doska-path", encode(path)),
    ];
    request(cmd, InvokeBody::Raw(data.to_vec()), &headers)
}

fn bytes(response: InvokeResponseBody) -> Vec<u8> {
    match response {
        InvokeResponseBody::Raw(data) => data,
        InvokeResponseBody::Json(text) => panic!("ожидались байты, пришёл JSON {text}"),
    }
}

fn open_root(webview: &WebviewWindow<MockRuntime>, path: &std::path::Path) -> String {
    let response = get_ipc_response(
        webview,
        json("storage_open_root", serde_json::json!({ "path": path })),
    )
    .expect("папка открывается");
    response.deserialize::<String>().expect("путь строкой")
}

#[test]
fn запись_дописывание_чтение_и_список_через_ipc() {
    let (_app, webview) = app();
    let dir = tempfile::tempdir().unwrap();
    let project = dir.path().join("Моя игра.doska");
    std::fs::create_dir(&project).unwrap();
    let root = open_root(&webview, &project);

    get_ipc_response(
        &webview,
        raw(
            "storage_write_atomic",
            &root,
            "data/pc/доска.snapshot",
            &[1, 2, 3],
        ),
    )
    .unwrap();
    get_ipc_response(
        &webview,
        raw("storage_append", &root, "data/pc/доска.log", &[4]),
    )
    .unwrap();
    get_ipc_response(
        &webview,
        raw("storage_append", &root, "data/pc/доска.log", &[5, 6]),
    )
    .unwrap();

    let read = |path: &str| {
        bytes(
            get_ipc_response(
                &webview,
                json(
                    "storage_read",
                    serde_json::json!({ "root": root, "path": path }),
                ),
            )
            .unwrap(),
        )
    };
    assert_eq!(read("data/pc/доска.snapshot"), vec![1, 1, 2, 3]);
    assert_eq!(read("data/pc/доска.log"), vec![1, 4, 5, 6]);
    assert_eq!(read("data/pc/нет.log"), vec![0]);

    let list = get_ipc_response(
        &webview,
        json(
            "storage_list",
            serde_json::json!({ "root": root, "path": "data/pc" }),
        ),
    )
    .unwrap()
    .deserialize::<Vec<String>>()
    .unwrap();
    assert_eq!(list, vec!["доска.log", "доска.snapshot"]);

    get_ipc_response(
        &webview,
        json(
            "storage_remove",
            serde_json::json!({ "root": root, "path": "data/pc/доска.log" }),
        ),
    )
    .unwrap();
    assert_eq!(read("data/pc/доска.log"), vec![0]);
    let error = get_ipc_response(
        &webview,
        json(
            "storage_remove",
            serde_json::json!({ "root": root, "path": "" }),
        ),
    )
    .unwrap_err();
    assert!(error.to_string().contains("INVALID_PATH"), "{error}");
}

#[test]
fn запись_на_android_приходит_в_base64() {
    // На Android WebView не передаёт тело запроса, и Tauri шлёт данные через JSON.
    let (_app, webview) = app();
    let dir = tempfile::tempdir().unwrap();
    let root = open_root(&webview, dir.path());
    let headers = [
        ("x-doska-root", encode(&root)),
        ("x-doska-path", encode("settings.json")),
    ];
    let body = InvokeBody::Json(serde_json::json!({ "base64": "AQID" }));
    get_ipc_response(&webview, request("storage_write_atomic", body, &headers)).unwrap();
    assert_eq!(
        std::fs::read(dir.path().join("settings.json")).unwrap(),
        vec![1, 2, 3]
    );

    let broken = InvokeBody::Json(serde_json::json!([1, 2, 3]));
    let error = get_ipc_response(&webview, request("storage_append", broken, &headers));
    assert!(error.is_err());
}

#[test]
fn команды_отказывают_вне_открытой_папки() {
    let (_app, webview) = app();
    let dir = tempfile::tempdir().unwrap();
    let not_opened = dir.path().to_string_lossy().into_owned();
    let error = get_ipc_response(
        &webview,
        raw("storage_write_atomic", &not_opened, "a.log", &[1]),
    )
    .unwrap_err();
    assert!(error.to_string().contains("ROOT_NOT_OPEN"), "{error}");

    let root = open_root(&webview, dir.path());
    let error = get_ipc_response(
        &webview,
        raw("storage_append", &root, "../escape.log", &[1]),
    )
    .unwrap_err();
    assert!(error.to_string().contains("INVALID_PATH"), "{error}");
    assert!(!dir.path().parent().unwrap().join("escape.log").exists());
}

#[test]
fn слежение_сообщает_о_внешних_изменениях_в_папке_устройства() {
    let (app, webview) = app();
    let dir = tempfile::tempdir().unwrap();
    let root = open_root(&webview, dir.path());
    let (sender, receiver) = mpsc::channel::<String>();
    app.listen(super::watch::CHANGED_EVENT, move |event| {
        let _ = sender.send(event.payload().to_owned());
    });
    get_ipc_response(
        &webview,
        json("storage_watch", serde_json::json!({ "root": root })),
    )
    .unwrap();

    std::fs::create_dir_all(dir.path().join("data").join("phone")).unwrap();
    std::fs::write(dir.path().join("data").join("phone").join("b.log"), b"x").unwrap();

    let deadline = std::time::Instant::now() + Duration::from_secs(5);
    let mut seen = Vec::new();
    while std::time::Instant::now() < deadline {
        if let Ok(payload) = receiver.recv_timeout(Duration::from_millis(200)) {
            seen.push(payload.clone());
            // Событие — подсказка «здесь что-то изменилось»: о новой папке, созданной вместе с
            // файлом, ОС может сообщить без самого файла (наблюдение за ней подключается позже).
            // Поэтому слой данных по любому событию перечитывает папку устройства целиком.
            if payload.contains("data/phone") {
                return;
            }
        }
    }
    panic!("событие об изменении не пришло, получено: {seen:?}");
}

#[test]
fn слежение_сообщает_о_дописывании_в_существующий_файл() {
    let (app, webview) = app();
    let dir = tempfile::tempdir().unwrap();
    let log = dir.path().join("data").join("phone").join("b.log");
    std::fs::create_dir_all(log.parent().unwrap()).unwrap();
    std::fs::write(&log, b"x").unwrap();
    let root = open_root(&webview, dir.path());
    let (sender, receiver) = mpsc::channel::<String>();
    app.listen(super::watch::CHANGED_EVENT, move |event| {
        let _ = sender.send(event.payload().to_owned());
    });
    get_ipc_response(
        &webview,
        json("storage_watch", serde_json::json!({ "root": root })),
    )
    .unwrap();

    use std::io::Write;
    std::fs::OpenOptions::new()
        .append(true)
        .open(&log)
        .unwrap()
        .write_all(b"y")
        .unwrap();

    let deadline = std::time::Instant::now() + Duration::from_secs(5);
    while std::time::Instant::now() < deadline {
        if let Ok(payload) = receiver.recv_timeout(Duration::from_millis(200)) {
            if payload.contains("data/phone/b.log") {
                return;
            }
        }
    }
    panic!("событие о дописывании не пришло");
}
