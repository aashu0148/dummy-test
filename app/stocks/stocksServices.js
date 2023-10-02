import axios from "axios";
import { createError, createResponse } from "../../util/util.js";
import stocksSchema from "./stocksSchema.js";

const getAvailableStocks = async (req, res) => {
  const stocks = await stocksSchema.find({});

  createResponse(res, stocks);
};

const getStockPastData = async (symbol) => {
  if (!symbol) return null;

  const time = parseInt(new Date().getTime() / 1000);

  const url = `https://priceapi.moneycontrol.com/techCharts/indianMarket/stock/history?symbol=${symbol}&resolution=5&to=${time}&countback=2000&currencyCode=INR`;

  const res = await axios
    .get(url)
    .catch((err) => console.log("🔴 ERROR making req", err.message));

  if (res?.data?.s !== "ok") return null;

  return res.data;
};

const addNewStock = async (req, res) => {
  const { symbol } = req.body;

  if (!symbol) return createError(res, "symbol required");

  const stock = await stocksSchema.findOne({ symbol });
  if (stock) return createError(res, "Stock already present", 400);

  const data = await getStockPastData(symbol);
  if (!data)
    return createError(res, "Error validating symbol, please try again");

  const newStock = new stocksSchema({
    symbol,
  });

  newStock
    .save()
    .then((s) => createResponse(res, s, 201))
    .catch((err) => createError(res, err.message || "Error adding stock", 500));
};

const deleteStock = async (req, res) => {
  const { symbol } = req.params;

  if (!symbol) return createError(res, "symbol required");

  const stock = await stocksSchema.findOne({ symbol });
  if (!stock) return createError(res, `${symbol} not found to delete`);

  await stocksSchema.deleteOne({ symbol }).exec();

  createResponse(res, { message: "deleted" }, 200);
};

export { getAvailableStocks, deleteStock, addNewStock };
