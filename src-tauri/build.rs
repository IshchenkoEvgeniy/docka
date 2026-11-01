fn main() {
    tauri_build::build();
    // У lib-тестов нет ресурса окна Tauri, но rfd импортирует TaskDialogIndirect из comctl32 v6.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc")
    {
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTDEPENDENCY:type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'");
        // У приложения манифест уже находится в resource.lib от tauri_build — второй не нужен.
        println!("cargo:rustc-link-arg-bins=/MANIFEST:NO");
    }
}
