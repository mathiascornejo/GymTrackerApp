import { StrictMode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/bricolage-grotesque/wght.css";
import "./styles/tokens.css";
import "./styles/global.css";
import { App } from "./app/App";
import { queryClient } from "./data/queryClient";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
