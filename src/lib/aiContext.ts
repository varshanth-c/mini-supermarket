import { supabase } from '@/integrations/supabase/client';

export interface RetailAIContext {
  inventory: any[];
  lowStock: any[];
  freshnessAlerts: any[];
  recentSales: any[];
  supplierData: any[];
  wasteData: any[];

  businessMetrics: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
  };
}

export const buildRetailAIContext = async (
  shopId: string
): Promise<RetailAIContext> => {

  // Inventory
  const inventoryRes = await supabase
    .from('inventory')
    .select('*')
    .eq('shop_id', shopId);

  // Sales
  const salesRes = await supabase
    .from('sales')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', {
      ascending: false,
    })
    .limit(50);

  // Suppliers
  const supplierRes = await supabase
    .from('suppliers')
    .select('*')
    .eq('shop_id', shopId);

  // Waste Logs
  const wasteRes = await supabase
    .from('waste_log')
    .select('*')
    .eq('shop_id', shopId)
    .order('logged_at', {
      ascending: false,
    })
    .limit(30);

  const inventory =
    inventoryRes.data || [];

  const sales =
    salesRes.data || [];

  const suppliers =
    supplierRes.data || [];

  const wasteLogs =
    wasteRes.data || [];

  // Low Stock
  const lowStock = inventory.filter(
    (item) =>
      item.quantity <=
      (item.low_stock_threshold || 5)
  );

  // Freshness Alerts
  const freshnessAlerts =
    inventory.filter(
      (item) =>
        item.freshness_score &&
        item.freshness_score < 50
    );

  // Revenue
  const totalRevenue =
    sales.reduce(
      (sum, sale) =>
        sum +
        Number(
          sale.total_amount || 0
        ),
      0
    );

  const totalOrders =
    sales.length;

  const averageOrderValue =
    totalOrders > 0
      ? totalRevenue /
        totalOrders
      : 0;

  return {
    inventory,
    lowStock,
    freshnessAlerts,
    recentSales: sales,
    supplierData: suppliers,
    wasteData: wasteLogs,

    businessMetrics: {
      totalRevenue,
      totalOrders,
      averageOrderValue,
    },
  };
};