use iroh::{protocol::Router, Endpoint};
use tauri::{Manager, State};
use tokio::sync::RwLock;

#[derive(Default)]
struct AppStateInner {
    endpoint: Option<Endpoint>,
    router: Option<Router>,
}
type AppState = RwLock<AppStateInner>;

#[tauri::command]
async fn create_room(app_state: State<'_, AppState>) -> Result<(), String> {
    let mut app_state = app_state.write().await;

    let endpoint = Endpoint::builder()
        .bind()
        .await
        .map_err(|e| e.to_string())?;
    let router = Router::builder(endpoint.clone()).spawn();

    // TODO: bind protocols

    app_state.endpoint = Some(endpoint);
    app_state.router = Some(router);
    Ok(())
}

#[tauri::command]
async fn join_room(app_state: State<'_, AppState>, ticket: String) -> Result<(), String> {
    // TODO: join room
    todo!()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_state = AppStateInner::default();
            app.manage(RwLock::new(app_state));
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![create_room, join_room])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
