import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// Self-hosted variable Inter (font-display: swap; only the needed unicode subsets download)
import "@fontsource-variable/inter";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
