import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { Server as socketServer } from "socket.io";
import http from "http";
import dotenv from "dotenv";
dotenv.config();

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

app.use(userRoutes);
app.get("/hi", (_req, res) => res.send("Hello there buddy!"));

const availableStocks = {
  tataMotors: "TATAMOTORS",
  tataSteel: "TATASTEEL",
};
const stockData = {
  date: "",
  data: {},
};
const bestStockPresets = {
  [availableStocks.tataMotors]: {},
  [availableStocks.tataSteel]: {},
};
let intradayStockData = {};

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

  if (latestDataNotPresent) {
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
    stockData.date = new Date(todayStartTime + 24 * 60 * 60 * 1000);
  }

  const allTakenTrades = await Promise.all(
    stockSymbols.map((s) => takeTrades(stockData.data[s], bestStockPresets[s]))
  );

  const trades = {};
  stockSymbols.forEach((s, i) => {
    const t = allTakenTrades[i];

    trades[s] = t;
  });

  console.log("🔵 firing event to frontend");
  io.to("trades").emit("trade-taken", { trades, stockData });

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
setInterval(checkForGoodTrade, 60 * 1000);

server.listen(5000, () => {
  console.log("Backend is up at port 5000");

  SocketEvents(io);
  mongoose.set("strictQuery", true);
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("Established a connection with the database"))
    .catch((err) => console.log("Error connecting to database", err));
});