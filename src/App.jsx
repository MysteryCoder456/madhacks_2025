import Menu from "./menu.jsx";

function App() {
  const handleCreateRoom = () => {
    console.log("Create Room clicked");
    // TODO: set jsx file for creating room
  };

  const handleJoinRoom = () => {
    console.log("Join Room clicked");
    // TODO: set jsx file for joining room
  };

  const handleOpenPreferences = () => {
    console.log("Preferences clicked");
    // TODO: set a preferences page
  };

  return (
    <Menu
      onCreateRoom={handleCreateRoom}
      onJoinRoom={handleJoinRoom}
      onOpenPreferences={handleOpenPreferences}
    />
  );
}

export default App;