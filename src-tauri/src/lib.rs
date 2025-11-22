use std::str::FromStr;

use iroh::{protocol::Router, Endpoint};
use iroh_gossip::{Gossip, TopicId};
use iroh_tickets::Ticket;
use room_ticket::RoomTicket;
use tauri::{Manager, State};
use tokio::sync::RwLock;

mod room_ticket;

#[derive(Default)]
struct AppStateInner {
    endpoint: Option<Endpoint>,
    gossip: Option<Gossip>,
    router: Option<Router>,
    gossip_send: Option<iroh_gossip::api::GossipSender>,
    gossip_recv: Option<iroh_gossip::api::GossipReceiver>,
    username: Option<String>,
}
type AppState = RwLock<AppStateInner>;

// TODO: 6 digit codes

#[tauri::command]
async fn create_room(app_state: State<'_, AppState>, username: String) -> Result<String, String> {
    let mut app_state = app_state.write().await;

    // Create Iroh machinery
    let endpoint = Endpoint::builder()
        .bind()
        .await
        .map_err(|e| e.to_string())?;
    let gossip = Gossip::builder().spawn(endpoint.clone());
    let router = Router::builder(endpoint.clone())
        .accept(iroh_gossip::ALPN, gossip.clone())
        .spawn();

    // Generate a topic ID and join the topic
    let topic_id = {
        let mac_addr = mac_address::get_mac_address()
            .map_err(|e| e.to_string())?
            .ok_or("Device MAC address not found")?
            .to_string();
        mac_addr.replace(":", "")
    };
    let topic = gossip
        .subscribe_and_join(TopicId::from_str(&topic_id).unwrap(), vec![]) // doesn't need bootstrap peers
        .await
        .map_err(|e| e.to_string())?;
    let (sender, receiver) = topic.split();

    // Set state
    app_state.endpoint = Some(endpoint.clone());
    app_state.gossip = Some(gossip);
    app_state.router = Some(router);
    app_state.gossip_send = Some(sender);
    app_state.gossip_recv = Some(receiver);
    app_state.username = Some(username);

    let ticket = RoomTicket {
        topic_id: topic_id,
        creator_addr: endpoint.addr(),
    };
    Ok(ticket.serialize())
}

#[tauri::command]
async fn join_room(
    app_state: State<'_, AppState>,
    username: String,
    ticket: String,
) -> Result<(), String> {
    // Parse ticket
    let room_ticket = RoomTicket::deserialize(&ticket).map_err(|e| e.to_string())?;

    let mut app_state = app_state.write().await;

    // Create Iroh machinery
    let endpoint = Endpoint::builder()
        .bind()
        .await
        .map_err(|e| e.to_string())?;
    let gossip = Gossip::builder().spawn(endpoint.clone());
    let router = Router::builder(endpoint.clone())
        .accept(iroh_gossip::ALPN, gossip.clone())
        .spawn();

    // Join the topic
    let topic_id = room_ticket.topic_id;
    let topic = gossip
        .subscribe(
            TopicId::from_str(&topic_id).unwrap(),
            vec![room_ticket.creator_addr.id],
        )
        .await
        .map_err(|e| e.to_string())?;
    let (sender, receiver) = topic.split();

    // Set state
    app_state.endpoint = Some(endpoint.clone());
    app_state.gossip = Some(gossip);
    app_state.router = Some(router);
    app_state.gossip_send = Some(sender);
    app_state.gossip_recv = Some(receiver);
    app_state.username = Some(username);

    Ok(())
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
