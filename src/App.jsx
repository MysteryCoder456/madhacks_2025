import React, { useState } from "react";
import Menu from "./menu.jsx";
import JoinModal from "./join.jsx";
import CreateModal from "./create.jsx";
import Whiteboard from "./Whiteboard.jsx";
import { Toaster } from "react-hot-toast";

function App() {
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);

  const [currentRoomCode, setCurrentRoomCode] = useState(null);
  const[currentUsername, setCurrentUsername] = useState(null);

  const handleCreateRoom = () => setIsCreateOpen(true);
  const handleJoinRoom = () => setIsJoinOpen(true);

  const handleOpenPreferences = () => setIsWhiteboardOpen(true);

  const handleJoinSubmit = (roomCode, name) => {
    console.log("Join with:", roomCode, name);
    setIsJoinOpen(false);
    setCurrentRoomCode(roomCode);
    setCurrentUsername(name);
    setIsWhiteboardOpen(true);
  };

  const handleCreateSubmit = (joinCode, username) => {
    console.log("Create room with:", joinCode, "by", username);
    setIsCreateOpen(false);
    setCurrentRoomCode(joinCode);
    setCurrentUsername(username)
    setIsWhiteboardOpen(true);
  };

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#0f172a",
            color: "#f8fafc",
            border: "1px solid #334155",
          },
          success: {
            iconTheme: { primary: "#22c55e", secondary: "white" },
          },
          error: {
            iconTheme: { primary: "#ef4444", secondary: "white" },
          },
        }}
      />
      {!isWhiteboardOpen && (
        <Menu
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onOpenPreferences={handleOpenPreferences}
        />
      )}

      <JoinModal
        open={isJoinOpen}
        onClose={() => setIsJoinOpen(false)}
        onJoin={handleJoinSubmit}
      />

      <CreateModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateSubmit}
      />

      {isWhiteboardOpen && <Whiteboard 
      roomCode={currentRoomCode}
      username={currentUsername}
       />}
    </>
  );
}

export default App;
