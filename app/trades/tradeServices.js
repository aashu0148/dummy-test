import { getAllStocksData } from "../../index.js";
import { bestStockPresets } from "../../util/constants.js";
import { createError, createResponse } from "../../util/util.js";
import tradeSchema from "./tradeSchema.js";

const getTodayTrades = async (req, res) => {
  const date = new Date().toLocaleDateString("en-in");

  const trades = await tradeSchema.find({ date });

  createResponse(res, trades);
};

const getBestStockPresets = async (req, res) => {
  createResponse(res, bestStockPresets);
};

const getRecentAvailableStockData = async (req, res) => {
  const data = req.stockData;
  if (typeof data?.data !== "object" || !Object.keys(data.data).length) {
    const newData = await getAllStocksData();

    if (typeof newData !== "object")
      return createError(res, "Stock data not available", 404);

    return createResponse(res, newData);
  }

  createResponse(res, req.stockData);
};

export { getTodayTrades, getBestStockPresets, getRecentAvailableStockData };
