export const availableStocks = {
  tataMotors: "TATAMOTORS",
  tataSteel: "TATASTEEL",
  itc: "ITC",
  hdfcLife: "HDFCLIFE",
  kfinTech: "KFINTECH",
  laOplaRG: "LAOPALA",
  HDFCBANK: "HDFCBANK",
  UPL: "UPL",
  KOTAKBANK: "KOTAKBANK",
  latentView: "LATENTVIEW",
  ZOMATO: "ZOMATO",
  BHEL: "BHEL",
  RECLTD: "RECLTD",
  BANKBARODA: "BANKBARODA",
  JSWENERGY: "JSWENERGY",
  CANBK: "CANBK",
  AMBUJACEM: "AMBUJACEM",
  VBL: "VBL",
  ZEEL: "ZEEL",
  VEDL: "VEDL",
  INDHOTEL: "INDHOTEL",
  DLF: "DLF",
  SUNTV: "SUNTV",
  POONAWALLA: "POONAWALLA",
  INDIANB: "INDIANB",
  ABFRL: "ABFRL",
  DEVYANI: "DEVYANI",
};

export const bestStockPresets = {
  ...Object.values(availableStocks).reduce((acc, curr) => {
    acc[curr] = {};
    return acc;
  }, {}),
  [availableStocks.tataMotors]: {
    decisionMakingPoints: 3,
    additionalIndicators: {
      willR: false,
      mfi: false,
      trend: true,
      cci: false,
      stochastic: false,
      vwap: false,
      psar: false,
    },
    useSupportResistances: true,
    vPointOffset: 8,
  },
  [availableStocks.tataSteel]: {
    decisionMakingPoints: 3,
    additionalIndicators: {
      willR: false,
      mfi: false,
      trend: true,
      cci: false,
      stochastic: false,
      vwap: false,
      psar: false,
    },
    useSupportResistances: true,
    vPointOffset: 8,
  },
  [availableStocks.hdfcLife]: {
    decisionMakingPoints: 3,
    additionalIndicators: {
      willR: false,
      mfi: false,
      trend: true,
      cci: false,
      stochastic: false,
      vwap: false,
      psar: false,
    },
    useSupportResistances: true,
    vPointOffset: 8,
  },
  [availableStocks.INDHOTEL]: {
    vPointOffset: 12,
  },
  [availableStocks.DEVYANI]: {
    vPointOffset: 4,
  },
  [availableStocks.ABFRL]: {
    additionalIndicators: {
      willR: false,
      mfi: false,
      trend: false,
      cci: false,
      stochastic: false,
      vwap: false,
      psar: false,
    },
    vPointOffset: 7,
  },
  [availableStocks.INDIANB]: {
    additionalIndicators: {
      willR: false,
      mfi: false,
      trend: false,
      cci: false,
      stochastic: false,
      vwap: false,
      psar: false,
    },
    vPointOffset: 7,
  },
  [availableStocks.POONAWALLA]: {
    vPointOffset: 6,
  },
  [availableStocks.SUNTV]: {
    vPointOffset: 14,
  },
};
