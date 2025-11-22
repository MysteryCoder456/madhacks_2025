use iroh::EndpointAddr;
use iroh_tickets::Ticket;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct RoomTicket {
    pub topic_id: String,
    pub creator_addr: EndpointAddr,
}

impl Ticket for RoomTicket {
    const KIND: &'static str = "room";

    fn to_bytes(&self) -> Vec<u8> {
        postcard::to_stdvec(self).unwrap()
    }

    fn from_bytes(bytes: &[u8]) -> Result<Self, iroh_tickets::ParseError> {
        postcard::from_bytes(bytes).map_err(iroh_tickets::ParseError::from)
    }
}
