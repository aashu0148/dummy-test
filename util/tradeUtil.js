import {
  SMA as technicalIndicatorSMA,
  RSI as technicalIndicatorRSI,
  MACD as technicalIndicatorMACD,
  BollingerBands as technicalIndicatorBollingerBands,
  CCI as technicalIndicatorCCI,
  Stochastic as technicalIndicatorStochastic,
  PSAR as technicalIndicatorPSAR,
  SuperTrend as technicalIndicatorSuperTrend,
} from "@debut/indicators";
import { IndicatorsNormalized } from "@ixjb94/indicators";

const IXJIndicators = new IndicatorsNormalized();

const trendEnum = {
  up: "up",
  down: "down",
  range: "range",
};
const signalEnum = {
  buy: "buy",
  sell: "sell",
  hold: "hold",
};
const signalWeight = {
  [signalEnum.sell]: -1,
  [signalEnum.hold]: 0,
  [signalEnum.buy]: 1,
};
const timeFrame = 5;
const getDxForPrice = (price, time = timeFrame) => {
  const dxPercentForTimeFrames = {
    5: 0.17 / 100,
    15: 0.8 / 100,
    60: 1.9 / 100,
  };

  return dxPercentForTimeFrames[time] * price;
};

const timesPricesCrossedRange = (prices = [], rangeMin, rangeMax) => {
  let count = 0,
    currPos = 0;

  prices.forEach((p) => {
    if (p < rangeMin) {
      if (currPos == 1) count++;

      currPos = -1;
    }
    if (p > rangeMax) {
      if (currPos == -1) count++;

      currPos = 1;
    }
  });

  return count;
};

export const nearlyEquateNums = (a, b, dx = 1) => Math.abs(a - b) <= dx;

export const getVPoints = ({
  prices = [],
  offset = 10,
  startFrom = 0,
  previousOutput = [],
}) => {
  if (!prices.length) return [];

  let output = [...previousOutput];
  if (startFrom < offset) startFrom = offset;

  let nearby = [];
  for (let i = startFrom; i < prices.length; ++i) {
    const price = prices[i];

    if (!nearby.length) nearby = prices.slice(i - offset, i + offset);
    else nearby = [...nearby.slice(1), prices[i + offset - 1]];

    const upAllClear = nearby.every((item) => item <= price);
    const downAllClear = nearby.every((item) => item >= price);

    if (upAllClear || downAllClear)
      output.push({
        index: i,
        value: price,
      });
  }

  const filteredPoints = [output[0]];

  for (let i = 1; i < output.length; ++i) {
    const prevPoint = output[i - 1];
    const point = output[i];
    if (prevPoint.value == point.value) continue;
    else filteredPoints.push(point);
  }

  return filteredPoints;
};

export const getSupportResistanceRangesFromVPoints = (
  vPoints = [],
  prices = []
) => {
  if (!vPoints.length || !prices.length) return [];

  const allRanges = [];

  for (let i = 0; i < vPoints.length - 1; ++i) {
    const startPoint = vPoints[i];

    let range = {
      min: Number.MAX_SAFE_INTEGER,
      max: 0,
      start: startPoint,
      points: [startPoint],
      stillStrong: false,
    };

    for (let j = i + 1; j < vPoints.length; ++j) {
      const currPoint = vPoints[j];

      const allowedDx = getDxForPrice(currPoint.value);

      const isNearlyEqual = nearlyEquateNums(
        startPoint.value,
        currPoint.value,
        allowedDx
      );
      if (!isNearlyEqual) continue;

      const rangePrices = prices.slice(startPoint.index, currPoint.index);

      let rangeMin, rangeMax;
      if (startPoint.value < currPoint.value) {
        rangeMin = startPoint.value;
        rangeMax = currPoint.value;
      } else {
        rangeMin = currPoint.value;
        rangeMax = startPoint.value;
      }

      if (rangeMin < range.min) range.min = rangeMin;
      if (rangeMax > range.max) range.max = rangeMax;

      const crossedTimes = timesPricesCrossedRange(
        rangePrices,
        range.min,
        range.max
      );

      if (crossedTimes > 3) {
        range.end = range.points[range.points.length - 1];
        break;
      }

      range.points.push(currPoint);
    }

    if (!range.end) {
      const end = range.points[range.points.length - 1];
      range.end = end;

      const crossedTillEnd = timesPricesCrossedRange(
        prices.slice(end.index),
        range.min,
        range.max
      );

      if (crossedTillEnd < 3) range.stillStrong = true;
    }

    allRanges.push(range);
  }

  const goodRanges = allRanges.filter((item) => item.points.length > 2);

  const finalRanges = [];

  // neglecting sub ranges
  for (let i = 0; i < goodRanges.length; ++i) {
    const currR = goodRanges[i];
    const subRanges = [];

    for (let j = 0; j < goodRanges.length; ++j) {
      const r = goodRanges[j];

      const isSubRange =
        currR.start.index >= r.start.index &&
        currR.end.index <= r.end.index &&
        currR.min >= r.min &&
        currR.max <= r.max;

      if (isSubRange) subRanges.push(currR);
    }

    if (subRanges.length < 2) finalRanges.push(currR);
  }

  return finalRanges;
};

export const getTrendEstimates = (prices = [], startCheckFrom = 12) => {
  if (!prices?.length) return [];

  const getHighestAndLowestOfLastRange = (prices = [], a, b) => {
    const arrLength = b - a;
    if (arrLength < 6) return;

    const sortedPrices = prices.slice(a, b).sort();

    const lowestAvg = (sortedPrices[0] + sortedPrices[1]) / 2;
    const highestAvg =
      (sortedPrices[arrLength - 1] + sortedPrices[arrLength - 2]) / 2;

    return {
      lowest: lowestAvg,
      highest: highestAvg,
    };
  };

  const trends = [];

  const range = 12;
  if (startCheckFrom < range) startCheckFrom = range;

  for (let i = 0; i < startCheckFrom; ++i) {
    trends.push({
      index: i,
      trend: trendEnum.range,
    });
  }

  for (let i = startCheckFrom; i < prices.length; ++i) {
    const price = prices[i];
    const { highest, lowest } = getHighestAndLowestOfLastRange(
      prices,
      i - range,
      i
    );
    const difference = highest - lowest;
    const differencePercent = (difference / price) * 100;

    if (differencePercent < 0.7) {
      trends.push({
        index: i,
        trend: trendEnum.range,
      });
      continue;
    }

    trends.push({
      index: i,
      trend: price > highest ? trendEnum.up : trendEnum.down,
    });
  }

  return trends;
};

const getMacdSignal = (macd) => {
  if (
    !macd?.length ||
    macd.length > 3 ||
    macd.some((item) => item.macd == undefined || item.signal == undefined)
  )
    return signalEnum.hold;

  if (macd[0].macd < 0.015 && macd[0].macd > -0.015) return signalEnum.hold;

  let signal = signalEnum.hold,
    s = 0;
  for (let i = 0; i < macd.length; ++i) {
    const d = macd[i].macd - macd[i].signal;

    if (d > 0) {
      if (s == -1) signal = signalEnum.buy;

      s = 1;
    } else if (d < 0) {
      if (s == 1) signal = signalEnum.sell;

      s = -1;
    }
  }

  return signal;
};

const getSmaCrossedSignal = ({ smaLow = [], smaHigh = [] }) => {
  if (
    !smaLow?.length ||
    !smaHigh?.length ||
    smaLow.length > 3 ||
    smaHigh.length > 3
  )
    return signalEnum.hold;

  let signal = signalEnum.hold,
    s = 0;
  for (let i = 0; i < smaLow.length; ++i) {
    const d = smaLow[i] - smaHigh[i];

    if (d > 0) {
      if (s == -1) signal = signalEnum.buy;

      s = 1;
    } else if (d < 0) {
      if (s == 1) signal = signalEnum.sell;

      s = -1;
    }
  }

  return signal;
};

export const takeTrades = async (
  priceData = {
    c: [],
    h: [],
    l: [],
    v: [],
  },
  {
    additionalIndicators = {
      willR: true,
      mfi: true,
      trend: true,
      cci: true,
      stochastic: true,
      vwap: true,
      psar: true,
    },
    vPointOffset = 10,
    rsiLow = 48,
    rsiHigh = 63,
    smaLowPeriod = 18,
    smaHighPeriod = 150,
    rsiPeriod = 8,
    macdFastPeriod = 14,
    macdSlowPeriod = 24,
    macdSignalPeriod = 8,
    bollingerBandPeriod = 23,
    bollingerBandStdDev = 4,
    cciPeriod = 20,
    stochasticPeriod = 14,
    stochasticMA = 3,
    stochasticLow = 23,
    stochasticHigh = 83,
    willRPeriod = 14,
    willRLow = -90,
    willRHigh = -10,
    psarStart = 0.02,
    psarAcceleration = 0.02,
    psarMaxValue = 0.2,
    superTrendMultiplier = 3,
    mfiPeriod = 14,
    mfliLow = 23,
    mfiHigh = 83,
    vwapPeriod = 14,
  }
) => {
  if (!priceData.c?.length) return { trades: [], analytics: {} };

  const indicatorSmallMA = new technicalIndicatorSMA(smaLowPeriod);
  const indicatorBigMA = new technicalIndicatorSMA(smaHighPeriod);
  const indicatorStochastic = new technicalIndicatorStochastic(
    stochasticPeriod,
    stochasticMA
  );
  const indicatorRsi = new technicalIndicatorRSI(rsiPeriod);
  const indicatorCCI = new technicalIndicatorCCI(cciPeriod);
  const indicatorMacd = new technicalIndicatorMACD(
    macdFastPeriod,
    macdSlowPeriod,
    macdSignalPeriod
  );
  const indicatorBollingerBands = new technicalIndicatorBollingerBands(
    bollingerBandPeriod,
    bollingerBandStdDev
  );
  const indicatorPSAR = new technicalIndicatorPSAR(
    psarStart,
    psarAcceleration,
    psarMaxValue
  );
  const indicatorSuperTrend = new technicalIndicatorSuperTrend(
    smaLowPeriod,
    superTrendMultiplier,
    "SMA"
  );

  const indicators = {
    lastCalculatedIndex: 0,
    smallMA: [],
    bigMA: [],
    rsi: [],
    cci: [],
    macd: [],
    bollingerBand: [],
    stochastic: [],
    psar: [],
    superTrend: [],
    obv: [],
    vwap: [],
    williamR: [],
    mfi: [],
    vPs: [],
  };

  let isTradeTaken = false,
    targetProfitPercent = 1.4 / 100,
    stopLossPercent = 0.7 / 100,
    trade = {},
    trades = [];

  let analytics = {
    signals: [],
    noOfBreakouts: 0,
    noOfBreakdowns: 0,
  };

  // const startTakingTradeIndex = 2000;
  // allowing the algo to take only one trade for last price
  const startTakingTradeIndex = priceData.c.length - 2;

  const vps = getVPoints({
    offset: vPointOffset,
    prices: priceData.c.slice(0, startTakingTradeIndex),
  });
  const obv = await IXJIndicators.obv(
    priceData.c.slice(0, startTakingTradeIndex),
    priceData.v.slice(0, startTakingTradeIndex)
  );
  const williamRange = await IXJIndicators.willr(
    priceData.h.slice(0, startTakingTradeIndex),
    priceData.l.slice(0, startTakingTradeIndex),
    priceData.c.slice(0, startTakingTradeIndex),
    willRPeriod
  );
  const moneyFlowIndex = await IXJIndicators.mfi(
    priceData.h.slice(0, startTakingTradeIndex),
    priceData.l.slice(0, startTakingTradeIndex),
    priceData.c.slice(0, startTakingTradeIndex),
    priceData.v.slice(0, startTakingTradeIndex),
    mfiPeriod
  );
  const vwap = await IXJIndicators.vwap(
    priceData.h.slice(0, startTakingTradeIndex),
    priceData.l.slice(0, startTakingTradeIndex),
    priceData.c.slice(0, startTakingTradeIndex),
    priceData.v.slice(0, startTakingTradeIndex),
    mfiPeriod
  );
  indicators.vPs = [...vps];
  indicators.obv = [...obv];
  indicators.vwap = [...vwap];
  indicators.mfi = [...moneyFlowIndex];
  indicators.williamR = [...williamRange];
  for (let i = 0; i < startTakingTradeIndex; ++i) {
    const high = priceData.h[i];
    const low = priceData.l[i];
    const price = priceData.c[i];

    const smaL = indicatorSmallMA.nextValue(price);
    const smaH = indicatorBigMA.nextValue(price);
    const rsi = indicatorRsi.nextValue(price);
    const cci = indicatorCCI.nextValue(high, low, price);
    const macd = indicatorMacd.nextValue(price);
    const bollingerBand = indicatorBollingerBands.nextValue(price);
    const stochastic = indicatorStochastic.nextValue(high, low, price).k;
    const psar = indicatorPSAR.nextValue(high, low, price);
    const superTrend = indicatorSuperTrend.nextValue(high, low, price);

    indicators.lastCalculatedIndex = i;
    indicators.smallMA.push(smaL);
    indicators.bigMA.push(smaH);
    indicators.rsi.push(rsi);
    indicators.cci.push(cci);
    indicators.macd.push(macd || {});
    indicators.bollingerBand.push(bollingerBand || {});
    indicators.stochastic.push(stochastic);
    indicators.psar.push(psar);
    indicators.superTrend.push(superTrend);
  }

  for (let i = startTakingTradeIndex; i < priceData.c.length; i++) {
    const prices = priceData.c.slice(0, i + 1);
    const highs = priceData.h.slice(0, i + 1);
    const lows = priceData.l.slice(0, i + 1);
    const vols = priceData.v.slice(0, i + 1);

    const prevPrice = prices[i - 1];
    const price = prices[i];
    const high = priceData.h[i];
    const low = priceData.l[i];

    if (isTradeTaken) {
      if (trade.type == signalEnum.buy) {
        if (price > trade.target) {
          trades.push({
            result: "profit",
            profit: trade.target - trade.startPrice,
            endPrice: price,
            endIndex: i,
            ...trade,
          });
          isTradeTaken = false;
          i = trade.startIndex;
        } else if (price < trade.sl) {
          trades.push({
            result: "loss",
            profit: trade.sl - trade.startPrice,
            endPrice: price,
            endIndex: i,
            ...trade,
          });
          isTradeTaken = false;
          i = trade.startIndex;
        }
      } else {
        if (price < trade.target) {
          trades.push({
            result: "profit",
            profit: trade.startPrice - trade.target,
            endPrice: price,
            endIndex: i,
            ...trade,
          });
          isTradeTaken = false;
          i = trade.startIndex;
        } else if (price > trade.sl) {
          trades.push({
            result: "loss",
            profit: trade.startPrice - trade.sl,
            endPrice: price,
            endIndex: i,
            ...trade,
          });
          isTradeTaken = false;
          i = trade.startIndex;
        }
      }
    } else {
      if (indicators.lastCalculatedIndex < i) {
        const smaL = indicatorSmallMA.nextValue(price);
        const smaH = indicatorBigMA.nextValue(price);
        const rsi = indicatorRsi.nextValue(price);
        const cci = indicatorCCI.nextValue(high, low, price);
        const macd = indicatorMacd.nextValue(price);
        const bollingerBand = indicatorBollingerBands.nextValue(price);
        const stochastic = indicatorStochastic.nextValue(high, low, price).k;
        const psar = indicatorPSAR.nextValue(high, low, price);
        const superTrend = indicatorSuperTrend.nextValue(high, low, price);
        const vps = getVPoints({
          offset: vPointOffset,
          prices: prices,
          startFrom: i - 40,
          previousOutput: indicators.vPs.filter((item) => item.index < i - 40),
        });
        const obv = await IXJIndicators.obv(prices, vols);
        const willR = await IXJIndicators.willr(
          highs,
          lows,
          prices,
          willRPeriod
        );
        const mfi = await IXJIndicators.mfi(
          highs,
          lows,
          prices,
          vols,
          mfiPeriod
        );
        const vwap = await IXJIndicators.vwap(
          highs,
          lows,
          prices,
          vols,
          vwapPeriod
        );

        indicators.lastCalculatedIndex = i;
        indicators.vPs = vps;
        indicators.obv = obv;
        indicators.vwap = vwap;
        indicators.mfi = mfi;
        indicators.williamR = willR;
        indicators.smallMA.push(smaL);
        indicators.bigMA.push(smaH);
        indicators.rsi.push(rsi);
        indicators.cci.push(cci);
        indicators.stochastic.push(stochastic);
        indicators.psar.push(psar);
        indicators.superTrend.push(superTrend);
        indicators.macd.push(macd || {});
        indicators.bollingerBand.push(bollingerBand || {});
      }

      const smallMA = indicators.smallMA;
      const bigMA = indicators.bigMA;
      const CCI = indicators.cci;
      const RSI = indicators.rsi;
      const MACD = indicators.macd;
      const PSAR = indicators.psar;
      const ST = indicators.superTrend;
      const BB = indicators.bollingerBand;
      const stochastic = indicators.stochastic;

      const ranges = getSupportResistanceRangesFromVPoints(
        indicators.vPs,
        prices
      );
      const strongSupportResistances = ranges.filter(
        (item) => item.stillStrong
      );

      const pricesWithTrends = getTrendEstimates(prices, i - 40);
      const trend = pricesWithTrends[i].trend;
      const rsi = RSI[i];
      const cci = CCI[i];
      const mfi = indicators.mfi[i];
      const vwap = indicators.vwap[i];
      const willR = indicators.williamR[i];
      const psar = PSAR[i];
      const superTrend = ST[i];

      const targetProfit = targetProfitPercent * price;
      const stopLoss = stopLossPercent * price;

      const isSRBreakout = strongSupportResistances.some(
        (item) => item.max < price && item.max > prevPrice
      );
      const isSRBreakdown = strongSupportResistances.some(
        (item) => item.min > price && item.min < prevPrice
      );
      const srSignal = isSRBreakout
        ? signalEnum.buy
        : isSRBreakdown
        ? signalEnum.sell
        : signalEnum.hold;
      const stochasticSignal =
        stochastic[i] < stochasticLow
          ? signalEnum.sell
          : stochastic[i] > stochasticHigh
          ? signalEnum.buy
          : signalEnum.hold;
      const rsiSignal =
        rsi < rsiLow
          ? signalEnum.buy
          : rsi > rsiHigh
          ? signalEnum.sell
          : signalEnum.hold;
      const willRSignal =
        willR < willRLow
          ? signalEnum.buy
          : willR > willRHigh
          ? signalEnum.sell
          : signalEnum.hold;
      const mfiSignal =
        mfi < mfliLow
          ? signalEnum.buy
          : mfi > mfiHigh
          ? signalEnum.sell
          : signalEnum.hold;
      const vwapSignal = price > vwap ? signalEnum.buy : signalEnum.sell;
      const cciSignal =
        cci > 100
          ? signalEnum.buy
          : cci < -100
          ? signalEnum.sell
          : signalEnum.hold;
      const macdSignal = getMacdSignal(MACD.slice(i - 2, i + 1));
      const smaSignal = getSmaCrossedSignal({
        smaLow: smallMA.slice(i - 2, i + 1),
        smaHigh: bigMA.slice(i - 2, i + 1),
      });
      const trendSignal =
        trend == trendEnum.down
          ? signalEnum.sell
          : trend == trendEnum.up
          ? signalEnum.buy
          : signalEnum.hold;
      const bollingerBandSignal =
        price >= BB[i].upper
          ? signalEnum.sell
          : price <= BB[i].lower
          ? signalEnum.buy
          : signalEnum.hold;
      const psarSignal =
        price >= psar && superTrend?.direction == 1
          ? signalEnum.buy
          : price <= psar && superTrend?.direction == -1
          ? signalEnum.sell
          : signalEnum.hold;

      const initialSignal =
        signalWeight[srSignal] * 2 +
        signalWeight[rsiSignal] +
        signalWeight[bollingerBandSignal] * 3 +
        signalWeight[macdSignal] * 2 +
        signalWeight[smaSignal] * 2;

      const decisionMakingPoint = 3;

      let isBuySignal = initialSignal >= decisionMakingPoint;
      let isSellSignal = initialSignal <= -1 * decisionMakingPoint;

      const furtherIndicatorSignals = [];
      if (additionalIndicators.cci)
        furtherIndicatorSignals.push(signalWeight[cciSignal]);
      if (additionalIndicators.mfi)
        furtherIndicatorSignals.push(signalWeight[mfiSignal]);
      if (additionalIndicators.stochastic)
        furtherIndicatorSignals.push(signalWeight[stochasticSignal]);
      if (additionalIndicators.vwap)
        furtherIndicatorSignals.push(signalWeight[vwapSignal]);
      if (additionalIndicators.psar)
        furtherIndicatorSignals.push(signalWeight[psarSignal]);
      if (additionalIndicators.trend)
        furtherIndicatorSignals.push(signalWeight[trendSignal]);
      if (additionalIndicators.willR)
        furtherIndicatorSignals.push(signalWeight[willRSignal]);

      const furtherPossibility =
        (furtherIndicatorSignals.reduce((acc, curr) => curr + acc, 0) /
          furtherIndicatorSignals.length) *
        100;

      const estimatedAccuracy = `${(
        50 +
        ((isSellSignal ? -1 : 1) * furtherPossibility) / 2
      ).toFixed(1)}%`;

      // if (parseInt(estimatedAccuracy) < 70) {
      //   isBuySignal = false;
      //   isSellSignal = false;
      // }

      const analytic = {
        estimatedAccuracy,
        vols: vols.slice(i - 4, i + 1),
        additionalIndicators,
        mainSignals: {
          rsiSignal,
          macdSignal,
          srSignal,
          bollingerBandSignal,
          smaSignal,
        },
        otherSignals: {
          trend: trendSignal,
          cci: cciSignal,
          stochastic: stochasticSignal,
          psarSignal,
          willRSignal,
          mfiSignal,
          vwapSignal,
        },
        netSignal: isBuySignal
          ? signalEnum.buy
          : isSellSignal
          ? signalEnum.sell
          : signalEnum.hold,
        index: i,
        price,
      };
      analytics.signals.push({
        ...analytic,
      });

      if (isBuySignal) {
        // neglect trade if last trade is recent and type of BUY
        const lastTrade = trades.length ? trades[trades.length - 1] : {};
        if (lastTrade?.type) {
          if (lastTrade.type == signalEnum.buy && i - lastTrade.startIndex < 4)
            continue;
        }

        let nearestResistance;
        for (let j = 0; j < strongSupportResistances.length; ++j) {
          const range = strongSupportResistances[j];
          if (range.max < price) continue;

          // if price is in between a range
          if (range.min < price) {
            nearestResistance = range.max;
            break;
          }

          if (!nearestResistance) nearestResistance = range.min;

          if (range.min < nearestResistance) nearestResistance = range.min;
        }

        const possibleProfit = nearestResistance
          ? nearestResistance - price
          : targetProfit;

        if (possibleProfit < targetProfit) continue;

        isTradeTaken = true;
        trade = {
          startIndex: i,
          startPrice: price,
          type: signalEnum.buy,
          target:
            possibleProfit > targetProfit
              ? price + targetProfit
              : price + possibleProfit,
          sl: price - stopLoss,
          analytics: analytic,
          nearestResistance,
        };
      } else if (isSellSignal) {
        // neglect trade if last trade is recent and type of SELL
        const lastTrade = trades.length ? trades[trades.length - 1] : {};
        if (lastTrade?.type) {
          if (lastTrade.type == signalEnum.sell && i - lastTrade.startIndex < 4)
            continue;
        }

        let nearestSupport;
        for (let j = 0; j < strongSupportResistances.length; ++j) {
          const range = strongSupportResistances[j];
          if (range.min > price) continue;

          // if price is in between a range
          if (range.max > price) {
            nearestSupport = range.min;
            break;
          }

          if (!nearestSupport) nearestSupport = range.max;

          if (range.max < nearestSupport) nearestSupport = range.max;
        }

        const possibleProfit = nearestSupport
          ? price - nearestSupport
          : targetProfit;

        if (possibleProfit < targetProfit) continue;

        isTradeTaken = true;
        trade = {
          startIndex: i,
          startPrice: price,
          type: signalEnum.sell,
          target:
            possibleProfit > targetProfit
              ? price - targetProfit
              : price - possibleProfit,
          sl: price + stopLoss,
          analytics: analytic,
          nearestSupport,
        };
      }
    }
  }

  return { trades, analytics };
};
