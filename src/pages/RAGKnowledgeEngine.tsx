import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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

import { runEnterpriseRAG, indexShopData, loadChatHistory } from '@/lib/EnterpriseAI';
import { getTrendingSearches, getVendorRecommendations } from '@/lib/recommendationEngine';
import { getTopSemanticIssues } from '@/lib/semanticInsights';

// ============================================================
// Inline markdown renderer (bold, bullets, numbered lists)
// ============================================================
const MarkdownText = ({ content }: { content: string }) => {
  const renderLine = (line: string, idx: number) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });

    if (line.match(/^[-•]\s/)) {
      return (
        <li key={idx} className="ml-4 list-disc">
          {rendered}
        </li>
      );
    }
    if (line.match(/^\d+\.\s/)) {
      return (
        <li key={idx} className="ml-4 list-decimal">
          {rendered}
        </li>
      );
    }
    if (line.trim() === '') {
      return <div key={idx} className="h-2" />;
    }
    return <p key={idx}>{rendered}</p>;
  };

  return (
    <div className="space-y-0.5 text-sm leading-relaxed">
      {content.split('\n').map((line, idx) => renderLine(line, idx))}
    </div>
  );
};

// ============================================================
// Types
// ============================================================
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// ============================================================
// Session storage helpers — persists across tab switches & page
// focus changes, but clears when browser tab is fully closed.
// Cross-session persistence comes from Supabase (loadChatHistory).
// ============================================================
const SESSION_KEY = 'rag_chat_messages';

function saveMessagesToSession(messages: Message[]) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));
  } catch {
    // quota exceeded — ignore
  }
}

function loadMessagesFromSession(): Message[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Message[]) : [];
  } catch {
    return [];
  }
}

// ============================================================
// Helpers
// ============================================================
/** Deduplicate messages by id, preserving order */
function dedupeMessages(msgs: Message[]): Message[] {
  const seen = new Set<string>();
  return msgs.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

/** Convert Supabase history rows → Message pairs with stable, unique ids */
function historyToMessages(
  history: Array<{ question: string; response: string; created_at: string }>
): Message[] {
  const msgs: Message[] = [];
  history.forEach((entry, idx) => {
    // Use created_at + idx for uniqueness; fall back to idx alone if date is missing
    const base = entry.created_at
      ? `${new Date(entry.created_at).getTime()}-${idx}`
      : `fallback-${idx}`;

    msgs.push({
      id: `history-user-${base}`,
      role: 'user',
      content: entry.question,
      timestamp: entry.created_at ? new Date(entry.created_at).getTime() : idx,
    });
    msgs.push({
      id: `history-ai-${base}`,
      role: 'assistant',
      content: entry.response,
      timestamp: entry.created_at ? new Date(entry.created_at).getTime() + 1 : idx + 0.5,
    });
  });
  return msgs;
}

// ============================================================
// Quick prompts
// ============================================================
const quickPrompts = [
  'Why are profits decreasing this week?',
  'Which products should I reorder urgently?',
  'What inventory is causing waste?',
  'Which items are trending recently?',
  'How can I optimize supplier costs?',
  'What products have low demand?',
];

// ============================================================
// Component
// ============================================================
const RAGKnowledgeEngine = () => {
  const { profile, user } = useAuth();

  // ✅ FIX: Initialize from sessionStorage immediately so tab-switching
  // never blanks the chat. Supabase history is merged in on first load.
  const [messages, setMessages] = useState<Message[]>(() => loadMessagesFromSession());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [trending, setTrending] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [semanticInsights, setSemanticInsights] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track whether we've already merged Supabase history this session
  const historyMergedRef = useRef(false);

  // ✅ FIX: Persist messages to sessionStorage on every change
  useEffect(() => {
    saveMessagesToSession(messages);
  }, [messages]);

  // ============================================================
  // Init: load sidebar data + merge Supabase history once
  // ============================================================
  useEffect(() => {
    const init = async () => {
      // Sidebar data (no auth needed)
      const [trends, semantic] = await Promise.all([
        getTrendingSearches(),
        getTopSemanticIssues(),
      ]);
      setTrending(trends);
      setSemanticInsights(semantic);

      if (!profile?.shop_id || !user?.id) {
        setHistoryLoading(false);
        return;
      }

      // Vendor recommendations
      const vendorInsights = await getVendorRecommendations(profile.shop_id);
      setRecommendations(vendorInsights);

      // ✅ Only merge Supabase history once per browser session
      if (!historyMergedRef.current) {
        historyMergedRef.current = true;

        const history = await loadChatHistory({
          shopId: profile.shop_id,
          userId: user.id,
          limit: 40,
        });

        if (history.length > 0) {
          const dbMessages = historyToMessages(history);
          // Merge: put DB history first, then any in-session messages not yet in DB
          setMessages((prev) => dedupeMessages([...dbMessages, ...prev]));
        }
      }

      setHistoryLoading(false);
    };

    init();
  }, [profile?.shop_id, user?.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ============================================================
  // Send a message
  // ============================================================
  const generateResponse = useCallback(
    async (question: string) => {
      if (!profile?.shop_id || !user?.id) return;

      const userMsg: Message = {
        // ✅ FIX: crypto.randomUUID() guarantees uniqueness — no duplicates
        id: `user-${crypto.randomUUID()}`,
        role: 'user',
        content: question,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const result = await runEnterpriseRAG({
          shopId: profile.shop_id,
          userId: user.id,
          query: question,
        });

        const aiMsg: Message = {
          id: `ai-${crypto.randomUUID()}`,
          role: 'assistant',
          content: result.response,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch (error) {
        console.error(error);
        const errMsg: Message = {
          id: `err-${crypto.randomUUID()}`,
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setLoading(false);
      }
    },
    [profile?.shop_id, user?.id]
  );

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput('');
    await generateResponse(question);
  };

  const handleReset = () => {
    setMessages([]);
    sessionStorage.removeItem(SESSION_KEY);
  };

  const businessHealth = useMemo(() => {
    const issueCount = semanticInsights.length;
    if (issueCount <= 2) return 'Excellent';
    if (issueCount <= 5) return 'Good';
    return 'Needs Attention';
  }, [semanticInsights]);

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-6">

        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-2xl bg-primary/10">
              <BrainCircuit className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">Enterprise Business AI Advisor</h1>
              <p className="text-muted-foreground text-lg">Centralized Retail Intelligence System</p>
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
                  <p className="text-sm text-muted-foreground">Trending Searches</p>
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
                  <p className="text-sm text-muted-foreground">Semantic Insights</p>
                  <h2 className="text-2xl font-bold">{semanticInsights.length}</h2>
                </div>
                <Lightbulb className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Vendor Intelligence</p>
                  <h2 className="text-2xl font-bold">{recommendations.length}</h2>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* LEFT SIDEBAR */}
          <div className="space-y-6">
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
                    disabled={loading}
                  >
                    {prompt}
                  </Button>
                ))}
              </CardContent>
            </Card>

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
                        <p className="text-xs text-muted-foreground">Similar vendors searched this</p>
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
                    {!historyLoading && messages.length > 0 && (
                      <Badge variant="secondary" className="text-xs ml-2">
                        {Math.floor(messages.length / 2)} Q&amp;As
                      </Badge>
                    )}
                  </CardTitle>
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
                        const sysMsg: Message = {
                          id: `sys-index-${crypto.randomUUID()}`,
                          role: 'assistant',
                          content: `✅ Enterprise vector indexing completed.\n\nInventory, suppliers, and sales data are now semantically searchable through the AI intelligence engine.`,
                          timestamp: Date.now(),
                        };
                        setMessages((prev) => [...prev, sysMsg]);
                      }}
                    >
                      <Package className="h-4 w-4 mr-2" />
                      Index Knowledge Base
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reset
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col p-0 min-h-0">
                <ScrollArea className="flex-1 p-6" ref={scrollRef}>
                  <div className="space-y-6">
                    {historyLoading ? (
                      <div className="text-center py-20 text-muted-foreground">
                        <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin opacity-50" />
                        <p>Loading your conversation history...</p>
                      </div>
                    ) : (
                      <AnimatePresence initial={false}>
                        {messages.length === 0 && (
                          <motion.div
                            key="empty-state"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-center py-20"
                          >
                            <BrainCircuit className="h-20 w-20 mx-auto mb-6 text-primary opacity-70" />
                            <h2 className="text-2xl font-bold mb-3">Enterprise Retail Intelligence</h2>
                            <p className="text-muted-foreground max-w-2xl mx-auto">
                              Ask advanced operational, inventory, supplier, profitability, demand,
                              forecasting, and retail strategy questions.
                            </p>
                          </motion.div>
                        )}

                        {/* ✅ FIX: message.id is always unique — no duplicate key warnings */}
                        {messages.map((message) => (
                          <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-5 py-4 ${
                                message.role === 'user'
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              }`}
                            >
                              {message.role === 'assistant' ? (
                                <MarkdownText content={message.content} />
                              ) : (
                                <p className="text-sm">{message.content}</p>
                              )}
                            </div>
                          </motion.div>
                        ))}

                        {loading && (
                          <motion.div
                            key="loading-indicator"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex justify-start"
                          >
                            <div className="bg-muted rounded-2xl px-5 py-4">
                              <div className="flex items-center gap-3">
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                <span className="text-sm">AI analyzing retail intelligence...</span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}
                  </div>
                </ScrollArea>

                <div className="border-t p-4 flex-shrink-0">
                  <div className="flex gap-3">
                    <Input
                      placeholder="Ask advanced retail business questions..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      disabled={loading || historyLoading}
                    />
                    <Button onClick={handleSend} disabled={loading || historyLoading || !input.trim()}>
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