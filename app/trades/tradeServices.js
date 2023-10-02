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
  const allStocks = await stocksSchema.find({});
  const symbols = allStocks.map((item) => item.symbol);
  const data = req.stockData;

  if (
    typeof data?.data !== "object" ||
    !Object.keys(data.data).length ||
    Object.keys(data.data).length !== symbols.length
  ) {
    const newData = await getAllStocksData(symbols);

    if (typeof newData !== "object")
      return createError(res, "Stock data not available", 404);

    if (req.updateStockData) req.updateStockData(newData);
    return createResponse(res, newData);
  }

  createResponse(res, data?.data);
};

export { getTodayTrades, getRecentAvailableStockData };
