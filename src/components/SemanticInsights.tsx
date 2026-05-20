import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrainCircuit } from 'lucide-react';
import { getTopSemanticIssues } from '@/lib/semanticInsights';

// Define the interface for better TypeScript support
interface SemanticIssue {
  tag: string;
  count: number;
}

const SemanticInsights = () => {
  const [issues, setIssues] = useState<SemanticIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInsights = async () => {
      try {
        setLoading(true);
        const data = await getTopSemanticIssues();
        setIssues(data || []);
      } catch (error) {
        console.error("Failed to load semantic insights", error);
      } finally {
        setLoading(false);
      }
    };

    loadInsights();
  }, []);

  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <BrainCircuit className="h-5 w-5 text-purple-600" />
          Semantic Retail Intelligence
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-sm text-slate-500 animate-pulse">Analyzing semantic patterns...</div>
        ) : issues.length === 0 ? (
          <div className="text-sm text-slate-500">No semantic patterns detected yet.</div>
        ) : (
          issues.map((issue, index) => (
            <div
              key={index}
              className="border rounded-lg p-3 flex justify-between items-center hover:bg-slate-50 transition-colors"
            >
              <div>
                <p className="font-medium text-sm text-slate-800 capitalize">
                  {issue.tag.replace(/-/g, ' ')}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  AI detected recurring operational pattern
                </p>
              </div>
              <div className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-full whitespace-nowrap ml-2">
                {issue.count} matches
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default SemanticInsights;