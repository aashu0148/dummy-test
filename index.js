import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { Server as socketServer } from "socket.io";
import http from "http";
import nodemailer from "nodemailer";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

import tradeSchema from "./app/trades/tradeSchema.js";
import tradeRoutes from "./app/trades/tradeRoutes.js";
import SocketEvents from "./app/socket/events.js";
import userRoutes from "./app/user/userRoutes.js";
import { takeTrades } from "./util/tradeUtil.js";
import { availableStocks, bestStockPresets } from "./util/constants.js";

const emailsToNotify = ["aashu.1st@gmail.com", "hariomparasher@gmail.com"];
const gmailMail = process.env.GMAIL_MAIL;
const gmailPassword = process.env.GMAIL_PASS;
const transport = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: gmailMail,
    pass: gmailPassword,
  },
});

const app = express();
const server = http.createServer(app);
const io = new socketServer(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(tradeRoutes);
app.use(userRoutes);
app.get("/hi", (_req, res) => res.send("Hello there buddy!"));

const stockData = {
  date: "",
  data: {},
};
let lastTradesTaken = "";

const getStockPastData = async (symbol, to) => {
  if (!to) return null;
  const time = parseInt(new Date(to).getTime() / 1000);

  const url = `https://priceapi.moneycontrol.com/techCharts/indianMarket/stock/history?symbol=${symbol}&resolution=5&to=${time}&countback=4000&currencyCode=INR`;

  const res = await axios
    .get(url)
    .catch((err) => console.log("🔴 ERROR making req", err.message));

  if (res?.data?.s !== "ok") return null;

  return res.data;
};

const getMailBodyHTML = ({ symbol, trigger, target, sl, type, time }) => {
  return `
  <div
  style="
    font-family: sans-serif;
    background-color: #fff;
    border-radius: 10px;
    padding: 20px;
    margin: 20px auto;
    max-width: 400px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  "
>
  <h3 style="color: #1c65db">Stock Trading Information | ${time}</h3>
  <div style="margin-top: 10px">
    <p style="font-weight: 500; color: #73646f; font-size: 14px">Symbol:</p>
    <p style="color: #000; font-weight:600; font-size: 16px; margin-top:-8px;">${symbol} - ${type}</p>
  </div>
  <div style="margin-top: 10px">
    <p style="font-weight: 500; color: #73646f; font-size: 14px">
      Trigger Price:
    </p>
    <p style="color: #000; font-weight:600; font-size: 16px; margin-top:-8px;">${trigger}</p>
  </div>
  <div style="margin-top: 10px">
    <p style="font-weight: 500; color: #73646f; font-size: 14px">Target Price:</p>
    <p style="color: #21ac56; font-weight:600; font-size: 16px; margin-top:-8px;">${target}</p>
  </div>
  <div style="margin-top: 10px">
    <p style="font-weight: 500; color: #73646f; font-size: 14px">Stop Loss:</p>
    <p style="color: #dc3545; font-weight:600; font-size: 16px; margin-top:-8px;">${sl}</p>
  </div>
</div>

  `;
};

const sendMail = async (to, subject, html) => {
  transport.sendMail({
    from: gmailMail,
    to: to,
    subject,
    html,
  });
};

const dummyTrade = {
  name: "TATASTEEL",
  symbol: "TATASTEEL",
  type: "buy",
  startPrice: 312,
  target: 318,
  sl: 309,
};

const notifyEmailsWithTrade = (trade) => {
  if (!trade?.symbol) return;

  const currentTimeString = new Date().toLocaleTimeString("en-in", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
  });

  emailsToNotify.forEach((email) => {
    sendMail(
      email,
      `${trade.symbol} | ${trade?.type ? trade.type.toUpperCase() : ""}: ${
        trade.startPrice
      } | Target: ${trade.target} | SL: ${trade.sl}`,
      getMailBodyHTML({
        symbol: trade.symbol,
        trigger: trade.startPrice,
        target: trade.target,
        sl: trade.sl,
        type: trade.type ? trade.type.toUpperCase() : "",
        time: currentTimeString,
      })
    );
  });

  console.log("🟢 Mails sent to:", emailsToNotify.join(", "));
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

  // returning if not near the 5min time frame
  if (
    (min % 5 > 0 && min % 5 < 4) ||
    (min % 5 == 4 && sec < 30) ||
    (min % 5 == 0 && sec > 30)
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

  console.log("⏱️ sending recent stock data", currentTimeString);
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

    notifyEmailsWithTrade({ ...item.trade, symbol: item.symbol });

    await newTrade.save();
  }

  console.log("🟢 firing event to frontend");
  io.to("trades").emit("trade-taken");
};

// interval for taking trades
setInterval(checkForGoodTrade, 20 * 1000);

server.listen(5000, () => {
  console.log("Backend is up at port 5000");

  SocketEvents(io, stockData);
  mongoose.set("strictQuery", true);
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("Established a connection with the database"))
    .catch((err) => console.log("Error connecting to database", err));
});
