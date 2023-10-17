import { getAllStocksData } from "../../index.js";
import { createError, createResponse } from "../../util/util.js";
import stocksSchema from "../stocks/stocksSchema.js";
import tradeSchema from "./tradeSchema.js";

const getTodayTrades = async (req, res) => {
  const date = new Date().toLocaleDateString("en-in");

  const trades = await tradeSchema.find({ date });

  createResponse(res, trades);
};

const getRecentAvailableStockData = async (req, res) => {
  const { timestamp } = req.query;
  const allStocks = await stocksSchema.find({});
  const symbols = allStocks.map((item) => item.symbol);
  const data = req.recentlyFetchedData;

  if (
    !isNaN(timestamp) ||
    typeof data !== "object" ||
    !Object.keys(data).length ||
    Object.keys(data).length !== symbols.length
  ) {
    const date = isNaN(timestamp) ? Date.now() : timestamp;
    const newData = await getAllStocksData(symbols, date, [5, 15]);

    if (typeof newData !== "object")
      return createError(res, "Stock data not available", 404);

    if (isNaN(timestamp)) {
      if (req.updateStockData) req.updateStockData(newData);
    }

    return createResponse(res, newData);
  }

  createResponse(res, data);
};

const getStockDataForTimeRange = async (req, res) => {
  const { from, to } = req.query;
  const allStocks = await stocksSchema.find({});
  const symbols = allStocks.map((item) => item.symbol);
  const data = req.recentlyFetchedData;
  if (isNaN(to)) return createError(res, "'to' required");

  const newData = await getAllStocksData(symbols, from, to, [5, 15]);

  if (!newData || typeof newData !== "object")
    return createError(res, "Stock data not available", 404);

  createResponse(res, newData);
};

export {
  getTodayTrades,
  getRecentAvailableStockData,
  getStockDataForTimeRange,
};
