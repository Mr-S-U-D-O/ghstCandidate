import express from 'express'

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ghstCandidate-backend' })
})

app.listen(PORT, () => {
  console.log(`ghstCandidate backend running on http://localhost:${PORT}`)
})
