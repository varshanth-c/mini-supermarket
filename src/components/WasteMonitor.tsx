// ============================================================
// WasteMonitor.tsx
// Module 6 — Freshness Decay Model + Waste Prevention Analytics
// Formula: score = max(0, (1 − days_old/shelf_life) × 100)
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
  Tooltip, CartesianGrid, Cell, RadialBarChart, RadialBar, PolarAngleAxis
} from 'recharts';
import { freshnessScore } from '@/lib/mlEngine';
import {
  Leaf, AlertTriangle, CheckCircle2, Clock, PackageX, Recycle, RefreshCw
} from 'lucide-react';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

// Default shelf lives (days) — override from DB if available
const DEFAULT_SHELF_LIVES: Record<string, number> = {
  milk: 3, bread: 5, eggs: 21, 'fresh vegetables': 7, 'fresh fruits': 10,
  paneer: 7, curd: 5, butter: 30, cheese: 60, chicken: 2, fish: 1, mutton: 2,
  dal: 365, rice: 365, wheat: 365, atta: 180, sugar: 730, salt: 1825,
  oil: 365, tea: 730, coffee: 730, biscuits: 120, chips: 90, noodles: 180,
  soap: 1095, detergent: 1095, shampoo: 730, toothpaste: 730,
};

function guessShelfLife(itemName: string): number {
  const lower = itemName.toLowerCase();
  for (const [key, val] of Object.entries(DEFAULT_SHELF_LIVES)) {
    if (lower.includes(key)) return val;
  }
  return 180; // default: 6 months for unknowns
}

const tierColor: Record<string, string> = {
  critical: '#ef4444',
  warning: '#f59e0b',
  good: '#10b981',
};

const tierBg: Record<string, string> = {
  critical: 'bg-red-50 dark:bg-red-950 border-red-200',
  warning: 'bg-amber-50 dark:bg-amber-950 border-amber-200',
  good: 'bg-emerald-50 dark:bg-emerald-950 border-emerald-100',
};

const WasteMonitor: React.FC = () => {
  const { profile } = useAuth();
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning'>('all');

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['waste-inventory', profile?.shop_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('id, item_name, quantity, cost_price, unit_price, low_stock_threshold, freshness_score, created_at, updated_at')
        .eq('shop_id', profile?.shop_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.shop_id,
    refetchInterval: 30000, // refresh every 30s for "real-time" feel
  });

  const { enriched, stats } = useMemo(() => {
    const now = new Date();

    const enriched = inventory.map(item => {
      // Use DB freshness_score if available, else compute from created_at
      let score: number, tier: 'critical' | 'warning' | 'good', daysLeft: number, wasteValue: number;

      if (item.freshness_score !== null && item.freshness_score !== undefined) {
        score = Math.round(Number(item.freshness_score));
        tier = score < 30 ? 'critical' : score < 60 ? 'warning' : 'good';
        const shelfLife = guessShelfLife(item.item_name);
        daysLeft = Math.round(shelfLife * (score / 100));
        wasteValue = Math.round(Number(item.cost_price || 0) * item.quantity * (1 - score / 100) * 0.45);
      } else {
        const created = new Date(item.created_at);
        const daysOld = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        const shelfLife = guessShelfLife(item.item_name);
        const result = freshnessScore(daysOld, shelfLife, item.quantity, Number(item.cost_price || 0));
        score = result.score;
        tier = result.tier;
        daysLeft = result.daysLeft;
        wasteValue = result.wasteValue;
      }

      return {
        ...item,
        score,
        tier,
        daysLeft,
        wasteValue,
        cost: Number(item.cost_price || 0),
      };
    }).sort((a, b) => a.score - b.score);

    const critical = enriched.filter(i => i.tier === 'critical');
    const warning = enriched.filter(i => i.tier === 'warning');
    const totalWasteRisk = enriched.reduce((s, i) => s + i.wasteValue, 0);
    const recoverable = Math.round(totalWasteRisk * 0.6);
    const avgFreshness = enriched.length
      ? Math.round(enriched.reduce((s, i) => s + i.score, 0) / enriched.length)
      : 0;

    return {
      enriched,
      stats: { critical: critical.length, warning: warning.length, totalWasteRisk, recoverable, avgFreshness },
    };
  }, [inventory]);

  const displayed = enriched.filter(i =>
    filter === 'all' ? true : i.tier === filter
  );

  const chartData = enriched.slice(0, 12).map(i => ({
    name: i.item_name.length > 10 ? i.item_name.slice(0, 10) + '…' : i.item_name,
    score: i.score,
    tier: i.tier,
  }));

  if (isLoading) {
    return (
      <Card className="border-none shadow-sm">
        <CardContent className="flex items-center justify-center h-48">
          <RefreshCw className="animate-spin text-emerald-500 mr-2" />
          <span className="text-sm text-muted-foreground">Computing freshness scores...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-red-50 dark:bg-red-950">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={14} className="text-red-500" />
              <p className="text-[10px] font-black uppercase text-red-400 tracking-widest">Critical Items</p>
            </div>
            <p className="text-3xl font-black text-red-600">{stats.critical}</p>
            <p className="text-[10px] text-red-400 mt-1">Freshness &lt; 30%</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-amber-50 dark:bg-amber-950">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} className="text-amber-500" />
              <p className="text-[10px] font-black uppercase text-amber-400 tracking-widest">Warning Zone</p>
            </div>
            <p className="text-3xl font-black text-amber-600">{stats.warning}</p>
            <p className="text-[10px] text-amber-400 mt-1">Freshness 30–60%</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <PackageX size={14} className="text-rose-400" />
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Waste at Risk</p>
            </div>
            <p className="text-2xl font-black text-rose-600">{formatCurrency(stats.totalWasteRisk)}</p>
            <p className="text-[10px] text-slate-400 mt-1">Est. loss value</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-emerald-50 dark:bg-emerald-950">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Recycle size={14} className="text-emerald-500" />
              <p className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">Recoverable</p>
            </div>
            <p className="text-2xl font-black text-emerald-600">{formatCurrency(stats.recoverable)}</p>
            <p className="text-[10px] text-emerald-400 mt-1">Via markdown pricing</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart + Radial */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2 border-none shadow-sm">
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-xs font-bold uppercase text-slate-500 tracking-widest flex items-center gap-2">
              <Leaf size={14} className="text-emerald-500" />
              Freshness Scores by SKU
              <Badge className="bg-slate-100 text-slate-600 text-[10px] ml-1">Decay Model</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[220px] pt-4">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.08} />
                  <XAxis dataKey="name" fontSize={8} axisLine={false} tickLine={false} angle={-35} textAnchor="end" height={48} />
                  <YAxis fontSize={9} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Freshness']} />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={32}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={tierColor[entry.tier]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                No inventory data found.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-xs font-bold uppercase text-slate-500 tracking-widest">Overall Health</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center pt-4">
            <div className="relative h-[150px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%" cy="70%"
                  innerRadius="60%" outerRadius="90%"
                  startAngle={180} endAngle={0}
                  data={[{ value: stats.avgFreshness, fill: stats.avgFreshness > 60 ? '#10b981' : stats.avgFreshness > 30 ? '#f59e0b' : '#ef4444' }]}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar dataKey="value" cornerRadius={6} background={{ fill: '#f1f5f9' }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                <span className="text-3xl font-black">{stats.avgFreshness}%</span>
                <span className="text-[10px] text-slate-400">Avg Freshness</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 w-full mt-4 text-center">
              {(['good', 'warning', 'critical'] as const).map(tier => (
                <div key={tier}>
                  <div className="text-xs font-black" style={{ color: tierColor[tier] }}>
                    {enriched.filter(i => i.tier === tier).length}
                  </div>
                  <div className="text-[9px] text-slate-400 capitalize">{tier}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-[10px] text-slate-500 text-center leading-snug w-full">
              Score = (1 − days_old / shelf_life) × 100
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert List */}
      <Card className="border-none shadow-sm">
        <CardHeader className="border-b pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-xs font-bold uppercase text-slate-500 tracking-widest flex items-center gap-2">
              <AlertTriangle size={14} className="text-rose-500" /> Expiry Alerts — Real-Time
            </CardTitle>
            <div className="flex gap-2">
              {(['all', 'critical', 'warning'] as const).map(f => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? 'default' : 'outline'}
                  className="h-7 text-[10px] font-bold px-3"
                  onClick={() => setFilter(f)}
                >
                  {f.toUpperCase()} {f !== 'all' && `(${enriched.filter(i => i.tier === f).length})`}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-2 max-h-80 overflow-y-auto">
          {displayed.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-600 py-4">
              <CheckCircle2 size={16} /> All items in {filter} category look healthy!
            </div>
          ) : displayed.map((item, i) => (
            <div key={item.id || i} className={`flex items-center gap-3 p-3 rounded-xl border ${tierBg[item.tier]}`}>
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                style={{ backgroundColor: tierColor[item.tier] }}
              >
                {item.score}%
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{item.item_name}</p>
                <p className="text-[10px] text-slate-500">
                  {item.quantity} units · {item.daysLeft} days remaining
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] font-black text-rose-500 uppercase">Waste Risk</p>
                <p className="text-sm font-black text-indigo-600">{formatCurrency(item.wasteValue)}</p>
              </div>
              {item.tier === 'critical' && (
                <Badge className="bg-red-100 text-red-600 text-[9px] font-bold hidden md:block">
                  MARKDOWN NOW
                </Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default WasteMonitor;