import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { analyzeJob } from "./controllers/jobController.js"

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
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
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

// Job analysis endpoint
app.post("/api/analyze-job", analyzeJob)

// 404 catch-all
app.use((_req, res) => {
  res.status(404).json({ error: "Not Found" })
})

// ── Start ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ghstCandidate backend running`)
  console.log(`  http://localhost:${PORT}`)
  console.log(`  POST /api/analyze-job\n`)
})
