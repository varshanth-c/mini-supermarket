// ============================================================
// CustomerDashboard.tsx — AI-Powered Customer Intelligence
// ============================================================
import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, subDays } from 'date-fns';
import {
  ArrowRight, ShoppingCart, Sparkles, TrendingUp, Package,
  Star, Clock, Leaf, Flame, ChevronRight, MessageSquare,
  BarChart2, Gift, Heart, RefreshCw, ShoppingBag
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────
interface PastOrder {
  id: string;
  created_at: string;
  total_amount: number;
  items: any;
}

interface InventoryItem {
  id: string;
  item_name: string;
  category: string;
  unit_price: number;
  quantity: number;
  image_url?: string | null;
}

// ── Helpers ───────────────────────────────────────────────
const parseItems = (items: any): any[] => {
  if (Array.isArray(items)) return items;
  if (typeof items === 'string') { try { return JSON.parse(items); } catch { return []; } }
  return [];
};

const formatCurrency = (v: number) =>
  `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// ── Main Component ────────────────────────────────────────
const CustomerDashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<'recommended' | 'deals' | 'trending'>('recommended');

  // ── FIX 1: Fetch past orders (Shop Isolated & Schema Fixed) ──
  const { data: pastOrders = [] } = useQuery<PastOrder[]>({
    queryKey: ['customerOrders', user?.id, profile?.shop_id],
    queryFn: async () => {
      if (!user || !profile?.shop_id) return [];
      const { data } = await supabase
        .from('sales')
        .select('id, created_at, total_amount, items')
        .eq('created_by', user.id) // FIXED: Changed from user_id to created_by
        .eq('shop_id', profile.shop_id) // CURRENT shop isolation
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user && !!profile?.shop_id,
  });

  // ── FIX 2: Fetch inventory (Shop Isolated) ──
  const { data: inventory = [] } = useQuery<InventoryItem[]>({
    queryKey: ['customerInventory', profile?.shop_id],
    queryFn: async () => {
      if (!profile?.shop_id) return [];
      const { data } = await supabase
        .from('inventory')
        .select('id, item_name, category, unit_price, quantity, image_url')
        .eq('shop_id', profile.shop_id) // Multi-shop security fix
        .gt('quantity', 0)
        .order('item_name');
      return data || [];
    },
    enabled: !!profile?.shop_id,
  });

  // ── Computed stats (Loyalty & Spending) ──
  const stats = useMemo(() => {
    const totalSpent = pastOrders.reduce((s, o) => s + Number(o.total_amount), 0);
    const totalOrders = pastOrders.length;
    const last30 = pastOrders.filter(o => new Date(o.created_at) > subDays(new Date(), 30));
    const last30Spent = last30.reduce((s, o) => s + Number(o.total_amount), 0);

    const itemCounts: Record<string, { count: number; price: number }> = {};
    pastOrders.forEach(order => {
      parseItems(order.items).forEach((item: any) => {
        if (!itemCounts[item.item_name]) itemCounts[item.item_name] = { count: 0, price: item.unit_price };
        itemCounts[item.item_name].count += item.cart_quantity || 1;
      });
    });
    const topItems = Object.entries(itemCounts).sort((a, b) => b[1].count - a[1].count).slice(0, 5);

    const catCounts: Record<string, number> = {};
    pastOrders.forEach(order => {
      parseItems(order.items).forEach((item: any) => {
        const cat = item.category || 'Other';
        catCounts[cat] = (catCounts[cat] || 0) + 1;
      });
    });
    const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const loyaltyLevel = totalOrders >= 20 ? 'Gold' : totalOrders >= 10 ? 'Silver' : 'Bronze';
    const loyaltyNext = totalOrders >= 20 ? 20 : totalOrders >= 10 ? 20 : 10;
    const loyaltyProgress = Math.min((totalOrders / loyaltyNext) * 100, 100);

    return { totalSpent, totalOrders, last30Spent, topItems, topCategory, loyaltyLevel, loyaltyNext, loyaltyProgress };
  }, [pastOrders]);

  // ── AI Recommendations ──
  const recommended = useMemo(() => {
    if (!stats.topCategory) return inventory.slice(0, 6);
    const fromTopCat = inventory.filter(i => i.category === stats.topCategory);
    const others = inventory.filter(i => i.category !== stats.topCategory);
    return [...fromTopCat, ...others].slice(0, 6);
  }, [inventory, stats.topCategory]);

  const trending = useMemo(() => [...inventory].sort((a, b) => b.unit_price - a.unit_price).slice(0, 6), [inventory]);
  const freshDeals = useMemo(() => inventory.filter(i => i.quantity <= 20 && i.quantity > 0).slice(0, 6), [inventory]);

  const reorderItems = useMemo(() => {
    return stats.topItems
      .map(([name]) => inventory.find(i => i.item_name === name))
      .filter(Boolean)
      .slice(0, 4) as InventoryItem[];
  }, [stats.topItems, inventory]);

  const handleAddToCart = (item: InventoryItem) => {
    navigate(`/sales?add=${item.id}`);
  };

  const displayItems = 
    activeSection === 'recommended' ? recommended : 
    activeSection === 'deals' ? freshDeals : 
    trending;

  // FIX 3: Profile Name consistency
  const customerName = profile?.full_name || user?.email?.split('@')[0] || 'Shopper';
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';

  const loyaltyColors = {
    Bronze: 'text-amber-700 bg-amber-50 border-amber-200',
    Silver: 'text-slate-600 bg-slate-50 border-slate-200',
    Gold:   'text-yellow-600 bg-yellow-50 border-yellow-200',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        
        {/* Hero Welcome */}
        <motion.div 
          initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl overflow-hidden mb-8 bg-gradient-to-r from-indigo-600 to-violet-800 text-white p-8"
        >
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="text-indigo-200 text-sm font-medium mb-1">{greeting} 👋</div>
              <h1 className="text-3xl font-bold mb-2">{customerName}</h1>
              <p className="text-indigo-100 text-sm max-w-md opacity-90">
                {stats.totalOrders === 0 
                  ? "Welcome to our store! Explore our fresh products and AI-powered deals."
                  : `You've saved ₹${(stats.totalSpent * 0.05).toFixed(0)} with us so far. Here are your personalized picks.`}
              </p>
              {stats.topCategory && (
                <div className="mt-3 inline-flex items-center gap-1 bg-white/20 rounded-full px-3 py-1 text-xs">
                  <Heart className="h-3 w-3 fill-current" /> Favorite Category: {stats.topCategory}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button size="lg" className="bg-white text-indigo-700 hover:bg-white/90 font-bold rounded-xl" onClick={() => navigate('/sales')}>
                <ShoppingCart className="h-4 w-4 mr-2" /> Start Shopping
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 rounded-xl" onClick={() => navigate('/ai-assistant')}>
                <Sparkles className="h-4 w-4 mr-2" /> Ask AI
              </Button>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        </motion.div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={ShoppingBag} label="Total Orders" value={stats.totalOrders} color="bg-blue-500" />
          <StatCard icon={TrendingUp} label="Total Spent" value={formatCurrency(stats.totalSpent)} color="bg-indigo-500" />
          <StatCard icon={BarChart2} label="Spent (30d)" value={formatCurrency(stats.last30Spent)} color="bg-violet-500" />
          <StatCard icon={Package} label="Items in Store" value={inventory.length} color="bg-cyan-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Loyalty Level */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Star className="h-4 w-4 text-yellow-500" /> Loyalty Status</CardTitle></CardHeader>
            <CardContent>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border font-bold text-xs mb-4 ${loyaltyColors[stats.loyaltyLevel as keyof typeof loyaltyColors]}`}>
                <Gift className="h-3 w-3" /> {stats.loyaltyLevel} Member
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{stats.totalOrders} orders</span>
                  <span>{stats.loyaltyNext} for next level</span>
                </div>
                <Progress value={stats.loyaltyProgress} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Quick Buy Again */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><RefreshCw className="h-4 w-4 text-green-500" /> Buy Again</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {reorderItems.length > 0 ? reorderItems.map(item => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded bg-gray-100 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-gray-400">IMG</div>
                    <span className="text-sm truncate font-medium">{item.item_name}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="text-xs text-indigo-600 hover:text-indigo-700 h-7" onClick={() => handleAddToCart(item)}>Add</Button>
                </div>
              )) : <p className="text-xs text-center text-gray-400 py-4">No recent items to show.</p>}
            </CardContent>
          </Card>

          {/* AI Shopping Assistant Card */}
          <Card className="border-0 shadow-sm bg-indigo-50 border-l-4 border-indigo-500">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm mb-2"><Sparkles className="h-4 w-4" /> AI SHOPPING ASSISTANT</div>
              <p className="text-xs text-indigo-600 leading-relaxed mb-4">"I can help you find products, suggest recipes, or check which items are currently freshest."</p>
              <Button size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => navigate('/ai-assistant')}>Chat Now</Button>
            </CardContent>
          </Card>
        </div>

        {/* Product Filtering Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Recommended for You</h2>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              {['recommended', 'deals', 'trending'].map((sec) => (
                <button 
                  key={sec} 
                  onClick={() => setActiveSection(sec as any)}
                  className={`px-4 py-1.5 text-xs rounded-md transition-all ${activeSection === sec ? 'bg-white shadow-sm font-bold' : 'text-gray-500'}`}
                >
                  {sec.charAt(0).toUpperCase() + sec.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {displayItems.map((item) => (
              <ProductCard key={item.id} item={item} onAdd={handleAddToCart} />
            ))}
          </div>
        </div>

        {/* Recent Orders Timeline */}
        {pastOrders.length > 0 && (
          <Card className="border-0 shadow-sm mb-8">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-gray-500" /> Recent Purchase History</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {pastOrders.slice(0, 3).map(order => (
                <div key={order.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-indigo-100 rounded-full"><ShoppingBag className="h-4 w-4 text-indigo-600" /></div>
                    <div>
                      <p className="text-sm font-bold">{parseItems(order.items).length} items purchased</p>
                      <p className="text-[10px] text-gray-400">{format(parseISO(order.created_at), 'dd MMM yyyy, hh:mm a')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(Number(order.total_amount))}</p>
                    <Badge variant="outline" className="text-[9px] uppercase border-green-200 text-green-600">Verified</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Floating AI Bubble */}
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="fixed bottom-6 right-6 z-50">
        <Button size="lg" className="h-14 w-14 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-xl" onClick={() => navigate('/ai-assistant')}>
          <MessageSquare className="h-6 w-6" />
        </Button>
      </motion.div>
    </div>
  );
};

// ── Sub-Components ────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color }: any) => (
  <Card className="border-0 shadow-sm">
    <CardContent className="p-4">
      <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center mb-3`}><Icon className="h-4 w-4 text-white" /></div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{label}</div>
    </CardContent>
  </Card>
);

const ProductCard = ({ item, onAdd }: { item: InventoryItem; onAdd: (item: InventoryItem) => void; }) => (
  <Card className="overflow-hidden border-0 shadow-sm group h-full">
    <div className="h-32 bg-gray-100 relative flex items-center justify-center text-[10px] font-bold text-gray-400 uppercase">
       Product Image
       {item.quantity <= 10 && <span className="absolute top-2 right-2 bg-red-500 text-white px-2 py-0.5 rounded text-[8px]">Low Stock</span>}
    </div>
    <CardContent className="p-3">
      <p className="text-xs font-bold truncate mb-1">{item.item_name}</p>
      <div className="flex items-center justify-between">
        <span className="text-sm font-black text-indigo-600">₹{item.unit_price}</span>
        <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-full border-indigo-200 text-indigo-600" onClick={() => onAdd(item)}>+</Button>
      </div>
    </CardContent>
  </Card>
);

export default CustomerDashboard;