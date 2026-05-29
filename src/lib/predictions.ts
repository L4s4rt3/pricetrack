import type { PrecioRow } from "./types";

interface PredictionResult {
  predMonths: string[];
  predicted: number[];
  historical: number[];
  lowerBound: number[];
  upperBound: number[];
  trend: number;
}

export function predictPrices(history: { month: number; year: number; price: number }[], monthsAhead = 12): PredictionResult {
  const prices = history.filter((h) => h.price > 0);
  if (prices.length < 3) {
    return { predMonths: [], predicted: [], historical: [], lowerBound: [], upperBound: [], trend: 0 };
  }

  prices.sort((a, b) => a.year - b.year || a.month - b.month);

  const values = prices.map((p) => p.price);
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den !== 0 ? num / den : 0;
  const intercept = yMean - slope * xMean;

  const lastPrice = values[values.length - 1];
  const lastDate = prices[prices.length - 1];

  const predicted: number[] = [];
  const predMonths: string[] = [];
  const lowerBound: number[] = [];
  const upperBound: number[] = [];

  const residuals = values.map((v, i) => Math.abs(v - (slope * i + intercept)));
  const mad = residuals.reduce((a, b) => a + b, 0) / residuals.length;

  for (let i = 1; i <= monthsAhead; i++) {
    const futureIdx = n + i - 1;
    const base = Math.max(0, slope * futureIdx + intercept);
    const seasonal = detectSeasonality(prices, lastDate.month + i);
    const pred = base * seasonal;
    predicted.push(Math.round(pred * 10000) / 10000);
    const bound = mad * (1 + i * 0.05) * 1.96;
    lowerBound.push(Math.max(0, pred - bound));
    upperBound.push(pred + bound);

    const m = ((lastDate.month + i - 1) % 12) + 1;
    const y = lastDate.year + Math.floor((lastDate.month + i - 1) / 12);
    predMonths.push(`${String(m).padStart(2, "0")}/${y}`);
  }

  return {
    predMonths,
    predicted,
    historical: values,
    lowerBound,
    upperBound,
    trend: slope,
  };
}

function detectSeasonality(
  prices: { month: number; price: number }[],
  targetMonth: number
): number {
  const sameMonth = prices.filter((p) => p.month === ((targetMonth - 1) % 12) + 1);
  if (sameMonth.length < 2) return 1;
  const avgPrice = sameMonth.reduce((s, p) => s + p.price, 0) / sameMonth.length;
  const overallAvg = prices.reduce((s, p) => s + p.price, 0) / prices.length;
  return overallAvg > 0 ? avgPrice / overallAvg : 1;
}
