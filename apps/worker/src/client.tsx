import "./styles.css";

import { createRoot } from "react-dom/client";

import App from "./app";

document.documentElement.dataset.viewTransitions =
  "startViewTransition" in document ? "native" : "fallback";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
