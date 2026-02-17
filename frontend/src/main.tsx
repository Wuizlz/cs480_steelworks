/**
 * Frontend application entry point.
 *
 * Bootstraps the React app and mounts it to the DOM.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// Locate the root element provided by index.html.
const rootElement = document.getElementById("root");

if (!rootElement) {
  // Fail fast if the root element is missing.
  throw new Error("Root element #root was not found in index.html");
}

// Create the React root (React 18 API).
const root = createRoot(rootElement);

// Render the application once into the root.
// Time complexity: O(1) for the initial mount (render cost depends on React).
// Space complexity: O(1) for storing the root reference.
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
