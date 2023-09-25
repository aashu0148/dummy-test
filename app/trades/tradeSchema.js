import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: {
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
    time: {
      type: Date,
    },
    analytics: Object,
  },
  {
    timestamps: true,
  }
);

const tradeSchema = mongoose.model("Trade", schema);

export default tradeSchema;