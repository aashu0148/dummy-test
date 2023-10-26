import express from "express";

import { authenticateUserMiddleware } from "../user/userMiddleware.js";
import {
  getAllTrades,
  getRecentAvailableStockData,
  getStockDataForTimeRange,
  getTodayTrades,
} from "./tradeServices.js";

const router = express.Router();

router.get(
  "/trade/recent-data",
  authenticateUserMiddleware,
  getRecentAvailableStockData
);
router.get("/trade/all", authenticateUserMiddleware, getAllTrades);
router.get("/trade/today", authenticateUserMiddleware, getTodayTrades);
router.get("/trade/data", authenticateUserMiddleware, getStockDataForTimeRange);

export default router;
