import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { Server as socketServer } from "socket.io";
import http from "http";
import dotenv from "dotenv";
dotenv.config();

import tradeSchema from "./app/trades/tradeSchema.js";
import tradeRoutes from "./app/trades/tradeRoutes.js";
import SocketEvents from "./app/socket/events.js";
import userRoutes from "./app/user/userRoutes.js";
import axios from "axios";
import { takeTrades } from "./util/tradeUtil.js";

const app = express();
const server = http.createServer(app);
const io = new socketServer(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(tradeRoutes);
app.use(userRoutes);
app.get("/hi", (_req, res) => res.send("Hello there buddy!"));

const availableStocks = {
  tataMotors: "TATAMOTORS",
  tataSteel: "TATASTEEL",
  itc: "ITC",
  indusIndBank: "INDUSINDBK",
  hdfcLife: "HDFCLIFE",
  reliance: "RELIANCE",
  hclTech: "HCLTECH",
  sbi: "SBIN",
  kfinTech: "KFINTECH",
  laOplaRG: "LAOPALA",
  latentView: "LATENTVIEW",
  miraeamcMamfgetf: "MAKEINDIA",
  LAURUSLABS: "LAURUSLABS",
  KOTAKBKETF: "KOTAKBKETF",
  SHOPERSTOP: "SHOPERSTOP",
  ICICIM150: "ICICIM150",
  TATACONSUM: "TATACONSUM",
  SHYAMMETL: "SHYAMMETL",
  TVSMOTOR: "TVSMOTOR",
  LICHSGFIN: "LICHSGFIN",
  COALINDIA: "COALINDIA",
  BPCL: "BPCL",
  MAZDOCK: "MAZDOCK",
  PARAS: "PARAS",
};
const stockData = {
  date: "",
  data: {},
};
const bestStockPresets = {
  ...Object.values(availableStocks).reduce((acc, curr) => {
    acc[curr] = {};
    return acc;
  }, {}),
  [availableStocks.tataMotors]: {
    cciPeriod: 20,
    vPointOffset: 9,
    stochasticPeriod: 14,
    stochasticMA: 3,
    stochasticHigh: 83,
    stochasticLow: 23,
    bollingerBandPeriod: 23,
    bollingerBandStdDev: 4,
  },
  [availableStocks.tataSteel]: {},
  [availableStocks.itc]: {},
};
let lastTradesTaken = "";

const getStockPastData = async (symbol, to) => {
  if (!to) return null;
  const time = parseInt(new Date(to).getTime() / 1000);

  const url = `https://priceapi.moneycontrol.com/techCharts/indianMarket/stock/history?symbol=${symbol}&resolution=5&to=${time}&countback=4000&currencyCode=INR`;

  const res = await axios.get(url);

  if (res.data.s !== "ok") return null;

  return res.data;
};

const getCurrentStockData = async (symbol, from) => {
  if (!from) return null;
  const timeFrom = parseInt(new Date(from).getTime() / 1000);
  const timeTo = parseInt(new Date().getTime() / 1000);

  const url = `https://priceapi.moneycontrol.com/techCharts/intra?symbol=${symbol}&resolution=5&from=${timeFrom}&to=${timeTo}&currencyCode=INR`;

  const res = await axios.get(url);

  console.log(url, res.data);
  if (res.data.s !== "ok") return null;

  return res.data;
};

const checkForGoodTrade = async () => {
  const currentTimeString = new Date().toLocaleTimeString("en-in", {
    timeZone: "Asia/Kolkata",
    hour12: false,
  });
  const [hour, min, sec] = currentTimeString
    .split(":")
    .map((item) => parseInt(item));

  // returning if not in market hours
  if (
    hour < 9 ||
    hour > 16 ||
    (hour == 9 && min < 15) ||
    (hour == 15 && min > 28)
  )
    return;

  let latestDataNotPresent = false;
  if (!stockData.date) latestDataNotPresent = true;
  else if (new Date(stockData.date) < new Date()) latestDataNotPresent = true;

  const currentDate = new Date();
  const todayStartTime = new Date(
    `${currentDate.getFullYear()}/${
      currentDate.getMonth() + 1
    }/${currentDate.getDate()}`
  ).getTime();
  const stockSymbols = Object.values(availableStocks);

  // if (latestDataNotPresent) {
  const responses = await Promise.all(
    stockSymbols.map((item) => getStockPastData(item, Date.now()))
  );

  const data = {};
  stockSymbols.forEach((item, i) => {
    data[item] = responses[i] || {
      s: "no",
      c: [],
      t: [],
      v: [],
      l: [],
      o: [],
      h: [],
    };
  });

  stockData.data = data;
  stockData.date = Date.now();
  // stockData.date = new Date(todayStartTime + 24 * 60 * 60 * 1000);
  // }

  console.log(
    "⏱️ sending recent stock data",
    new Date().toLocaleTimeString("en-in")
  );
  io.to("trades").emit("stock-data", stockData);

  const allTakenTrades = await Promise.all(
    stockSymbols.map((s) => takeTrades(stockData.data[s], bestStockPresets[s]))
  );

  const trades = stockSymbols
    .map((s, i) => {
      const t = allTakenTrades[i].trades;

      return { symbol: s, trades: t };
    })
    .filter((item) => item.trades?.length)
    .map((item) => ({ ...item, trade: item.trades[0] }));

  if (
    !trades.length ||
    lastTradesTaken == trades.map((item) => item.symbol).join(",")
  ) {
    if (!trades.length)
      console.log(
        "🟡 no trades to take for now!!",
        allTakenTrades.map((item) => item.trades?.length)
      );
    return;
  }

  lastTradesTaken = trades.map((item) => item.symbol).join(",");

  for (let i = 0; i < trades.length; ++i) {
    const item = trades[i];

    const newTrade = new tradeSchema({
      name: item.symbol,
      ...item.trade,
      time: Date.now(),
      date: new Date().toLocaleDateString("en-in"),
    });

    await newTrade.save();
  }

  console.log("🔵 firing event to frontend");
  io.to("trades").emit("trade-taken");

  // const today9_15Time = new Date(
  //   todayStartTime + 9 * 60 * 60 * 1000 + 15 * 60 * 1000
  // ).getTime();

  // const responses = await Promise.all(
  //   stockSymbols.map((item) => getCurrentStockData(item, today9_15Time))
  // );

  // const data = {};
  // stockSymbols.forEach((item, i) => {
  //   data[item] = responses[i] || {
  //     s: "no",
  //     c: [],
  //     t: [],
  //     v: [],
  //     l: [],
  //     o: [],
  //     h: [],
  //   };
  // });
  // intradayStockData = data;
};

// interval for taking trades
setInterval(checkForGoodTrade, 90 * 1000);

server.listen(5000, () => {
  console.log("Backend is up at port 5000");

  SocketEvents(io, stockData);
  mongoose.set("strictQuery", true);
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("Established a connection with the database"))
    .catch((err) => console.log("Error connecting to database", err));
});
