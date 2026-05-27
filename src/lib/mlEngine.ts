// ============================================================
// mlEngine.ts — Pure ML/Analytics functions (no dependencies)
// Implements: Linear Regression (OLS), Apriori Basket Analysis,
//             Freshness Decay Model, Revenue Forecasting
// ============================================================

// -------------------------------------------------------------------
// 1. LINEAR REGRESSION (Ordinary Least Squares)
//    Fits y = mx + b on historical data, returns predict(x)
// -------------------------------------------------------------------
export interface RegressionResult {
  m: number;        // slope (daily growth)
  b: number;        // intercept
  r2: number;       // coefficient of determination
  predict: (x: number) => number;
  confidenceInterval: (x: number, level?: number) => { upper: number; lower: number };
}

export function linearRegression(y: number[]): RegressionResult {
  const n = y.length;
  const x = y.map((_, i) => i);
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;

  const ssXY = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0);
  const ssXX = x.reduce((s, xi) => s + (xi - mx) ** 2, 0);
  const ssYY = y.reduce((s, yi) => s + (yi - my) ** 2, 0);

  const m = ssXX === 0 ? 0 : ssXY / ssXX;
  const b = my - m * mx;
  const r2 = ssYY === 0 ? 1 : Math.min(1, Math.max(0, (ssXY ** 2) / (ssXX * ssYY)));

  // Standard error of estimate
  const residuals = y.map((yi, i) => yi - (m * i + b));
  const sse = residuals.reduce((s, r) => s + r ** 2, 0);
  const se = Math.sqrt(sse / Math.max(1, n - 2));

  return {
    m,
    b,
    r2,
    predict: (xi: number) => Math.max(0, m * xi + b),
    confidenceInterval: (xi: number, level = 1.96) => {
      const margin = level * se * Math.sqrt(1 + 1 / n + (xi - mx) ** 2 / ssXX);
      const predicted = m * xi + b;
      return {
        upper: Math.round(Math.max(0, predicted + margin)),
        lower: Math.round(Math.max(0, predicted - margin)),
      };
    },
  };
}

// -------------------------------------------------------------------
// 2. APRIORI MARKET BASKET ANALYSIS
//    Finds frequent item pairs with support, confidence, lift
// -------------------------------------------------------------------
export interface BasketPair {
  pair: string;
  itemA: string;
  itemB: string;
  support: number;       // count of co-occurrences
  supportPct: number;    // support / total transactions
  confidence: number;    // P(B|A)
  lift: number;          // confidence / P(B)
}

export function apriori(
  transactions: string[][],
  minSupport = 2
): BasketPair[] {
  const total = transactions.length;
  if (total === 0) return [];

  // Item frequency for confidence calculation
  const itemCount: Record<string, number> = {};
  transactions.forEach(t =>
    t.forEach(item => { itemCount[item] = (itemCount[item] || 0) + 1; })
  );

  // Pair co-occurrence
  const pairCount: Record<string, number> = {};
  const pairItems: Record<string, [string, string]> = {};

  transactions.forEach(t => {
    const sorted = [...t].sort();
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const key = `${sorted[i]}|||${sorted[j]}`;
        pairCount[key] = (pairCount[key] || 0) + 1;
        pairItems[key] = [sorted[i], sorted[j]];
      }
    }
  });

  return Object.entries(pairCount)
    .filter(([, count]) => count >= minSupport)
    .map(([key, count]) => {
      const [itemA, itemB] = pairItems[key];
      const supportPct = count / total;
      const pA = (itemCount[itemA] || 1) / total;
      const pB = (itemCount[itemB] || 1) / total;
      const confidence = supportPct / pA;
      const lift = confidence / pB;
      return {
        pair: `${itemA} + ${itemB}`,
        itemA,
        itemB,
        support: count,
        supportPct: parseFloat((supportPct * 100).toFixed(1)),
        confidence: parseFloat((confidence * 100).toFixed(1)),
        lift: parseFloat(lift.toFixed(2)),
      };
    })
    .sort((a, b) => b.support - a.support)
    .slice(0, 10);
}

// -------------------------------------------------------------------
// 3. FRESHNESS DECAY MODEL
//    score = max(0, (1 − days_old / shelf_life) × 100)
//    Returns waste risk tier and monetary waste estimate
// -------------------------------------------------------------------
export type WasteTier = 'critical' | 'warning' | 'good';

export interface FreshnessResult {
  score: number;        // 0–100
  tier: WasteTier;
  daysLeft: number;
  wasteValue: number;   // cost × qty × (1 - score/100) × recoverable_ratio
}

const RECOVERABLE_RATIO = 0.45; // industry avg: 45% of waste value can be recovered via discounts

export function freshnessScore(
  daysOld: number,
  shelfLifeDays: number,
  qty: number,
  costPrice: number
): FreshnessResult {
  const ratio = shelfLifeDays > 0 ? daysOld / shelfLifeDays : 1;
  const score = Math.round(Math.max(0, (1 - ratio) * 100));
  const daysLeft = Math.max(0, shelfLifeDays - daysOld);
  const wasteValue = Math.round(costPrice * qty * (1 - score / 100) * RECOVERABLE_RATIO);
  const tier: WasteTier = score < 30 ? 'critical' : score < 60 ? 'warning' : 'good';
  return { score, tier, daysLeft, wasteValue };
}

// -------------------------------------------------------------------
// 4. DAILY REVENUE AGGREGATION
//    Groups sale records by date and sums amounts
// -------------------------------------------------------------------
export interface DailyRevenue {
  date: string;
  sales: number;
}

export function aggregateDailyRevenue(
  sales: Array<{ created_at: string; total_amount: number | string }>
): DailyRevenue[] {
  const map = new Map<string, number>();
  sales.forEach(s => {
    const date = s.created_at.split('T')[0];
    map.set(date, (map.get(date) || 0) + Number(s.total_amount));
  });
  return Array.from(map.entries())
    .map(([date, sales]) => ({ date, sales: Math.round(sales) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// -------------------------------------------------------------------
// 5. BUSINESS HEALTH SCORE
//    Composite index: margin, revenue trend, stock coverage
// -------------------------------------------------------------------
export function businessHealthScore(
  totalRevenue: number,
  totalExpenses: number,
  regressionSlope: number,
  criticalWasteCount: number,
  reorderCount: number
): number {
  const margin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;
  const marginScore = Math.min(40, margin * 1.5);               // max 40 pts
  const trendScore = regressionSlope > 0 ? Math.min(30, regressionSlope / 50) : 0; // max 30 pts
  const wasteScore = Math.max(0, 20 - criticalWasteCount * 3);  // max 20 pts
  const stockScore = Math.max(0, 10 - reorderCount * 2);        // max 10 pts
  return Math.round(Math.min(100, Math.max(0, marginScore + trendScore + wasteScore + stockScore)));
}

// -------------------------------------------------------------------
// 6. EXTRACT BASKET TRANSACTIONS from raw sales records
// -------------------------------------------------------------------
export function extractTransactions(
  sales: Array<{ items: unknown }>
): string[][] {
  return sales
    .map(s => {
      try {
        const items = Array.isArray(s.items)
          ? s.items
          : JSON.parse(s.items as string || '[]');
        return (items as Array<{ item_name?: string; name?: string }>)
          .map(i => i.item_name || i.name || '')
          .filter(Boolean);
      } catch {
        return [];
      }
    })
    .filter(t => t.length >= 2);
}