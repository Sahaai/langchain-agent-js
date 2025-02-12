import express from "express";
import { createServer } from "http";
import { Socket, Server as SocketIOServer } from "socket.io";
//import browserRoutes from "./routes/browser.js";
import agentRoutes from "./routes/agent.js";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import jwt, { JwtPayload } from "jsonwebtoken";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://www.sahaaai.com",
      "https://sahaaai.com",
    ],
  },
});

const PORT = process.env.PORT || 8005;
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://www.sahaaai.com",
      "https://sahaaai.com",
    ], // Frontend origin
    methods: ["GET", "POST"],
  })
);

// Middleware
app.use(express.json());

app.use(bodyParser.json());
// Get the current file path
const __filename = fileURLToPath(import.meta.url);

// Get the directory name of the current file
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "images")));

// Routes
//app.use("/api/browser", browserRoutes);
app.use("/api/agent", agentRoutes);


// Start the server
httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
