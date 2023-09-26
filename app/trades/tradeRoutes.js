import express from "express";

import { authenticateUserMiddleware } from "../user/userMiddleware.js";
import { getTodayTrades } from "./tradeServices.js";

const router = express.Router();

router.get("/trade/today", authenticateUserMiddleware, getTodayTrades);

export default router;
