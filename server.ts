import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Mock Database
  let reports: any[] = [];

  // API Routes
  app.get("/api/reports", (req, res) => {
    res.json(reports);
  });

  app.post("/api/reports", (req, res) => {
    const newReport = {
      ...req.body,
      id: `CIV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      reportedAt: new Date().toISOString(),
      status: "reported"
    };
    reports.push(newReport);
    io.emit("new_report", newReport);
    res.status(201).json(newReport);
  });

  app.get("/api/stats", (req, res) => {
    res.json({
      totalToday: reports.length,
      resolvedToday: 124,
      avgResolutionTime: "2.3 days",
      activeWards: 272,
      moneySaved: 1245210
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  io.on("connection", (socket) => {
    console.log("Client connected");
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
