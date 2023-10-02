import express from "express";

import { authenticateUserMiddleware } from "../user/userMiddleware.js";
import {
  addNewStock,
  deleteStock,
  getAvailableStocks,
} from "./stocksServices.js";

const router = express.Router();

router.get("/stock/all", authenticateUserMiddleware, getAvailableStocks);
router.post("/stock", authenticateUserMiddleware, addNewStock);
router.delete("/stock/:symbol", authenticateUserMiddleware, deleteStock);

export default router;
