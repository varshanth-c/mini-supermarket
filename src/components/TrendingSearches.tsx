import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Search } from 'lucide-react';
import { getTrendingSearches } from '@/lib/recommendationEngine';

// Optional: Define a type for your trending items for better TypeScript support
interface TrendingItem {
  query: string;
  count: number;
}

const TrendingSearches = () => {
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTrending = async () => {
      try {
        const data = await getTrendingSearches();
        setTrending(data || []);
      } catch (error) {
        console.error("Failed to load trending searches", error);
      } finally {
        setLoading(false);
      }
    };

    loadTrending();
  }, []);

  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <TrendingUp className="h-5 w-5 text-indigo-600" />
          Trending Retail Searches
        </CardTitle>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-sm text-slate-500 animate-pulse">Loading trends...</div>
        ) : trending.length === 0 ? (
          <div className="text-sm text-slate-500">No trending searches yet.</div>
        ) : (
          <div className="space-y-3">
            {trending.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between border rounded-lg p-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Search className="h-4 w-4 text-slate-400" />
                  <p className="font-medium text-sm text-slate-800">
                    {item.query}
                  </p>
                </div>
                <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                  {item.count} searches
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TrendingSearches;