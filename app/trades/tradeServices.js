import { createError, createResponse } from "../../util/util.js";
import tradeSchema from "./tradeSchema.js";

const getTodayTrades = async (req, res) => {
  const date = new Date().toLocaleDateString();

  const trades = await tradeSchema.find({ date });

  createResponse(res, trades);
};

export { getTodayTrades };
