import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";

// immediate: true بيخلي أي نسخة جديدة تتفعّل وتعمل reload للصفحة فورًا لما
// تتلاقي — بدل ما تفضل الصفحة شغالة بكود قديم لحد ما حد يقفلها ويفتحها من
// الأول (اللي كان بيسبب "التحديث نازل بس مش شغال" رغم إن الديبلوي نجح).
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
