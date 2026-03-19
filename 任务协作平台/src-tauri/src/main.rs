#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            window.set_title("任务协作平台").unwrap();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("启动失败");
}
