import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import AppErrorBoundary from "./app/AppErrorBoundary";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root が無い");

createRoot(root).render(
  <AppErrorBoundary>
    <StrictMode>
      <App />
    </StrictMode>
  </AppErrorBoundary>,
);
