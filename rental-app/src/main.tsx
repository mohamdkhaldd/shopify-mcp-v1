import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Launcher from "./components/Launcher";
import { ThemeProvider } from "./theme";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      {/* MK-Tech opens this page on the activation / program chooser screen */}
      {new URLSearchParams(location.search).has("launcher") ? <Launcher /> : <App />}
    </ThemeProvider>
  </React.StrictMode>,
);
