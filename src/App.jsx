import React, { useState } from "react";
import Menu from "./menu.jsx";
import JoinModal from "./join.jsx";
import CreateModal from "./create.jsx";
import Whiteboard from "./Whiteboard.jsx";

function App() {
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false); // ✅ NEW

  const handleCreateRoom = () => setIsCreateOpen(true);
  const handleJoinRoom = () => setIsJoinOpen(true);

  // ✅ same style as other handlers
  const handleOpenPreferences = () => setIsWhiteboardOpen(true);

  const handleJoinSubmit = (roomCode, name) => {
    console.log("Join with:", roomCode, name);
    setIsJoinOpen(false);
  };

  const handleCreateSubmit = (name) => {
    console.log("Create room with:", name);
    setIsCreateOpen(false);
  };

  return (
    <>
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

      {/* ✅ Attach the whiteboard exactly like you requested */}
      {isWhiteboardOpen && <Whiteboard />}
    </>
  );
}

export default App;
