import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    symbol: {
      type: String,
      require: true,
    },
    preset: {
      type: Object,
      required: true,
    },
    result: Object,
  },
  {
    timestamps: true,
  }
);

const presetSchema = mongoose.model("Preset", schema);

export default presetSchema;
