import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { Navbar }
from '@/components/Navbar';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import {
  Button,
} from '@/components/ui/button';

import {
  Badge,
} from '@/components/ui/badge';

import {
  Input,
} from '@/components/ui/input';

import {
  motion,
} from 'framer-motion';

import {
  useAuth,
} from '@/contexts/AuthContext';

import {
  supabase,
} from '@/integrations/supabase/client';

import {
  buildRetailAIContext,
} from '@/lib/aiContext';

import {
  Truck,
  Package,
  AlertTriangle,
  BrainCircuit,
  TrendingUp,
  ShieldAlert,
  DollarSign,
  Sparkles,
  RefreshCw,
  Factory,
  ShoppingCart,
} from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  category: string;
  rating: number;
  contact_email: string;
}

interface Recommendation {
  title: string;
  description: string;
  severity: string;
}

const Suppliers = () => {

  const {
    profile,
  } = useAuth();

  const [suppliers,
    setSuppliers] =
      useState<Supplier[]>([]);

  const [loading,
    setLoading] =
      useState(true);

  const [recommendations,
    setRecommendations] =
      useState<Recommendation[]>([]);

  const [newSupplier,
    setNewSupplier] =
      useState({
        name: '',
        category: '',
        email: '',
      });

  const loadSuppliers =
    async () => {

      if (
        !profile?.shop_id
      ) return;

      try {

        const { data } =
          await supabase
            .from('suppliers')
            .select('*')
            .eq(
              'shop_id',
              profile.shop_id
            );

        setSuppliers(
          data || []
        );

      } catch (error) {

        console.error(error);

      } finally {

        setLoading(false);
      }
    };

  const generateAIRecommendations =
    async () => {

      if (
        !profile?.shop_id
      ) return;

      try {

        const context =
          await buildRetailAIContext(
            profile.shop_id
          );

        const generated:
          Recommendation[] = [];

        // LOW STOCK
        if (
          context.lowStock.length > 0
        ) {

          generated.push({

            title:
              'Urgent Reorder Required',

            description:
              `${context.lowStock.length} inventory items are critically low. AI recommends immediate procurement planning.`,

            severity:
              'high',
          });
        }

        // SUPPLIER RISK
        if (
          context.supplierData.length < 2
        ) {

          generated.push({

            title:
              'Supplier Dependency Risk',

            description:
              'AI detected insufficient supplier diversity. Add backup suppliers to reduce operational risk.',

            severity:
              'medium',
          });
        }

        // WASTE
        if (
          context.wasteData.length > 5
        ) {

          generated.push({

            title:
              'Procurement Waste Alert',

            description:
              'Repeated spoilage incidents detected. AI recommends reducing reorder quantities temporarily.',

            severity:
              'high',
          });
        }

        // SALES TREND
        if (
          context.businessMetrics.totalOrders > 20
        ) {

          generated.push({

            title:
              'Demand Growth Opportunity',

            description:
              'Order trends increasing. AI recommends negotiating bulk supplier pricing.',

            severity:
              'low',
          });
        }

        // FRESHNESS
        if (
          context.freshnessAlerts.length > 3
        ) {

          generated.push({

            title:
              'Freshness Supplier Issue',

            description:
              'Freshness degradation indicates possible supplier quality issues.',

            severity:
              'medium',
          });
        }

        setRecommendations(
          generated
        );

      } catch (error) {

        console.error(error);
      }
    };

  useEffect(() => {

    loadSuppliers();

    generateAIRecommendations();

  }, [profile?.shop_id]);

  const addSupplier =
    async () => {

      if (
        !profile?.shop_id
      ) return;

      try {

        await supabase
          .from('suppliers')
          .insert({

            shop_id:
              profile.shop_id,

            name:
              newSupplier.name,

            category:
              newSupplier.category,

            contact_email:
              newSupplier.email,

            rating: 4,
          });

        setNewSupplier({
          name: '',
          category: '',
          email: '',
        });

        loadSuppliers();

      } catch (error) {

        console.error(error);
      }
    };

  const procurementHealth =
    useMemo(() => {

      if (
        recommendations.filter(
          r =>
            r.severity === 'high'
        ).length === 0
      ) {
        return 'Excellent';
      }

      if (
        recommendations.filter(
          r =>
            r.severity === 'high'
        ).length <= 2
      ) {
        return 'Stable';
      }

      return 'Risk Detected';

    }, [recommendations]);

  const getSeverityBadge =
    (severity: string) => {

      switch (severity) {

        case 'high':
          return (
            <Badge variant="destructive">
              High
            </Badge>
          );

        case 'medium':
          return (
            <Badge variant="secondary">
              Medium
            </Badge>
          );

        default:
          return (
            <Badge>
              Low
            </Badge>
          );
      }
    };

  return (

    <div className="min-h-screen bg-background">

      <Navbar />

      <div className="container mx-auto p-6">

        {/* HEADER */}

        <motion.div
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="mb-8"
        >

          <div className="flex items-center gap-4">

            <div className="p-3 rounded-2xl bg-primary/10">

              <Truck className="h-10 w-10 text-primary" />

            </div>

            <div>

              <h1 className="text-4xl font-bold">
                AI Procurement Intelligence
              </h1>

              <p className="text-muted-foreground text-lg">
                Smart Supplier & Reorder Optimization
              </p>

            </div>

          </div>

        </motion.div>

        {/* METRICS */}

        <div className="grid md:grid-cols-4 gap-4 mb-8">

          <Card>

            <CardContent className="p-5">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-sm text-muted-foreground">
                    Procurement Health
                  </p>

                  <h2 className="text-2xl font-bold">
                    {procurementHealth}
                  </h2>

                </div>

                <BrainCircuit className="h-8 w-8 text-primary" />

              </div>

            </CardContent>

          </Card>

          <Card>

            <CardContent className="p-5">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-sm text-muted-foreground">
                    Suppliers
                  </p>

                  <h2 className="text-2xl font-bold">
                    {suppliers.length}
                  </h2>

                </div>

                <Factory className="h-8 w-8 text-blue-500" />

              </div>

            </CardContent>

          </Card>

          <Card>

            <CardContent className="p-5">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-sm text-muted-foreground">
                    AI Recommendations
                  </p>

                  <h2 className="text-2xl font-bold">
                    {recommendations.length}
                  </h2>

                </div>

                <Sparkles className="h-8 w-8 text-yellow-500" />

              </div>

            </CardContent>

          </Card>

          <Card>

            <CardContent className="p-5">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-sm text-muted-foreground">
                    Risk Alerts
                  </p>

                  <h2 className="text-2xl font-bold">
                    {
                      recommendations.filter(
                        r =>
                          r.severity === 'high'
                      ).length
                    }
                  </h2>

                </div>

                <AlertTriangle className="h-8 w-8 text-red-500" />

              </div>

            </CardContent>

          </Card>

        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* SUPPLIERS */}

          <div className="lg:col-span-2">

            <Card>

              <CardHeader>

                <CardTitle className="flex items-center gap-2">

                  <Factory className="h-5 w-5" />

                  Supplier Network

                </CardTitle>

              </CardHeader>

              <CardContent className="space-y-4">

                {suppliers.map(
                  (supplier) => (

                    <motion.div
                      key={supplier.id}
                      initial={{
                        opacity: 0,
                        y: 10,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      className="border rounded-xl p-5"
                    >

                      <div className="flex items-center justify-between mb-3">

                        <div>

                          <h3 className="font-semibold text-lg">
                            {supplier.name}
                          </h3>

                          <p className="text-muted-foreground">
                            {supplier.category}
                          </p>

                        </div>

                        <Badge>
                          ⭐ {supplier.rating}
                        </Badge>

                      </div>

                      <p className="text-sm">
                        {supplier.contact_email}
                      </p>

                    </motion.div>
                  )
                )}

              </CardContent>

            </Card>

          </div>

          {/* AI PROCUREMENT ENGINE */}

          <div className="space-y-6">

            {/* ADD SUPPLIER */}

            <Card>

              <CardHeader>

                <CardTitle>
                  Add Supplier
                </CardTitle>

              </CardHeader>

              <CardContent className="space-y-4">

                <Input
                  placeholder="Supplier Name"
                  value={newSupplier.name}
                  onChange={(e) =>
                    setNewSupplier({
                      ...newSupplier,
                      name:
                        e.target.value,
                    })
                  }
                />

                <Input
                  placeholder="Category"
                  value={newSupplier.category}
                  onChange={(e) =>
                    setNewSupplier({
                      ...newSupplier,
                      category:
                        e.target.value,
                    })
                  }
                />

                <Input
                  placeholder="Email"
                  value={newSupplier.email}
                  onChange={(e) =>
                    setNewSupplier({
                      ...newSupplier,
                      email:
                        e.target.value,
                    })
                  }
                />

                <Button
                  className="w-full"
                  onClick={addSupplier}
                >

                  Add Supplier

                </Button>

              </CardContent>

            </Card>

            {/* AI INSIGHTS */}

            <Card>

              <CardHeader>

                <CardTitle className="flex items-center gap-2">

                  <BrainCircuit className="h-5 w-5" />

                  AI Procurement Intelligence

                </CardTitle>

              </CardHeader>

              <CardContent className="space-y-4">

                {recommendations.map(
                  (item, index) => (

                    <motion.div
                      key={index}
                      initial={{
                        opacity: 0,
                        y: 10,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      className="border rounded-xl p-4"
                    >

                      <div className="flex items-start justify-between mb-3">

                        <h3 className="font-semibold">
                          {item.title}
                        </h3>

                        {getSeverityBadge(
                          item.severity
                        )}

                      </div>

                      <p className="text-sm text-muted-foreground">
                        {item.description}
                      </p>

                    </motion.div>
                  )
                )}

              </CardContent>

            </Card>

          </div>

        </div>

      </div>

    </div>
  );
};

export default Suppliers;