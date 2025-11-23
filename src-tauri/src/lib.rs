#[macro_use]
extern crate dotenv_codegen;

use std::time::Duration;

use blake3::hash;
use futures_lite::StreamExt;
use iroh::{protocol::Router, Endpoint};
use iroh_gossip::{
    api::{Event, GossipReceiver, GossipSender},
    Gossip, TopicId,
};
use iroh_tickets::Ticket;
use room_ticket::RoomTicket;
use sqlx::{prelude::*, PgConnection};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::RwLock;

mod room_ticket;

const ME_PERIOD: Duration = Duration::from_secs(2);

#[derive(Default)]
struct AppStateInner {
    endpoint: Option<Endpoint>,
    gossip: Option<Gossip>,
    router: Option<Router>,
    gossip_send: Option<GossipSender>,
    username: Option<String>,
}
type AppState = RwLock<AppStateInner>;

#[tauri::command]
async fn create_room(
    app_handle: AppHandle,
    app_state: State<'_, AppState>,
    username: String,
) -> Result<String, String> {
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
        mac_addr
    };
    let topic = gossip
        .subscribe(
            TopicId::from_bytes(*hash(topic_id.as_bytes()).as_bytes()),
            vec![],
        ) // doesn't need bootstrap peers
        .await
        .map_err(|e| e.to_string())?;
    let ticket = RoomTicket {
        topic_id: topic_id,
        current_peers: vec![endpoint.addr()],
    };
    let ticket_str = ticket.serialize();

    let mut conn = PgConnection::connect(dotenv!("DATABASE_URL"))
        .await
        .map_err(|e| e.to_string())?;

    // Find a unique 6-digit join code
    let join_code = loop {
        let candidate_join_code = format!("{:06}", rand::random::<u32>() % 1_000_000);

        let existing_join_code = sqlx::query!(
            "SELECT * FROM join_codes WHERE code = $1",
            &candidate_join_code
        )
        .fetch_optional(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

        if existing_join_code.is_none() {
            break candidate_join_code;
        }
    };

    // Map the join code to ticket
    sqlx::query!(
        "INSERT INTO join_codes VALUES ($1, $2)",
        &join_code,
        &ticket_str
    )
    .execute(&mut conn)
    .await
    .map_err(|e| e.to_string())?;

    let (sender, receiver) = topic.split();

    // Set state
    app_state.endpoint = Some(endpoint.clone());
    app_state.gossip = Some(gossip);
    app_state.router = Some(router);
    app_state.gossip_send = Some(sender.clone());
    app_state.username = Some(username);

    tokio::spawn(periodic_me_loop(app_handle.clone(), sender));
    tokio::spawn(receiver_loop(app_handle.clone(), receiver));

    Ok(join_code)
}

#[tauri::command]
async fn join_room(
    app_handle: AppHandle,
    app_state: State<'_, AppState>,
    username: String,
    join_code: String,
) -> Result<(), String> {
    let mut app_state = app_state.write().await;
    let mut conn = PgConnection::connect(dotenv!("DATABASE_URL"))
        .await
        .map_err(|e| e.to_string())?;

    // Fetch and parse ticket from join code
    let ticket = {
        let code_row = sqlx::query!("SELECT ticket FROM join_codes where code = $1", &join_code)
            .fetch_optional(&mut conn)
            .await
            .map_err(|e| e.to_string())?
            .ok_or("Given join code doesn't exist")?;

        RoomTicket::deserialize(&code_row.ticket).map_err(|e| e.to_string())?
    };

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
    let topic_id = &ticket.topic_id;
    let topic = gossip
        .subscribe(
            TopicId::from_bytes(*hash(topic_id.as_bytes()).as_bytes()),
            ticket.current_peers.iter().map(|addr| addr.id).collect(),
        )
        .await
        .map_err(|e| e.to_string())?;
    let (sender, receiver) = topic.split();

    // Update remote ticket with current endpoint address
    let mut new_ticket = ticket.clone();
    new_ticket.current_peers.push(endpoint.addr());
    let serialized_new_ticket = new_ticket.serialize();
    sqlx::query!(
        "UPDATE join_codes SET ticket = $1 WHERE code = $2",
        serialized_new_ticket,
        join_code
    )
    .execute(&mut conn)
    .await
    .map_err(|e| e.to_string())?;

    // Set state
    app_state.endpoint = Some(endpoint.clone());
    app_state.gossip = Some(gossip);
    app_state.router = Some(router);
    app_state.gossip_send = Some(sender.clone());
    app_state.username = Some(username);

    tokio::spawn(periodic_me_loop(app_handle.clone(), sender));
    tokio::spawn(receiver_loop(app_handle.clone(), receiver));

    Ok(())
}

#[tauri::command]
async fn send_message(app_state: State<'_, AppState>, message: String) -> Result<(), String> {
    let app_state = app_state.read().await;

    let sender = app_state
        .gossip_send
        .as_ref()
        .ok_or("Gossip sender is not initialized")?;
    sender
        .broadcast(message.into_bytes().into())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn leave_room(app_state: State<'_, AppState>, join_code: String) -> Result<(), String> {
    let mut app_state = app_state.write().await;

    let endpoint_addr = app_state
        .endpoint
        .clone()
        .ok_or("Endpoint not initialized")?
        .addr();
    if let Some(ref router) = app_state.router {
        // Also shuts down protocols and the endpoint
        router.shutdown().await.map_err(|e| e.to_string())?;
    }

    // Clear Iroh machinery
    app_state.endpoint = None;
    app_state.gossip = None;
    app_state.router = None;
    app_state.gossip_send = None;
    app_state.username = None;

    let mut conn = PgConnection::connect(dotenv!("DATABASE_URL"))
        .await
        .map_err(|e| e.to_string())?;

    // Fetch the current ticket for this join code
    let record = sqlx::query!("SELECT ticket FROM join_codes WHERE code = $1", &join_code)
        .fetch_one(&mut conn)
        .await
        .map_err(|e| e.to_string())?;
    let mut ticket = RoomTicket::deserialize(&record.ticket).map_err(|e| e.to_string())?;
    ticket.current_peers.retain(|a| a.id != endpoint_addr.id);

    if ticket.current_peers.is_empty() {
        // Remove the remote ticket
        sqlx::query!("DELETE FROM join_codes WHERE code = $1", join_code)
            .execute(&mut conn)
            .await
            .map_err(|e| e.to_string())?;
    } else {
        // Update the remote ticket
        let serialized_new_ticket = ticket.serialize();
        sqlx::query!(
            "UPDATE join_codes SET ticket = $1 WHERE code = $2",
            serialized_new_ticket,
            join_code
        )
        .execute(&mut conn)
        .await
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

async fn periodic_me_loop(app_handle: AppHandle, send: GossipSender) -> anyhow::Result<()> {
    let (username, endpoint_addr) = {
        let app_state = app_handle.state::<AppState>();
        let app_state = app_state.read().await;

        let username = app_state.username.clone();
        let endpoint_addr = app_state.endpoint.clone().map(|e| e.addr());

        (username, endpoint_addr)
    };

    if let Some((username, addr)) = username.zip(endpoint_addr) {
        loop {
            // Create a stingified json message with our username and endpoint address
            let me_message = serde_json::json!({
                "me": {
                    "username": username,
                    "endpoint_addr": addr
                }
            })
            .to_string();

            // Broadcast the 'me' message
            if let Err(err) = send.broadcast(me_message.into_bytes().into()).await {
                eprintln!("Failed to broadcast 'me' message: {}", err);
                break Err(anyhow::anyhow!(err));
            }

            // Sleep
            tokio::time::sleep(ME_PERIOD).await;
        }
    } else {
        Err(anyhow::anyhow!(
            "Username or endpoint address not initialized"
        ))
    }
}

async fn receiver_loop(app_handle: AppHandle, mut recv: GossipReceiver) -> anyhow::Result<()> {
    // Wait for at least one peer to connect
    recv.joined().await?;

    while let Some(event) = recv.try_next().await? {
        match event {
            Event::Received(message) => {
                let message_content = String::from_utf8(message.content.to_vec());
                if let Err(err) = message_content {
                    eprintln!("Failed to decode message: {}", err);
                    continue;
                }
                let message_content = message_content.unwrap();

                if let Err(err) = app_handle.emit("message-received", message_content) {
                    eprintln!("Failed to send received message to UI: {}", err);
                    continue;
                }
            }
            Event::Lagged => println!("Lagged event received"),
            _ => {}
        }
    }

    println!("Exited receiver loop");
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenv::dotenv().ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            let app_state = AppStateInner::default();
            app.manage(RwLock::new(app_state));
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            create_room,
            join_room,
            send_message,
            leave_room,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
