import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { getCollaborativeInsights } from '@/lib/collaborativeAI';
import { useAuth } from '@/contexts/AuthContext';

// Define the interface for better TypeScript support
interface InsightItem {
  query: string;
  count: number;
}

const CollaborativeInsights = () => {
  const { profile } = useAuth();
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInsights = async () => {
      // Don't try to fetch if the shop_id isn't loaded yet
      if (!profile?.shop_id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await getCollaborativeInsights(profile.shop_id);
        setInsights(data || []);
      } catch (error) {
        console.error("Failed to load collaborative insights", error);
      } finally {
        setLoading(false);
      }
    };

    loadInsights();
  }, [profile?.shop_id]);

  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <Users className="h-5 w-5 text-indigo-600" />
          Vendor Intelligence
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-sm text-slate-500 animate-pulse">Loading vendor insights...</div>
        ) : insights.length === 0 ? (
          <div className="text-sm text-slate-500">No collaborative insights available yet.</div>
        ) : (
          insights.map((item, index) => (
            <div
              key={index}
              className="border rounded-lg p-3 flex justify-between items-center hover:bg-slate-50 transition-colors"
            >
              <div>
                <p className="font-medium text-sm text-slate-800">
                  {item.query}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Similar vendors searched this frequently
                </p>
              </div>
              <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full whitespace-nowrap ml-2">
                {item.count} searches
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default CollaborativeInsights;