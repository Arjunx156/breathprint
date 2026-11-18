import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { AppProvider } from "./app/state";
import { workerUrl } from "./lib/trusted";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root");

// Keeps a copy of the app for when the network drops; dev builds skip it so edits show at once.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  addEventListener("load", () => {
    navigator.serviceWorker.register(workerUrl()).catch(() => {
      // No offline copy this visit; online, the app works the same.
    });
  });
}

createRoot(root).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
