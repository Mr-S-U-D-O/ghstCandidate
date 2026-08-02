import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { analyzeJob, applyJob, huntJobs, seedHarvester } from "./controllers/jobController.js"
import { parseCv } from "./controllers/cvController.js"
import { chatProfiler } from "./controllers/chatController.js"
import { runAgent } from "./controllers/agentController.js"
import { deleteAccount } from "./controllers/userController.js"
import { joinWaitlist } from "./controllers/waitlistController.js"

// ── Load .env before anything else ────────────────────────────────
dotenv.config()

const app = express()
const PORT = Number(process.env.PORT ?? 3001)

// ── Middleware ─────────────────────────────────────────────────────
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
  ],
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}))
app.use(express.json({ limit: "2mb" }))

// ── Routes ─────────────────────────────────────────────────────────

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "ghstCandidate-backend",
    timestamp: new Date().toISOString()
  })
})

// Job endpoints
app.post("/api/analyze-job", analyzeJob)
app.post("/api/apply-job", applyJob)
app.post("/api/hunt-jobs", huntJobs)
app.post("/api/seed-harvester", seedHarvester)
app.post("/api/parse-cv", parseCv)
app.post("/api/chat-profiler", chatProfiler)
app.post("/api/run-agent", runAgent)
app.delete("/api/user/account", deleteAccount)
app.post("/api/waitlist", joinWaitlist)

// 404 catch-all
app.use((_req, res) => {
  res.status(404).json({ error: "Not Found" })
})

import { initCron } from "./cron.js"

// ── Start ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ghstCandidate backend running`)
  console.log(`  http://localhost:${PORT}`)
  console.log(`  POST /api/analyze-job\n`)
  initCron()
})
