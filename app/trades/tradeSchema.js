import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: {
      type: String,
      require: true,
    },
    isApproved: {
      type: Boolean,
    },
    symbol: {
      type: String,
      require: true,
    },
    target: {
      type: Number,
      required: true,
    },
    sl: {
      type: Number,
      required: true,
    },
    priceData: {
      t: Array,
      v: Array,
      o: Array,
      c: Array,
      h: Array,
      l: Array,
    },
    tradeHigh: Number,
    tradeLow: Number,
    time: Number,
    status: String,
    date: String,
    startPrice: Number,
    type: String,
    analytics: Object,
  },
  {
    timestamps: true,
  }
);

const tradeSchema = mongoose.model("Trade", schema);

export default tradeSchema;
