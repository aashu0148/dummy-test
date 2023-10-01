import express from "express";

import { authenticateUserMiddleware } from "../user/userMiddleware.js";
import { createNewPreset, getBestPresets } from "./presetServices.js";

const router = express.Router();

router.get("/preset/all", authenticateUserMiddleware, getBestPresets);
router.post("/preset", authenticateUserMiddleware, createNewPreset);

export default router;
