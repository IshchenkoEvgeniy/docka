// В релизе на Windows не открывать консольное окно рядом с приложением.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    doska_lib::run()
}
