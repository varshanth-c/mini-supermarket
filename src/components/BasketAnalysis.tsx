// ============================================================
// BasketAnalysis.tsx
// Module 6 — Real Apriori Market Basket Analysis
// Computes: support, confidence, lift from raw sales transactions
// ============================================================

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { apriori, extractTransactions } from '@/lib/mlEngine';
import { ShoppingCart, Zap, TrendingUp, RefreshCw, Tag } from 'lucide-react';

const BasketAnalysis: React.FC = () => {
  const { profile } = useAuth();
  const [sortBy, setSortBy] = useState<'support' | 'confidence' | 'lift'>('support');

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['basket-sales', profile?.shop_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('items')
        .eq('shop_id', profile?.shop_id)
        .order('created_at', { ascending: false })
        .limit(500); // last 500 transactions for Apriori
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.shop_id,
  });

  const { pairs, transactions, topPairs } = useMemo(() => {
    const transactions = extractTransactions(sales);
    if (transactions.length === 0) return { pairs: [], transactions: [], topPairs: [] };

    const minSupport = Math.max(2, Math.floor(transactions.length * 0.02)); // 2% min support
    const pairs = apriori(transactions, minSupport);

    const sorted = [...pairs].sort((a, b) => b[sortBy] - a[sortBy]);
    return { pairs: sorted, transactions, topPairs: sorted.slice(0, 5) };
  }, [sales, sortBy]);

  const chartData = topPairs.map(p => ({
    name: p.pair.split(' + ').map(s => s.slice(0, 8)).join('+'),
    support: p.support,
    confidence: p.confidence,
    lift: p.lift,
  }));

  const liftColor = (lift: number) =>
    lift >= 2 ? '#10b981' : lift >= 1.5 ? '#6366f1' : lift >= 1 ? '#f59e0b' : '#ef4444';

  if (isLoading) {
    return (
      <Card className="border-none shadow-sm">
        <CardContent className="flex items-center justify-center h-48">
          <RefreshCw className="animate-spin text-indigo-500 mr-2" />
          <span className="text-sm text-muted-foreground">Running Apriori algorithm...</span>
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card className="border-none shadow-sm border-dashed border-2 border-slate-200">
        <CardContent className="flex flex-col items-center justify-center h-48 gap-2 text-center">
          <ShoppingCart className="text-slate-300" size={32} />
          <p className="text-sm text-muted-foreground">No multi-item transactions found.</p>
          <p className="text-xs text-slate-400">Basket analysis needs sales with 2+ items.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-indigo-50 dark:bg-indigo-950">
          <CardContent className="pt-4">
            <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Transactions Analysed</p>
            <p className="text-3xl font-black text-indigo-700 dark:text-indigo-300">{transactions.length}</p>
            <p className="text-[10px] text-indigo-500 mt-1">Multi-item baskets</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-4">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Frequent Pairs Found</p>
            <p className="text-3xl font-black text-slate-800 dark:text-white">{pairs.length}</p>
            <p className="text-[10px] text-slate-400 mt-1">Above min support</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-4">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Best Lift Score</p>
            <p className="text-3xl font-black text-emerald-600">
              {pairs.length > 0 ? Math.max(...pairs.map(p => p.lift)).toFixed(2) : '—'}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">Higher = stronger link</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-4">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Avg Basket Confidence</p>
            <p className="text-3xl font-black text-blue-600">
              {pairs.length > 0
                ? `${Math.round(pairs.reduce((s, p) => s + p.confidence, 0) / pairs.length)}%`
                : '—'}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">Across all pairs</p>
          </CardContent>
        </Card>
      </div>

      {/* Main table */}
      <Card className="border-none shadow-sm">
        <CardHeader className="border-b pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ShoppingCart size={16} className="text-indigo-500" />
              Apriori Association Rules
              <Badge className="bg-indigo-100 text-indigo-600 text-[10px]">Algorithm Active</Badge>
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
              <span className="text-[10px] text-slate-400 self-center">Sort by:</span>
              {(['support', 'confidence', 'lift'] as const).map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant={sortBy === s ? 'default' : 'outline'}
                  className="h-7 text-[10px] font-bold px-3 capitalize"
                  onClick={() => setSortBy(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Min support = {Math.max(2, Math.floor(transactions.length * 0.02))} transactions (2% threshold) ·
            Lift &gt; 1.5 = strong association · Lift &gt; 2 = very strong
          </p>
        </CardHeader>
        <CardContent className="pt-4 space-y-2 max-h-80 overflow-y-auto">
          {pairs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No frequent pairs found. Try adding more transactions or lowering the threshold.
            </p>
          ) : pairs.map((p, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <span className="text-[10px] font-black text-slate-300 w-5">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{p.pair}</p>
                <div className="flex items-center gap-1 mt-1">
                  <div className="h-1.5 rounded-full bg-slate-100 flex-1 max-w-32 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${Math.min(100, p.supportPct * 5)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-slate-400">{p.supportPct}% support</span>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                <Badge className="bg-blue-100 text-blue-700 text-[10px]">
                  Support: {p.support}
                </Badge>
                <Badge className="bg-purple-100 text-purple-700 text-[10px]">
                  Conf: {p.confidence}%
                </Badge>
                <Badge
                  className="text-[10px] text-white"
                  style={{ backgroundColor: liftColor(p.lift) }}
                >
                  Lift: {p.lift}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Chart + Bundling suggestion */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-slate-500 tracking-widest flex items-center gap-2">
              <TrendingUp size={12} /> Co-occurrence frequency
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[200px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.08} />
                  <XAxis type="number" fontSize={9} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" fontSize={9} axisLine={false} tickLine={false} width={80} />
                  <Tooltip formatter={(v: number, name: string) => [name === 'support' ? `${v} txns` : name === 'confidence' ? `${v}%` : v, name]} />
                  <Bar dataKey="support" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No data</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-dashed border-2 border-indigo-200 bg-indigo-50/40 dark:bg-indigo-950/40 border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
              <Tag size={14} /> Bundling Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-indigo-600 dark:text-indigo-400 leading-relaxed">
              Items with <strong>Lift &gt; 1.5</strong> are strong bundle candidates.
              A "Combo Discount" of 5–8% can increase average basket size by 18–24%.
            </p>
            {pairs.filter(p => p.lift >= 1.5).slice(0, 3).map((p, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-indigo-100 flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-white">{p.pair}</p>
                  <p className="text-[10px] text-indigo-500">Lift {p.lift} · Confidence {p.confidence}%</p>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Bundle</Badge>
              </div>
            ))}
            {pairs.filter(p => p.lift >= 1.5).length === 0 && (
              <p className="text-xs text-slate-400 italic">No strong bundles detected yet. More transaction data needed.</p>
            )}
            <Button size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold h-9">
              <Zap size={12} className="mr-1" /> GENERATE COMBO COUPON
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BasketAnalysis;