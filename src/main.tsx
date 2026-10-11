import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/bricolage-grotesque/wght.css";
import "./styles/tokens.css";
import "./styles/global.css";
import { App } from "./app/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
