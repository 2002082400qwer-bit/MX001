// Windows 发布版本隐藏额外控制台窗口，避免向最终用户显示命令行窗口。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/** 桌面程序入口，委托库模块创建 Tauri 应用。 */
fn main() {
  app_lib::run();
}
