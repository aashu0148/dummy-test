import express from "express";

import { authenticateUserMiddleware } from "../user/userMiddleware.js";
import {
  getBestStockPresets,
  getRecentAvailableStockData,
  getTodayTrades,
} from "./tradeServices.js";

const router = express.Router();

router.get(
  "/trade/recent-data",
  authenticateUserMiddleware,
  getRecentAvailableStockData
);
router.get("/trade/today", authenticateUserMiddleware, getTodayTrades);
router.get("/trade/preset", authenticateUserMiddleware, getBestStockPresets);

export default router;
