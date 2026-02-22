import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import "./index.css";

// Global error handlers to prevent page refreshes
window.addEventListener('error', (event) => {
  console.error('[Global Error Handler]', event.error);
  // Prevent default behavior (page refresh)
  event.preventDefault();
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason);
  // Prevent default behavior (page refresh)
  event.preventDefault();
});

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <App />
  </ThemeProvider>
)
