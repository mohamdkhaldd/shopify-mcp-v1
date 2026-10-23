import React from "react";
import ReactDOM from "react-dom/client";
import "../src/index.css";
import { startBackend } from "./backend";

// Same screens as the laptop (src/), with window.api served by the in-app
// backend instead of Electron's main process.
const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "Cairo", color: "#64748b" }}>جاري تحميل البرنامج...</div>);

startBackend()
  .then(async (api) => {
    window.api = api;
    const [{ default: App }, { ThemeProvider }] = await Promise.all([import("../src/App"), import("../src/theme")]);
    root.render(
      <React.StrictMode>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </React.StrictMode>,
    );
  })
  .catch((err: unknown) =>
    root.render(<div style={{ padding: 24, fontFamily: "Cairo", direction: "rtl", color: "#be123c" }}>حصل خطأ وقت تشغيل البرنامج: {String((err as Error)?.message ?? err)}</div>),
  );
