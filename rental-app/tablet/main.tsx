import React from "react";
import ReactDOM from "react-dom/client";
import { startBackend } from "./backend";

// MK-Tech on the tablet / web: the same screens as the laptop — التأجير
// (src/) or التشغيل (operations/src/), or the activation / chooser page —
// with window.api served by the in-app backend instead of Electron.
const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "Cairo", color: "#64748b" }}>جاري تحميل البرنامج...</div>);

startBackend()
  .then(async ({ page, api }) => {
    window.api = api;
    // each program brings only its own styles
    if (page === "operations") {
      const [{ default: App }, { ThemeProvider }, { BrandProvider }] = await Promise.all([
        import("../operations/src/App"),
        import("../operations/src/theme"),
        import("../operations/src/brand"),
        import("../operations/src/index.css"),
      ]);
      document.title = "MK-Tech التشغيل";
      root.render(
        <React.StrictMode>
          <ThemeProvider>
            <BrandProvider>
              <App />
            </BrandProvider>
          </ThemeProvider>
        </React.StrictMode>,
      );
      return;
    }
    const [{ default: App }, { default: Launcher }, { ThemeProvider }] = await Promise.all([
      import("../src/App"),
      import("../src/components/Launcher"),
      import("../src/theme"),
      import("../src/index.css"),
    ]);
    root.render(
      <React.StrictMode>
        <ThemeProvider>{page === "launcher" ? <Launcher /> : <App />}</ThemeProvider>
      </React.StrictMode>,
    );
  })
  .catch((err: unknown) =>
    root.render(<div style={{ padding: 24, fontFamily: "Cairo", direction: "rtl", color: "#be123c" }}>حصل خطأ وقت تشغيل البرنامج: {String((err as Error)?.message ?? err)}</div>),
  );
