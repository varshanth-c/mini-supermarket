import { useEffect, useMemo, useRef, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  BrainCircuit,
  Send,
  Sparkles,
  TrendingUp,
  Users,
  Package,
  Lightbulb,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

// NEW: Centralized Enterprise RAG Pipeline
import { runEnterpriseRAG, indexShopData } from '@/lib/EnterpriseAI';

import { getTrendingSearches, getVendorRecommendations } from '@/lib/recommendationEngine';
import { getTopSemanticIssues } from '@/lib/semanticInsights';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const quickPrompts = [
  'Why are profits decreasing this week?',
  'Which products should I reorder urgently?',
  'What inventory is causing waste?',
  'Which items are trending recently?',
  'How can I optimize supplier costs?',
  'What products have low demand?',
];

const RAGKnowledgeEngine = () => {
  const { profile, user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [trending, setTrending] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [semanticInsights, setSemanticInsights] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      const trends = await getTrendingSearches();
      setTrending(trends);

      if (profile?.shop_id) {
        const vendorInsights = await getVendorRecommendations(profile.shop_id);
        setRecommendations(vendorInsights);
      }

      const semantic = await getTopSemanticIssues();
      setSemanticInsights(semantic);
    };

    loadData();
  }, [profile?.shop_id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // NEW: Refactored to use Enterprise RAG
  const generateResponse = async (question: string) => {
    if (!profile?.shop_id || !user?.id) return;

    setLoading(true);

    try {
      const result = await runEnterpriseRAG({
        shopId: profile.shop_id,
        userId: user.id,
        query: question,
      });

      setMessages(prev => [
        ...prev,
        {
          role: 'user',
          content: question,
        },
        {
          role: 'assistant',
          content: result.response,
        },
      ]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const question = input;
    setInput('');

    await generateResponse(question);
  };

  const businessHealth = useMemo(() => {
    const issueCount = semanticInsights.length;
    if (issueCount <= 2) return 'Excellent';
    if (issueCount <= 5) return 'Good';
    return 'Needs Attention';
  }, [semanticInsights]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto p-6">
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-2xl bg-primary/10">
              <BrainCircuit className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">
                Enterprise Business AI Advisor
              </h1>
              <p className="text-muted-foreground text-lg">
                Centralized Retail Intelligence System
              </p>
            </div>
          </div>
        </motion.div>

        {/* AI HEALTH CARDS */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">AI Health</p>
                  <h2 className="text-2xl font-bold">{businessHealth}</h2>
                </div>
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Trending Searches
                  </p>
                  <h2 className="text-2xl font-bold">{trending.length}</h2>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Semantic Insights
                  </p>
                  <h2 className="text-2xl font-bold">
                    {semanticInsights.length}
                  </h2>
                </div>
                <Lightbulb className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Vendor Intelligence
                  </p>
                  <h2 className="text-2xl font-bold">
                    {recommendations.length}
                  </h2>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* LEFT SIDEBAR */}
          <div className="space-y-6">
            {/* QUICK PROMPTS */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Quick Business Queries
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {quickPrompts.map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-3 whitespace-normal"
                    onClick={() => generateResponse(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* TRENDING */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Trending Retail Searches
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {trending.map((item, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{item.query}</p>
                      <Badge>{item.count}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* VENDOR INTELLIGENCE */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Collaborative Vendor Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recommendations.map((item, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{item.query}</p>
                        <p className="text-xs text-muted-foreground">
                          Similar vendors searched this
                        </p>
                      </div>
                      <Badge variant="secondary">{item.count}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* CHAT AREA */}
          <div className="lg:col-span-3">
            <Card className="h-[850px] flex flex-col">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5" />
                    Retail Intelligence Chat
                  </CardTitle>
                  
                  {/* NEW: Updated Buttons Area */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={loading}
                      onClick={async () => {
                        if (!profile?.shop_id) return;
                        setLoading(true);
                        
                        await indexShopData(profile.shop_id);
                        
                        setLoading(false);
                        setMessages(prev => [
                          ...prev,
                          {
                            role: 'assistant',
                            content: `✅ Enterprise vector indexing completed.\n\nInventory, suppliers, and sales data are now semantically searchable through the AI intelligence engine.`,
                          },
                        ]);
                      }}
                    >
                      <Package className="h-4 w-4 mr-2" />
                      Index Knowledge Base
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMessages([])}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reset
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col p-0">
                {/* CHAT SCROLL AREA */}
                <ScrollArea className="flex-1 p-6" ref={scrollRef}>
                  <div className="space-y-6">
                    <AnimatePresence>
                      {messages.length === 0 && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-center py-20"
                        >
                          <BrainCircuit className="h-20 w-20 mx-auto mb-6 text-primary opacity-70" />
                          <h2 className="text-2xl font-bold mb-3">
                            Enterprise Retail Intelligence
                          </h2>
                          <p className="text-muted-foreground max-w-2xl mx-auto">
                            Ask advanced operational, inventory, supplier, profitability, demand, forecasting, and retail strategy questions.
                          </p>
                        </motion.div>
                      )}

                      {messages.map((message, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${
                            message.role === 'user' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-5 py-4 whitespace-pre-wrap ${
                              message.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            {message.content}
                          </div>
                        </motion.div>
                      ))}

                      {loading && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex justify-start"
                        >
                          <div className="bg-muted rounded-2xl px-5 py-4">
                            <div className="flex items-center gap-3">
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              <span>AI analyzing retail intelligence...</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </ScrollArea>

                {/* INPUT AREA */}
                <div className="border-t p-4">
                  <div className="flex gap-3">
                    <Input
                      placeholder="Ask advanced retail business questions..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSend();
                        }
                      }}
                    />
                    <Button onClick={handleSend} disabled={loading}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RAGKnowledgeEngine;