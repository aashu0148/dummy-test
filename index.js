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
import presetSchema from "./app/presets/presetSchema.js";
import stocksSchema from "./app/stocks/stocksSchema.js";
import tradeRoutes from "./app/trades/tradeRoutes.js";
import SocketEvents from "./app/socket/events.js";
import presetRoutes from "./app/presets/presetRoutes.js";
import stockRoutes from "./app/stocks/stocksRoutes.js";
import userRoutes from "./app/user/userRoutes.js";
import { takeTrades } from "./util/tradeUtil.js";

const emailsToNotify = ["buildforss@gmail.com", "hariomparasher@gmail.com"];
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

const stockData = {
  date: "",
  data: {},
};
let recentlyFetchedData = {};

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const updateStockData = (newData) => {
  if (typeof newData !== "object" || !Object.keys(newData).length) return;

  recentlyFetchedData = newData;
};

app.use((req, _res, next) => {
  req.recentlyFetchedData = recentlyFetchedData;
  req.updateStockData = updateStockData;
  next();
}, tradeRoutes);
app.use((req, _res, next) => {
  req.recentlyFetchedData = recentlyFetchedData;
  req.updateStockData = updateStockData;
  next();
}, presetRoutes);
app.use(stockRoutes);
app.use(userRoutes);
app.get("/hi", (_req, res) => res.send("Hello there buddy!"));

const getStockPastData = async (
  symbol,
  from = Date.now() - 40 * 24 * 60 * 60 * 1000,
  to,
  resolution = 5
) => {
  if (!to) return null;
  const toTime = parseInt(to / 1000);
  const fromTime = parseInt(from / 1000);
  if (toTime - fromTime < 0) return null;

  const countBackDays = (toTime - fromTime) / 60 / 60 / 24;
  const countBackCandles =
    parseInt(countBackDays - (29 / 100) * countBackDays) *
    (resolution == 5 ? 75 : 25);

  const url = `https://priceapi.moneycontrol.com/techCharts/indianMarket/stock/history?symbol=${symbol}&resolution=${resolution}&to=${toTime}&countback=${countBackCandles}&currencyCode=INR`;

  const res = await axios
    .get(url)
    .catch((err) => console.log("🔴 ERROR making req", err.message));

  if (res?.data?.s !== "ok") return null;

  return res.data;
};

export const getAllStocksData = async (
  symbols = [],
  from,
  to = Date.now(),
  resolutions = [5]
) => {
  const allResolutionResponses = await Promise.all(
    resolutions.map((r) =>
      Promise.all(symbols.map((item) => getStockPastData(item, from, to, r)))
    )
  );

  const data = {};
  symbols.forEach((item, index) => {
    const defaultStockData = {
      s: "no",
      c: [],
      t: [],
      v: [],
      l: [],
      o: [],
      h: [],
    };

    let obj = {};

    allResolutionResponses.forEach((responses, ri) => {
      obj[resolutions[ri]] = responses[index] || defaultStockData;
    });

    data[item] = obj;
  });

  return data;
};

const checkTradeCompletion = (
  triggerPrice,
  priceData,
  target,
  sl,
  isSellTrade = false
) => {
  if (
    !triggerPrice ||
    !target ||
    !sl ||
    !Array.isArray(priceData?.c) ||
    !priceData?.c?.length
  )
    return 0;

  for (let i = 0; i < priceData.c.length; ++i) {
    const c = priceData.c[i];
    const l = priceData.l[i];
    const h = priceData.h[i];

    if ((isSellTrade && l < target) || (!isSellTrade && h > target)) return 1;
    if ((isSellTrade && h >= sl) || (!isSellTrade && l <= sl)) return -1;
  }

  return 0;
};

const completeTodaysTradesStatus = async (todayTakenTrades = []) => {
  if (!todayTakenTrades.length) return;

  todayTakenTrades.forEach(async (trade) => {
    if (trade.status == "profit" || trade.status == "loss") return;

    const isSellTrade = trade.type.toLowerCase() == "sell";
    const symbol = trade.symbol || trade.name;

    const data = stockData.data[symbol] ? stockData.data[symbol]["5"] : {};
    if (!data?.c?.length) return;

    const tradeTimeInSec = trade.time / 1000;
    const timeIndex = data.t.findIndex((t) => t >= tradeTimeInSec);
    if (timeIndex < 0) return;

    const statusNumber = checkTradeCompletion(
      trade.startPrice,
      {
        c: data.c.slice(timeIndex),
        o: data.o.slice(timeIndex),
        h: data.h.slice(timeIndex),
        l: data.l.slice(timeIndex),
        t: data.t.slice(timeIndex),
      },
      trade.target,
      trade.sl,
      isSellTrade
    );

    const status =
      statusNumber == 1 ? "profit" : statusNumber == -1 ? "loss" : "taken";
    if (status == trade.status) return;

    // update the trade status
    await tradeSchema.updateOne(
      { _id: trade._id },
      {
        $set: {
          status,
        },
      }
    );
    console.log(`🔵 Trade status updated for ${symbol}, as: ${status}`);
  });
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
  try {
    transport.sendMail({
      from: gmailMail,
      to: to,
      subject,
      html,
    });
  } catch (err) {
    console.log("🔴 Error sending mail", err.message);
  }
};

const notifyEmailsWithTrade = (trade) => {
  if (!trade?.symbol) return;

  const currentTimeString = new Date().toLocaleTimeString("en-in", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
  });

  emailsToNotify.forEach((email) => {
    const target = parseFloat(trade.target).toFixed(1);
    const trigger = parseFloat(trade.startPrice).toFixed(1);
    const sl = parseFloat(trade.sl).toFixed(1);

    sendMail(
      email,
      `${trade.symbol} | ${
        trade?.type ? trade.type.toUpperCase() : ""
      }: ${trigger} | Target: ${target} | SL: ${sl}`,
      getMailBodyHTML({
        symbol: trade.symbol,
        trigger,
        target,
        sl,
        type: trade.type ? trade.type.toUpperCase() : "",
        time: currentTimeString,
      })
    );
  });

  console.log("🟢 Mails sent to:", emailsToNotify.join(", "));
};

const getShortenStockData = () => {
  const data = stockData.data;
  if (!data || typeof data !== "object" || !Object.keys(data).length) return {};

  const newData = {};

  for (let s in data) {
    const val = data[s] ? data[s]["5"] : {};
    if (!val?.c?.length) continue;

    newData[s] = {
      c: val.c.slice(-500),
      t: val.t.slice(-500),
      h: val.h.slice(-500),
      l: val.l.slice(-500),
      o: val.o.slice(-500),
      v: val.v.slice(-500),
    };
  }

  return { date: stockData.date, data: newData };
};

const getTodayTradesAndUpdateStockData = async () => {
  const currentTimeString = new Date().toLocaleTimeString("en-in", {
    timeZone: "Asia/Kolkata",
    hour12: false,
  });

  const allAvailableStocks = await stocksSchema.find({});
  const stockSymbols = allAvailableStocks.map((item) => item.symbol);

  const data = await getAllStocksData(stockSymbols);

  stockData.data = data;
  stockData.date = Date.now();

  console.log("⏱️ sending recent stock data", currentTimeString);
  io.to("trades").emit("stock-data", getShortenStockData());

  const todayDate = new Date().toLocaleDateString("en-in");
  const todaysTakenTrades = await tradeSchema.find({ date: todayDate });

  // updating trade status
  completeTodaysTradesStatus(todaysTakenTrades);

  return {
    symbols: stockSymbols,
    todaysTakenTrades,
  };
};

const monitorMarket = async () => {
  const weekDay = new Date()
    .toLocaleString("en-in", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
    })
    .toLowerCase();
  const currentTimeString = new Date().toLocaleTimeString("en-in", {
    timeZone: "Asia/Kolkata",
    hour12: false,
  });
  const [hour, min, sec] = currentTimeString
    .split(":")
    .map((item) => parseInt(item));

  // returning if not in market hours
  if (
    weekDay == "sat" ||
    weekDay == "sun" ||
    hour < 9 ||
    hour > 15 ||
    (hour == 9 && min < 15) ||
    (hour == 15 && min > 30)
  )
    return;

  // returning because checkGoodTrade will run at this time and it will take care of monitoring market
  if (min % 5 == 0) return;

  await getTodayTradesAndUpdateStockData();
};

const checkForGoodTrade = async () => {
  const weekDay = new Date()
    .toLocaleString("en-in", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
    })
    .toLowerCase();
  const currentTimeString = new Date().toLocaleTimeString("en-in", {
    timeZone: "Asia/Kolkata",
    hour12: false,
  });
  const [hour, min, sec] = currentTimeString
    .split(":")
    .map((item) => parseInt(item));

  // returning if not in market hours
  if (
    weekDay == "sat" ||
    weekDay == "sun" ||
    hour < 9 ||
    hour >= 15 ||
    (hour == 9 && min < 30) ||
    (hour == 14 && min > 45)
  )
    return;

  // returning if not near the 5min time frame
  if (
    (min % 5 > 0 && min % 5 < 4) ||
    (min % 5 == 4 && sec < 55) ||
    (min % 5 == 0 && sec > 20)
  )
    return;

  const { symbols: stockSymbols, todaysTakenTrades } =
    await getTodayTradesAndUpdateStockData();

  const presets = await presetSchema.find({});

  const allTakenTrades = await Promise.all(
    stockSymbols.map((s) => {
      const bestPresetForStock =
        presets.find((p) => p.symbol == s)?.preset || {};

      return takeTrades(stockData.data[s], bestPresetForStock || {}, true);
    })
  );

  const allTrades = stockSymbols.map((s, i) => {
    const t = allTakenTrades[i].trades;
    const a = allTakenTrades[i].analytics;

    return {
      symbol: s,
      trades: t,
      trade: t.length ? t[0] : {},
      analytic: a[0] && typeof a[0] == "object" ? { ...a[0], symbol: s } : {},
    };
  });

  const trades = allTrades.filter((item) => item.trades?.length);

  if (!trades.length) {
    io.to("trades").emit("test", allTrades);

    if (!trades.length)
      console.log(
        "🟡 no trades to take for now!!",
        allTrades.map((item) => item.trades?.length)
      );
    return;
  }

  const isAllowedToTakeThisTrade = (trade) => {
    const unfinishedSimilarTrades = Array.from(todaysTakenTrades).filter(
      (item) =>
        item.status == "taken" &&
        item.type == trade.type &&
        item.symbol == trade.symbol
    );

    return unfinishedSimilarTrades.length > 0 ? false : true;
  };

  let tookATrade = false;
  for (let i = 0; i < trades.length; ++i) {
    const item = trades[i];

    const tradeObj = {
      name: item.symbol,
      symbol: item.symbol,
      ...item.trade,
      status: "taken",
      time: item.trade?.time ? item.trade.time * 1000 : Date.now(),
      date: new Date().toLocaleDateString("en-in"),
    };
    if (!isAllowedToTakeThisTrade(tradeObj)) continue;

    const newTrade = new tradeSchema(tradeObj);

    notifyEmailsWithTrade({ ...item.trade, symbol: item.symbol });

    await newTrade.save();
    tookATrade = true;
  }

  if (tookATrade) {
    console.log("🟢 firing event to frontend");
    io.to("trades").emit("trade-taken");
  }
};

let starterInterval = setInterval(() => {
  const currentTimeString = new Date().toLocaleTimeString("en-in", {
    timeZone: "Asia/Kolkata",
    hour12: false,
  });
  const [hour, min, sec] = currentTimeString
    .split(":")
    .map((item) => parseInt(item));

  if (min % 5 == 0 && sec < 4 && sec > 1) {
    clearInterval(starterInterval);

    checkForGoodTrade();
    // interval for taking trades
    setInterval(checkForGoodTrade, 10 * 1000);

    monitorMarket();
    // interval for monitoring market
    setInterval(monitorMarket, 60 * 1000);
  }
}, 1000);

server.listen(5000, () => {
  console.log("Backend is up at port 5000");

  SocketEvents(io, stockData);
  mongoose.set("strictQuery", true);
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("Established a connection with the database"))
    .catch((err) => console.log("Error connecting to database", err));
});
