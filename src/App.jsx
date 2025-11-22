import Menu from "./menu.jsx";

function App() {
  return (
    <Menu
      onCreateRoom={() => console.log("Create Room")}
      onJoinRoom={() => console.log("Join Room")}
      onOpenPreferences={() => console.log("Preferences")}
    />
  );
}

export default App;