import React, { useState } from "react";
import Menu from "./menu.jsx";
import JoinModal from "./join.jsx";
import CreateModal from "./create.jsx";

function App() {
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleCreateRoom = () => setIsCreateOpen(true);
  const handleJoinRoom = () => setIsJoinOpen(true);
  const handleOpenPreferences = () => {};

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
      <Menu
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onOpenPreferences={handleOpenPreferences}
      />

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
    </>
  );
}

export default App;
