import { createError, createResponse } from "../../util/util.js";
import presetSchema from "./presetSchema.js";

const runFunc = async (req, res) => {
  // const update = await presetSchema.updateMany(
  //   {},
  //   {
  //     $set: {
  //       "preset.additionalIndicators.sr": true,
  //       "preset.additionalIndicators.sr15min": true,
  //     },
  //   }
  // );
  // createResponse(res, update);
};

const getBestPresets = async (req, res) => {
  const presets = await presetSchema.find({});

  createResponse(res, presets);
};

const createNewPreset = async (req, res) => {
  const { preset, result, symbol } = req.body;

  if (typeof preset !== "object" || !Object.keys(preset).length)
    return createError(res, "preset required");
  if (typeof result !== "object" || !Object.keys(result).length)
    return createError(res, "result required");
  if (!symbol) return createError(res, "symbol required");

  const currentPreset = await presetSchema.findOne({ symbol });
  if (currentPreset) {
    const currentProfit = parseInt(currentPreset.result?.profitPercent) || 0;
    const newProfit = parseInt(result?.profitPercent) || 0;
    if (currentProfit == newProfit)
      return createError(
        res,
        `Similar preset exist: ${currentPreset.symbol} - ${currentPreset.result.profitPercent}`
      );

    currentPreset.symbol = `${symbol}_old`;
    await currentPreset.save();
  }

  const newPreset = new presetSchema({
    symbol,
    preset,
    result,
  });

  newPreset
    .save()
    .then((p) => createResponse(res, p, 201))
    .catch((err) =>
      createError(res, err.message || "Error creating preset", 500)
    );
};

export { getBestPresets, createNewPreset, runFunc };
