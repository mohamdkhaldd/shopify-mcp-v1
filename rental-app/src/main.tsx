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

// خانات الأرقام: المتصفح من غير step بيقبل أرقام صحيحة بس (١٫٥٠ يطلع "قيمة مش صالحة").
// أي خانة رقم في البرنامج بتقبل كسور (قروش) — بنحط step="any" على كل واحدة تظهر.
if (typeof document !== "undefined") {
  const allowDecimals = (root: ParentNode) =>
    root.querySelectorAll?.("input[type=number]:not([step])").forEach((el) => el.setAttribute("step", "any"));
  allowDecimals(document);
  new MutationObserver(() => allowDecimals(document)).observe(document.documentElement, { childList: true, subtree: true });
}

