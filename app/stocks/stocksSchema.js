import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    symbol: {
      type: String,
      require: true,
    },
  },
  {
    timestamps: true,
  }
);

const stocksSchema = mongoose.model("Stocks", schema);

export default stocksSchema;
