import express from "express";

import { authenticateUserMiddleware } from "../user/userMiddleware.js";
import { createNewPreset, getBestPresets, runFunc } from "./presetServices.js";

const router = express.Router();

router.get("/preset/all", authenticateUserMiddleware, getBestPresets);
router.post("/preset", authenticateUserMiddleware, createNewPreset);
// router.get("/preset/run", runFunc);

export default router;
