import { getAllStocksData } from "../../index.js";
import { createError, createResponse } from "../../util/util.js";
import stocksSchema from "../stocks/stocksSchema.js";
import tradeSchema from "./tradeSchema.js";

const updateTrade = async (req, res) => {
  const { id: tradeId } = req.params;
  const { isApproved, target, sl, startPrice, type } = req.body;

  if (
    isApproved == undefined ||
    !startPrice ||
    !type ||
    !target ||
    !sl ||
    isNaN(target) ||
    isNaN(sl)
  )
    return createError(
      res,
      "All fields are required: isApproved, startPrice, target, type, sl",
      400
    );

  const trade = await tradeSchema.findOne({ _id: tradeId });
  if (!trade) return createError(res, "Trade not present in database", 404);

  const timeDiff = Date.now() - trade.createdAt.getTime();
  if (timeDiff > 5 * 60 * 1000)
    return createError(res, `Can't update the trade after 5 mins`, 400);

  await tradeSchema.updateOne(
    { _id: tradeId },
    { $set: { isApproved, target, sl, startPrice, type } }
  );

  createResponse(res, { message: "update commpleted" });
};

const getTodayTrades = async (req, res) => {
  const isYesterday = req.query?.day == "yesterday";

  const date = isYesterday
    ? new Date(Date.now() - 24 * 60 * 60 * 1000)
    : new Date();
  const dateStr = date.toLocaleDateString("en-in");

  const trades = await tradeSchema.find({ date: dateStr });

  createResponse(res, trades);
};

const getAllTrades = async (req, res) => {
  const trades = await tradeSchema.find({});

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
    const newData = await getAllStocksData(symbols, date, [5]);

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

  const newData = await getAllStocksData(symbols, from, to, [5]);

  if (!newData || typeof newData !== "object")
    return createError(res, "Stock data not available", 404);

  createResponse(res, newData);
};

export {
  getTodayTrades,
  getRecentAvailableStockData,
  getStockDataForTimeRange,
  getAllTrades,
  updateTrade,
};
