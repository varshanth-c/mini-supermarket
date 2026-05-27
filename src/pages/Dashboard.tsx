import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import {
  Package, TrendingUp, DollarSign, FileText, ShoppingCart, Receipt,
  Banknote, ShieldCheck, Users, Loader2, UserCheck, UserX, Briefcase,
  Leaf, Bot, Truck
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Json } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// ── Types ─────────────────────────────────────────────────
interface Profile {
  id: string; 
  email: string | null; 
  phone: string | null;
  role: 'shop_admin' | 'staff' | 'customer' | null; 
  name: string | null;
  shop_id: string | null;
}

// ── Helpers ───────────────────────────────────────────────
const parseSaleItems = (items: Json): any[] => {
  if (Array.isArray(items)) return items;
  if (typeof items === 'string') { try { return JSON.parse(items); } catch { return []; } }
  return [];
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

const getTimeAgo = (date: Date) => {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)   return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const SkeletonCard = () => (
  <Card className="border-0 shadow-sm dark:bg-gray-900">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 animate-pulse" />
      <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
    </CardHeader>
    <CardContent>
      <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/2 mb-1 animate-pulse" />
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse" />
    </CardContent>
  </Card>
);

// ── Dashboard ─────────────────────────────────────────────
const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // FIX 1: New Auth Hook Signature
  const { user, profile } = useAuth();
  const role = profile?.role;
  const isShopAdmin = role === 'shop_admin';
  const isStaff = role === 'staff';

  const [searchPhone, setSearchPhone]   = useState('');
  const [foundUser, setFoundUser]       = useState<Profile | null>(null);
  const [isSearching, setIsSearching]   = useState(false);
  const [searchMessage, setSearchMessage] = useState('');

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startDate = thirtyDaysAgo.toISOString();

  // FIX 2: Sales Query (Multi-shop isolation)
  const { data: salesData = [], isLoading: isSalesLoading } = useQuery({
    queryKey: ['dashboardSales', profile?.shop_id],
    queryFn: async () => {
      if (!profile?.shop_id) return [];
      const { data, error } = await supabase
        .from('sales')
        .select(`items, total_amount, created_at, customer_name`)
        .eq('shop_id', profile.shop_id)
        .gte('created_at', startDate);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.shop_id,
  });

  // FIX 3: Inventory Query (Multi-shop isolation)
  const { data: inventoryData = [], isLoading: isInventoryLoading } = useQuery({
    queryKey: ['dashboardInventory', profile?.shop_id],
    queryFn: async () => {
      if (!profile?.shop_id) return [];
      const { data, error } = await supabase
        .from('inventory')
        .select(`id, cost_price, freshness_score, freshness_action, ai_recommended_price, discount_percent`)
        .eq('shop_id', profile.shop_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.shop_id,
  });

  // FIX 4: Expense Query (Multi-shop isolation)
  const { data: expensesData = [], isLoading: isExpensesLoading } = useQuery({
    queryKey: ['dashboardExpenses', profile?.shop_id],
    queryFn: async () => {
      if (!profile?.shop_id) return [];
      const { data, error } = await supabase
        .from('expenses')
        .select('amount')
        .eq('shop_id', profile.shop_id)
        .gte('date', startDate.split('T')[0]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.shop_id,
  });

  // ── Calculations ─────────────────────────────────────
  const dashboardData = useMemo(() => {
    const totalRevenue  = salesData.reduce((s: number, sale: any) => s + Number(sale.total_amount), 0);
    const totalExpenses = expensesData.reduce((s: number, exp: any) => s + Number(exp.amount), 0);
    const inventoryMap  = new Map((inventoryData as any[]).map(i => [i.id, i.cost_price]));
    
    const totalCOGS = salesData.reduce((s: number, sale: any) => {
      const items = parseSaleItems(sale.items);
      return s + items.reduce((is: number, si: any) => is + (Number(inventoryMap.get(si.id) || 0) * (si.cart_quantity || 1)), 0);
    }, 0);

    const netProfit = totalRevenue - totalCOGS - totalExpenses;

    const recentActivity = [...salesData]
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map((sale: any) => ({
        description: `Sale to ${sale.customer_name || 'Customer'}`,
        amount: Number(sale.total_amount),
        date: new Date(sale.created_at),
      }));

    return { totalRevenue, totalCOGS, totalExpenses, netProfit, recentActivity };
  }, [salesData, inventoryData, expensesData]);

  const isLoading = isSalesLoading || isInventoryLoading || isExpensesLoading;

  // FIX 7: User Management with correct role strings
  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (u) => {
      setFoundUser(u);
      toast({ title: 'Role updated', description: `${u.name || u.email} → ${u.role}` });
    },
    onError: (e: any) => toast({ title: 'Update failed', description: e.message, variant: 'destructive' }),
  });

  const handleSearchUser = async () => {
    if (!searchPhone) { setSearchMessage('Enter a phone number.'); return; }
    setIsSearching(true);
    setFoundUser(null);
    setSearchMessage('');
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', searchPhone)
      .single();
    if (error) setSearchMessage(error.code === 'PGRST116' ? 'No user found.' : error.message);
    else setFoundUser(data);
    setIsSearching(false);
  };

  // ── Card visibility ──────────────────────────────────
  const statsCards = [
    { title: 'Revenue',      value: formatCurrency(dashboardData.totalRevenue),  icon: TrendingUp, color: 'text-green-600'  },
    { title: 'Cost of Goods',value: formatCurrency(dashboardData.totalCOGS),      icon: Receipt,    color: 'text-orange-600' },
    { title: 'Expenses',     value: formatCurrency(dashboardData.totalExpenses), icon: Banknote,   color: 'text-red-600'    },
    { title: 'Net Profit',   value: formatCurrency(dashboardData.netProfit),      icon: DollarSign, color: dashboardData.netProfit >= 0 ? 'text-blue-600' : 'text-red-600' },
  ];
  
  const displayStats = isStaff ? statsCards.slice(0, 2) : statsCards;

  const quickActions = [
    { name: 'inventory', title: 'Manage Inventory', description: 'Add, edit or view stock', icon: Package, path: '/inventory', color: 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 border-blue-200 dark:border-blue-800'   },
    { name: 'freshness', title: 'Freshness AI', description: 'Scan perishable items', icon: Leaf, path: '/freshness-monitor', color: 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 border-green-200 dark:border-green-800' },
    { name: 'advisor', title: 'AI Advisor', description: 'Ask business questions', icon: Bot, path: '/ai-advisor', color: 'bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border-indigo-200 dark:border-indigo-800' },
    { name: 'pos', title: 'Point of Sale', description: 'Create new transactions', icon: ShoppingCart, path: '/sales', color: 'bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 border-purple-200 dark:border-purple-800' },
    { name: 'expense', title: 'Suppliers', description: 'Manage procurement', icon: Truck, path: '/expense', color: 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 border-amber-200 dark:border-amber-800'   },
    { name: 'reports', title: 'Reports', description: 'Analytics + forecasting', icon: FileText, path: '/reports', color: 'bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 border-rose-200 dark:border-rose-800' },
  ];

  const displayActions = isStaff ? quickActions.filter(a => ['inventory', 'freshness', 'pos'].includes(a.name)) : quickActions;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <div className="container mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
              {isStaff ? 'Staff Panel' : 'Business Dashboard'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {isShopAdmin ? "Store Analytics & Operations" : "Operational overview"}
            </p>
          </div>
          <Badge variant="default" className={isStaff ? 'bg-blue-600' : 'bg-indigo-600'}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            {role === 'shop_admin' ? 'Shop Admin' : role === 'staff' ? 'Staff' : 'Customer'}
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {displayStats.map((card, i) => (
            <Card key={i} className="border-0 shadow-sm hover:shadow-lg transition-shadow dark:bg-gray-900">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">{card.title}</CardTitle>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{card.value}</div>
                <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action Grid & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Core Modules</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayActions.map((action, i) => (
                <Card
                  key={i}
                  className={`cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg ${action.color}`}
                  onClick={() => navigate(action.path)}
                >
                  <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                    <action.icon className="h-8 w-8" />
                    <div>
                      <CardTitle className="text-base">{action.title}</CardTitle>
                      <CardDescription>{action.description}</CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>

            {/* FIX 7: User Management UI */}
            {isShopAdmin && (
              <div className="mt-8">
                <Card className="border-0 shadow-sm dark:bg-gray-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Users className="text-indigo-500" /> Shop User Management
                    </CardTitle>
                    <CardDescription>Assign roles for your shop employees.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 max-w-sm">
                      <Input
                        type="tel"
                        placeholder="Search user by phone..."
                        value={searchPhone}
                        onChange={e => setSearchPhone(e.target.value)}
                      />
                      <Button onClick={handleSearchUser} disabled={isSearching}>
                        {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                      </Button>
                    </div>
                    {foundUser && (
                      <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <p className="font-bold">{foundUser.name || 'Anonymous User'}</p>
                        <p className="text-sm text-gray-500">{foundUser.email}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => updateUserRoleMutation.mutate({ userId: foundUser.id, newRole: 'shop_admin' })}>
                             Make Admin
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => updateUserRoleMutation.mutate({ userId: foundUser.id, newRole: 'staff' })}>
                             Make Staff
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => updateUserRoleMutation.mutate({ userId: foundUser.id, newRole: 'customer' })}>
                             Remove Access
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          <div>
            <Card className="border-0 shadow-sm dark:bg-gray-900 h-full">
              <CardHeader>
                <CardTitle className="text-lg">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboardData.recentActivity.map((a, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-full">
                          <ShoppingCart className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{a.description}</p>
                          <p className="text-xs text-gray-500">{getTimeAgo(a.date)}</p>
                        </div>
                      </div>
                      <span className="font-semibold text-green-600">+{formatCurrency(a.amount)}</span>
                    </div>
                  ))}
                  {dashboardData.recentActivity.length === 0 && (
                    <p className="text-center text-gray-500 py-8 text-sm">No activity recorded.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;