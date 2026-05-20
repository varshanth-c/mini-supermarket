import {
  useEffect,
  useState,
} from 'react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import {
  Badge,
} from '@/components/ui/badge';

import {
  BrainCircuit,
  AlertTriangle,
  TrendingUp,
  Package,
  DollarSign,
  Lightbulb,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

import {
  motion,
} from 'framer-motion';

import {
  useAuth,
} from '@/contexts/AuthContext';

import {
  buildRetailAIContext,
} from '@/lib/aiContext';

interface Insight {
  type: string;
  title: string;
  description: string;
  severity: string;
}

const AIExecutiveInsights =
  () => {

    const {
      profile,
    } = useAuth();

    const [insights,
      setInsights] =
        useState<Insight[]>([]);

    const [loading,
      setLoading] =
        useState(true);

    useEffect(() => {

      const generateInsights =
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
              Insight[] = [];

            // LOW STOCK
            if (
              context.lowStock.length > 0
            ) {

              generated.push({

                type:
                  'inventory',

                title:
                  'Critical Inventory Risk',

                description:
                  `${context.lowStock.length} items are critically low in stock. AI recommends immediate reorder planning.`,

                severity:
                  'high',
              });
            }

            // FRESHNESS
            if (
              context.freshnessAlerts.length > 0
            ) {

              generated.push({

                type:
                  'freshness',

                title:
                  'Freshness Degradation Detected',

                description:
                  `${context.freshnessAlerts.length} products are showing spoilage indicators. AI recommends discount optimization.`,

                severity:
                  'high',
              });
            }

            // REVENUE
            if (
              context.businessMetrics.totalRevenue > 50000
            ) {

              generated.push({

                type:
                  'sales',

                title:
                  'Revenue Momentum Positive',

                description:
                  `Revenue performance is strong. AI suggests expanding high-demand inventory.`,

                severity:
                  'medium',
              });
            }

            // SUPPLIERS
            if (
              context.supplierData.length < 3
            ) {

              generated.push({

                type:
                  'supplier',

                title:
                  'Supplier Diversity Low',

                description:
                  'AI detected dependency risk due to low supplier diversification.',

                severity:
                  'medium',
              });
            }

            // WASTE
            if (
              context.wasteData.length > 5
            ) {

              generated.push({

                type:
                  'waste',

                title:
                  'Waste Trend Increasing',

                description:
                  'AI identified rising spoilage incidents. Consider dynamic pricing optimization.',

                severity:
                  'high',
              });
            }

            // OPPORTUNITY
            generated.push({

              type:
                'opportunity',

              title:
                'AI Growth Opportunity',

              description:
                'Customer search patterns suggest growing interest in healthy and protein-rich products.',

              severity:
                'low',
            });

            setInsights(
              generated
            );

          } catch (error) {

            console.error(error);

          } finally {

            setLoading(false);
          }
        };

      generateInsights();

    }, [profile?.shop_id]);

  const getIcon =
    (type: string) => {

      switch (type) {

        case 'inventory':
          return (
            <Package className="h-5 w-5 text-orange-500" />
          );

        case 'freshness':
          return (
            <AlertTriangle className="h-5 w-5 text-red-500" />
          );

        case 'sales':
          return (
            <TrendingUp className="h-5 w-5 text-green-500" />
          );

        case 'supplier':
          return (
            <ShieldAlert className="h-5 w-5 text-yellow-500" />
          );

        case 'waste':
          return (
            <BrainCircuit className="h-5 w-5 text-pink-500" />
          );

        default:
          return (
            <Sparkles className="h-5 w-5 text-primary" />
          );
      }
    };

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

  if (loading) {

    return (

      <Card>

        <CardContent className="p-8 text-center">

          <BrainCircuit className="h-10 w-10 mx-auto mb-4 animate-pulse text-primary" />

          <p>
            AI generating strategic insights...
          </p>

        </CardContent>

      </Card>
    );
  }

  return (

    <Card>

      <CardHeader>

        <CardTitle className="flex items-center gap-2">

          <BrainCircuit className="h-6 w-6 text-primary" />

          Autonomous AI Executive Insights

        </CardTitle>

      </CardHeader>

      <CardContent className="space-y-4">

        {insights.map(
          (insight, index) => (

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
              transition={{
                delay: index * 0.1,
              }}
              className="border rounded-xl p-5 bg-card"
            >

              <div className="flex items-start justify-between mb-3">

                <div className="flex items-center gap-3">

                  {getIcon(
                    insight.type
                  )}

                  <div>

                    <h3 className="font-semibold text-lg">
                      {insight.title}
                    </h3>

                  </div>

                </div>

                {getSeverityBadge(
                  insight.severity
                )}

              </div>

              <p className="text-muted-foreground leading-relaxed">
                {insight.description}
              </p>

            </motion.div>
          )
        )}

      </CardContent>

    </Card>
  );
};

export default AIExecutiveInsights;