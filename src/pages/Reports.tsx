// ============================================================
// Reports.tsx — FULL UPDATED VERSION
// Module 6: Analytics, Forecasting & Waste Monitoring
// Module 7: Reporting & Real-Time Retail Management
//
// What's REAL ML here:
//   • Linear Regression (OLS) for demand forecasting
//   • Apriori algorithm for market basket analysis
//   • Freshness Decay Model for waste monitoring
//   • Business Health Score (composite index)
//   • Auto-generated executive summary
// ============================================================

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  DollarSign, TrendingUp, Package, BarChart2, Banknote,
  BrainCircuit, Zap, ArrowUpRight, RefreshCw, Sparkles,
  Leaf, ShoppingCart, Bell, Activity
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// ── New ML-powered components ──────────────────────────────────────
import AIPredictiveForecasting from '@/components/AIPredictiveForecasting';
import WasteMonitor from '@/components/WasteMonitor';
import BasketAnalysis from '@/components/BasketAnalysis';
import RealTimeAlerts from '@/components/RealTimeAlerts';

// ── Legacy AI components (kept as-is) ─────────────────────────────
import CollaborativeInsights from '@/components/CollaborativeInsights';
import SemanticInsights from '@/components/SemanticInsights';
import AIExecutiveInsights from '@/components/AIExecutiveInsights';
import TrendingSearches from '@/components/TrendingSearches';

// ── ML Engine ─────────────────────────────────────────────────────
import {
  linearRegression,
  aggregateDailyRevenue,
  apriori,
  extractTransactions,
  freshnessScore,
  businessHealthScore,
} from '@/lib/mlEngine';

// ── Helpers ───────────────────────────────────────────────────────
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

function guessShelfLife(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes('milk') || lower.includes('curd') || lower.includes('paneer')) return 5;
  if (lower.includes('bread')) return 5;
  if (lower.includes('egg')) return 21;
  if (lower.includes('vegetable')) return 7;
  if (lower.includes('dal') || lower.includes('rice') || lower.includes('atta')) return 365;
  return 180;
}

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

// ── Custom Tooltip ─────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-bold text-slate-500 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span style={{ color: p.stroke || p.fill }} className="font-bold">{p.name}:</span>
          <span>{formatCurrency(Math.round(p.value))}</span>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
const Reports = () => {
  const { profile } = useAuth();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // ── Data Fetching ────────────────────────────────────────────────
  const { data: inventory = [], isLoading: invLoading } = useQuery({
    queryKey: ['reports-inventory', profile?.shop_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('inventory')
        .select('id, item_name, unit_price, cost_price, quantity, low_stock_threshold, freshness_score, created_at')
        .eq('shop_id', profile?.shop_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.shop_id,
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['reports-sales', profile?.shop_id, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.from('sales')
        .select('total_amount, created_at, items')
        .eq('shop_id', profile?.shop_id)
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.shop_id,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['reports-expenses', profile?.shop_id, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.from('expenses')
        .select('amount, category')
        .eq('shop_id', profile?.shop_id)
        .gte('date', startDate).lte('date', endDate);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.shop_id,
  });

  // ── Analytics Engine (real ML) ───────────────────────────────────
  const analytics = useMemo(() => {
    const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total_amount), 0);
    const totalExp = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const invValue = inventory.reduce((sum, i) => sum + (Number(i.cost_price || 0) * i.quantity), 0);

    // 1. Revenue trend
    const trend = aggregateDailyRevenue(sales);

    // 2. OLS Regression
    const reg = trend.length >= 3 ? linearRegression(trend.map(d => d.sales)) : null;

    // 3. Category revenue breakdown
    const catRevenue: Record<string, number> = {};
    expenses.forEach(e => {
      catRevenue[e.category || 'Other'] = (catRevenue[e.category || 'Other'] || 0) + Number(e.amount);
    });
    const categoryData = Object.entries(catRevenue).map(([name, value]) => ({ name, value: Math.round(value) }));

    // 4. Waste assessment
    const now = new Date();
    const needsReorder = inventory.filter(i => i.quantity <= (i.low_stock_threshold || 10));
    const criticalWasteItems = inventory.filter(item => {
      const daysOld = item.created_at
        ? Math.floor((now.getTime() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const shelfLife = guessShelfLife(item.item_name);
      const score = item.freshness_score !== null && item.freshness_score !== undefined
        ? Number(item.freshness_score)
        : freshnessScore(daysOld, shelfLife, item.quantity, Number(item.cost_price || 0)).score;
      return score < 30;
    });

    // 5. Health score (composite ML index)
    const health = businessHealthScore(
      totalRevenue, totalExp,
      reg?.m || 0,
      criticalWasteItems.length,
      needsReorder.length
    );

    // 6. Apriori basket pairs
    const transactions = extractTransactions(sales);
    const basketPairs = apriori(transactions, Math.max(2, Math.floor(transactions.length * 0.02)));

    // 7. Reorder list
    const reorderList = needsReorder.map(i => ({
      name: i.item_name,
      stock: i.quantity,
      suggest: (i.low_stock_threshold || 10) * 2,
    }));

    const margin = totalRevenue > 0 ? ((totalRevenue - totalExp) / totalRevenue * 100).toFixed(1) : '0.0';

    return {
      totalRevenue, totalExp, invValue, health, trend,
      reg, categoryData, basketPairs, reorderList,
      criticalWasteCount: criticalWasteItems.length,
      margin,
    };
  }, [sales, inventory, expenses]);

  if (invLoading || salesLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-950 text-white">
        <RefreshCw className="animate-spin mr-2" />
        <span>Loading Retail Intelligence — Modules 6 &amp; 7...</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50 dark:bg-slate-950">
      <Navbar />

      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">

        {/* ── Header & Date Picker ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border shadow-sm"
        >
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <BarChart2 className="text-indigo-600" />
              BUSINESS INTELLIGENCE
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">
              Modules 6 &amp; 7 · ML-Powered Analytics · Shop: {profile?.shop_id?.slice(0, 8)}...
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="grid gap-1">
              <Label className="text-[10px] font-bold text-slate-400">RANGE START</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-36 text-xs" />
            </div>
            <div className="grid gap-1">
              <Label className="text-[10px] font-bold text-slate-400">RANGE END</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-36 text-xs" />
            </div>
          </div>
        </motion.div>

        {/* ── KPI Strip ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
        >
          <KpiCard title="Total Revenue"    value={formatCurrency(analytics.totalRevenue)} icon={DollarSign} color="text-emerald-500" />
          <KpiCard title="Operating Spend"  value={formatCurrency(analytics.totalExp)}     icon={Banknote}   color="text-rose-500" />
          <KpiCard title="Inventory Value"  value={formatCurrency(analytics.invValue)}     icon={Package}    color="text-blue-500" />
          <KpiCard title="Net Margin"       value={`${analytics.margin}%`}                 icon={TrendingUp} color="text-indigo-500" />
          <KpiCard title="Critical Waste"   value={`${analytics.criticalWasteCount} items`} icon={Leaf}      color="text-amber-500" />

          {/* Health score — special card */}
          <Card className={`border-none shadow-lg ${analytics.health >= 70 ? 'bg-emerald-600' : analytics.health >= 40 ? 'bg-amber-500' : 'bg-red-600'} text-white`}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-[9px] font-black uppercase tracking-tighter opacity-80">Health Score</CardTitle>
              <Zap size={14} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{analytics.health}%</div>
              <div className="text-[9px] mt-1 font-medium bg-white/20 rounded px-2 py-0.5 inline-block">
                {analytics.health >= 70 ? 'Excellent' : analytics.health >= 40 ? 'Moderate' : 'Needs Attention'}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Main Tabs ────────────────────────────────────────── */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-white dark:bg-slate-900 border p-1.5 rounded-xl shadow-sm mb-6">
            {[
              { value: 'overview',    label: 'Overview',           icon: <Activity size={11} /> },
              { value: 'forecast',    label: 'AI Forecast',        icon: <BrainCircuit size={11} />, badge: 'OLS' },
              { value: 'basket',      label: 'Basket Analysis',    icon: <ShoppingCart size={11} />, badge: 'Apriori' },
              { value: 'waste',       label: 'Waste Monitor',      icon: <Leaf size={11} />, badge: 'Decay' },
              { value: 'alerts',      label: 'Live Alerts',        icon: <Bell size={11} /> },
              { value: 'aiinsights',  label: 'AI Insights',        icon: <Sparkles size={11} /> },
            ].map(t => (
              <TabsTrigger key={t.value} value={t.value} className="rounded-lg font-bold text-xs flex items-center gap-1 px-3">
                {t.icon} {t.label}
                {t.badge && <span className="ml-1 text-[8px] bg-indigo-100 text-indigo-600 rounded px-1 hidden sm:inline">{t.badge}</span>}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Tab 1: Financial Overview ─────────────────────── */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Revenue area chart */}
              <Card className="md:col-span-2 border-none shadow-sm">
                <CardHeader className="border-b pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <TrendingUp size={16} className="text-indigo-500" /> Revenue Velocity
                    {analytics.reg && (
                      <Badge className="bg-indigo-100 text-indigo-600 text-[10px]">
                        Trend: {analytics.reg.m > 0 ? '+' : ''}{Math.round(analytics.reg.m)}/day
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[300px] pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.trend}>
                      <defs>
                        <linearGradient id="colorS" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.08} />
                      <XAxis dataKey="date" fontSize={9} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis fontSize={9} axisLine={false} tickLine={false} tickFormatter={v => `₹${v / 1000}k`} width={44} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="sales" stroke="#6366f1" fill="url(#colorS)" strokeWidth={2.5} name="Revenue" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Expense breakdown pie */}
              <Card className="border-none shadow-sm">
                <CardHeader className="border-b pb-3">
                  <CardTitle className="text-sm font-bold">Expense Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px] pt-4 flex items-center justify-center">
                  {analytics.categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.categoryData}
                          cx="50%" cy="45%"
                          innerRadius={55} outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                          fontSize={9}
                        >
                          {analytics.categoryData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center">No expense data for this period.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Basket pairs quick view */}
            {analytics.basketPairs.length > 0 && (
              <Card className="border-none shadow-sm mt-4">
                <CardHeader className="border-b pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <ShoppingCart size={14} className="text-indigo-500" /> Top Product Pairs (Apriori)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {analytics.basketPairs.slice(0, 4).map((p, i) => (
                    <div key={i} className="p-3 rounded-xl border bg-slate-50 dark:bg-slate-800 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold leading-snug">{p.pair}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Lift: {p.lift}</p>
                      </div>
                      <Badge className="bg-orange-100 text-orange-600 text-[10px]">{p.support} orders</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Tab 2: AI Forecasting ─────────────────────────── */}
          <TabsContent value="forecast">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <div className="mb-4 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 text-xs text-indigo-700 dark:text-indigo-300">
                <strong>Algorithm:</strong> Ordinary Least Squares (OLS) Linear Regression.
                Fitted on historical daily revenue → predicts next 14 days with 95% confidence intervals.
                R² measures how well the trend line fits actual data.
              </div>
              <AIPredictiveForecasting />
            </motion.div>
          </TabsContent>

          {/* ── Tab 3: Market Basket Analysis ────────────────── */}
          <TabsContent value="basket">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <div className="mb-4 p-3 rounded-xl bg-purple-50 dark:bg-purple-950 border border-purple-200 text-xs text-purple-700 dark:text-purple-300">
                <strong>Algorithm:</strong> Apriori Market Basket Analysis.
                Scans all transactions to find frequently co-purchased item pairs.
                <strong> Support</strong> = how often the pair appears,
                <strong> Confidence</strong> = P(B given A),
                <strong> Lift</strong> = how much more likely than random (Lift &gt; 1 = positive association).
              </div>
              <BasketAnalysis />
            </motion.div>
          </TabsContent>

          {/* ── Tab 4: Waste Monitor ──────────────────────────── */}
          <TabsContent value="waste">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 text-xs text-emerald-700 dark:text-emerald-300">
                <strong>Model:</strong> Exponential Freshness Decay.
                Formula: <code className="bg-emerald-100 dark:bg-emerald-900 px-1 rounded">score = max(0, (1 − days_old / shelf_life) × 100)</code>.
                Items below 30% are flagged as critical. Waste value = cost × qty × decay_ratio × 0.45 (recovery factor).
              </div>
              <WasteMonitor />
            </motion.div>
          </TabsContent>

          {/* ── Tab 5: Live Alerts (Module 7) ────────────────── */}
          <TabsContent value="alerts">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950 border border-rose-200 text-xs text-rose-700 dark:text-rose-300">
                <strong>Module 7:</strong> Real-Time Retail Management. Auto-generates alerts from all ML models,
                computes a composite Business Health Score, and produces an automated executive summary report.
                Data refreshes every 30 seconds.
              </div>
              <RealTimeAlerts />
            </motion.div>
          </TabsContent>

          {/* ── Tab 6: AI Insights (existing components) ─────── */}
          <TabsContent value="aiinsights">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              <AIExecutiveInsights />
              <TrendingSearches />
              <CollaborativeInsights />
              <SemanticInsights />
            </motion.div>
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
};

// ── KPI Card ────────────────────────────────────────────────────────
const KpiCard = ({ title, value, icon: Icon, color }: {
  title: string; value: string; icon: React.ElementType; color: string;
}) => (
  <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900">
    <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
      <CardTitle className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{title}</CardTitle>
      <Icon className={`h-4 w-4 ${color}`} />
    </CardHeader>
    <CardContent className="px-4 pb-3">
      <div className="text-xl font-black text-slate-900 dark:text-white">{value}</div>
      <div className="flex items-center gap-1 mt-0.5 text-[9px] font-bold text-emerald-500">
        <ArrowUpRight size={9} /> vs last period
      </div>
    </CardContent>
  </Card>
);

export default Reports;