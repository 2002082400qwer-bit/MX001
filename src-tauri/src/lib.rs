#[cfg_attr(mobile, tauri::mobile_entry_point)]
/** 启动桌面应用，不注册自定义命令或额外插件。 */
pub fn run() {
  tauri::Builder::default()
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
