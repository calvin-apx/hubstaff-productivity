// Entry point: Express API + (after `npm run build`) the React app as static files.
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { config, ROOT_DIR } from "./config.js";
import { router, evaluateDate } from "./routes.js";
import { startScheduler } from "./notify.js";

const app = express();
app.use(express.json());
app.use("/api", router);

// One process serves everything once the client is built. In dev, Vite serves the UI instead.
const clientDist = path.join(ROOT_DIR, "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("/{*splat}", (req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

app.listen(config.port, () => {
  console.log(`Hubstaff Productivity API: http://localhost:${config.port}`);
  console.log(fs.existsSync(clientDist) ? "Serving built UI from client/dist" : "UI not built: use `npm run dev` or `npm run build`");
  console.log(config.hubstaff.pat ? "HUBSTAFF_PAT loaded" : "WARNING: HUBSTAFF_PAT is empty. Copy .env.example to .env");
  startScheduler(evaluateDate);
});
