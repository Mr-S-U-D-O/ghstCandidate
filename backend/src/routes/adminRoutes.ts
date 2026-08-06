import { Router } from "express"
import { isAdmin, getFleetConfigs, createFleetConfig, updateFleetConfig, deleteFleetConfig, triggerHarvester, streamFleetLogs } from "../controllers/adminController.js"

const router = Router()

// SSE Stream endpoint - no isAdmin middleware because EventSource in browser cannot send headers easily
router.get("/fleet-logs-stream", streamFleetLogs)

// All routes under /api/admin are protected by isAdmin middleware
router.use(isAdmin)

router.get("/fleet", getFleetConfigs)
router.post("/fleet", createFleetConfig)
router.put("/fleet/:id", updateFleetConfig)
router.delete("/fleet/:id", deleteFleetConfig)
router.post("/trigger-harvester", triggerHarvester)

export default router
