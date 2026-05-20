import {
  useEffect,
  useMemo,
  useRef,
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
  Input,
} from '@/components/ui/input';

import {
  Badge,
} from '@/components/ui/badge';

import {
  ScrollArea,
} from '@/components/ui/scroll-area';

import {
  BrainCircuit,
  ShoppingCart,
  Sparkles,
  Send,
  RefreshCw,
  TrendingUp,
  Apple,
  DollarSign,
  Heart,
  Zap,
  Star,
  Package,
} from 'lucide-react';

import {
  motion,
  AnimatePresence,
} from 'framer-motion';

import {
  useAuth,
} from '@/contexts/AuthContext';

import {
  buildRetailAIContext,
} from '@/lib/aiContext';

import {
  buildCustomerPrompt,
} from '@/lib/aiPrompts';

import {
  askGroq,
} from '@/lib/groq';

import {
  saveAIMemory,
  saveSearchHistory,
} from '@/lib/aiMemory';

import {
  getTrendingSearches,
  getVendorRecommendations,
} from '@/lib/recommendationEngine';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const quickShoppingPrompts = [
  'Healthy snacks under ₹200',
  'Best fresh fruits today',
  'Protein rich breakfast ideas',
  'Low sugar products',
  'Budget friendly family shopping',
  'Best products for summer',
];

const AIShoppingAssistant = () => {

  const {
    profile,
    user,
  } = useAuth();

  const [messages,
    setMessages] =
      useState<Message[]>([]);

  const [input,
    setInput] =
      useState('');

  const [loading,
    setLoading] =
      useState(false);

  const [trending,
    setTrending] =
      useState<any[]>([]);

  const [recommendations,
    setRecommendations] =
      useState<any[]>([]);

  const scrollRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {

    const loadData =
      async () => {

        const trends =
          await getTrendingSearches();

        setTrending(trends);

        if (profile?.shop_id) {

          const recs =
            await getVendorRecommendations(
              profile.shop_id
            );

          setRecommendations(recs);
        }
      };

    loadData();

  }, [profile?.shop_id]);

  useEffect(() => {

    if (scrollRef.current) {

      scrollRef.current.scrollTop =
        scrollRef.current.scrollHeight;
    }

  }, [messages]);

  const shoppingHealth =
    useMemo(() => {

      if (
        recommendations.length >= 6
      ) return 'Excellent';

      if (
        recommendations.length >= 3
      ) return 'Good';

      return 'Growing';

    }, [recommendations]);

  const generateResponse =
    async (
      question: string
    ) => {

      if (
        !profile?.shop_id ||
        !user?.id
      ) return;

      setLoading(true);

      try {

        // Centralized AI Context
        const context =
          await buildRetailAIContext(
            profile.shop_id
          );

        // Customer AI Prompt
        const prompt =
          buildCustomerPrompt(
            question,
            context
          );

        // Ask Groq
        const aiResponse =
          await askGroq(prompt);

        // Save AI Memory
        await saveAIMemory({

          shopId:
            profile.shop_id,

          userId:
            user.id,

          module:
            'customer_ai',

          question,

          response:
            aiResponse,
        });

        // Save Search History
        await saveSearchHistory({

          shopId:
            profile.shop_id,

          userId:
            user.id,

          module:
            'customer_ai',

          query:
            question,

          category:
            'shopping',
        });

        setMessages(prev => [

          ...prev,

          {
            role: 'user',
            content: question,
          },

          {
            role: 'assistant',
            content: aiResponse,
          },
        ]);

      } catch (error) {

        console.error(error);

      } finally {

        setLoading(false);
      }
    };

  const handleSend =
    async () => {

      if (!input.trim())
        return;

      const question =
        input;

      setInput('');

      await generateResponse(
        question
      );
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

          <div className="flex items-center gap-4 mb-4">

            <div className="p-3 rounded-2xl bg-primary/10">

              <ShoppingCart className="h-10 w-10 text-primary" />

            </div>

            <div>

              <h1 className="text-4xl font-bold">
                AI Shopping Intelligence
              </h1>

              <p className="text-muted-foreground text-lg">
                Personalized Smart Shopping Assistant
              </p>

            </div>

          </div>

        </motion.div>

        {/* DASHBOARD CARDS */}

        <div className="grid md:grid-cols-4 gap-4 mb-8">

          <Card>

            <CardContent className="p-5">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-sm text-muted-foreground">
                    Shopping AI
                  </p>

                  <h2 className="text-2xl font-bold">
                    {shoppingHealth}
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
                    Trending Searches
                  </p>

                  <h2 className="text-2xl font-bold">
                    {trending.length}
                  </h2>

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
                    Smart Recommendations
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
                    Personalized AI
                  </p>

                  <h2 className="text-2xl font-bold">
                    Active
                  </h2>

                </div>

                <Heart className="h-8 w-8 text-pink-500" />

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
                  <Zap className="h-5 w-5" />
                  Smart Shopping Queries
                </CardTitle>

              </CardHeader>

              <CardContent className="space-y-3">

                {quickShoppingPrompts.map(
                  (prompt, index) => (

                    <Button
                      key={index}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3"
                      onClick={() =>
                        generateResponse(prompt)
                      }
                    >

                      {prompt}

                    </Button>
                  )
                )}

              </CardContent>

            </Card>

            {/* TRENDING */}

            <Card>

              <CardHeader>

                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Trending Shopping Searches
                </CardTitle>

              </CardHeader>

              <CardContent className="space-y-3">

                {trending.map(
                  (item, index) => (

                    <div
                      key={index}
                      className="border rounded-lg p-3"
                    >

                      <div className="flex items-center justify-between">

                        <p className="font-medium">
                          {item.query}
                        </p>

                        <Badge>
                          {item.count}
                        </Badge>

                      </div>

                    </div>
                  )
                )}

              </CardContent>

            </Card>

            {/* SMART RECOMMENDATIONS */}

            <Card>

              <CardHeader>

                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  AI Shopping Trends
                </CardTitle>

              </CardHeader>

              <CardContent className="space-y-3">

                {recommendations.map(
                  (item, index) => (

                    <div
                      key={index}
                      className="border rounded-lg p-3"
                    >

                      <div className="flex items-center justify-between">

                        <div>

                          <p className="font-medium">
                            {item.query}
                          </p>

                          <p className="text-xs text-muted-foreground">
                            Popular customer interest
                          </p>

                        </div>

                        <Badge variant="secondary">
                          {item.count}
                        </Badge>

                      </div>

                    </div>
                  )
                )}

              </CardContent>

            </Card>

          </div>

          {/* CHAT SECTION */}

          <div className="lg:col-span-3">

            <Card className="h-[850px] flex flex-col">

              <CardHeader className="border-b">

                <div className="flex items-center justify-between">

                  <CardTitle className="flex items-center gap-2">

                    <BrainCircuit className="h-5 w-5" />

                    Personalized Shopping AI

                  </CardTitle>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setMessages([])
                    }
                  >

                    <RefreshCw className="h-4 w-4 mr-2" />

                    Reset

                  </Button>

                </div>

              </CardHeader>

              <CardContent className="flex-1 flex flex-col p-0">

                {/* CHAT */}

                <ScrollArea
                  className="flex-1 p-6"
                  ref={scrollRef}
                >

                  <div className="space-y-6">

                    <AnimatePresence>

                      {messages.length === 0 && (

                        <motion.div
                          initial={{
                            opacity: 0,
                          }}
                          animate={{
                            opacity: 1,
                          }}
                          className="text-center py-20"
                        >

                          <ShoppingCart className="h-20 w-20 mx-auto mb-6 text-primary opacity-70" />

                          <h2 className="text-2xl font-bold mb-3">
                            Personalized Shopping Intelligence
                          </h2>

                          <p className="text-muted-foreground max-w-2xl mx-auto">
                            Ask for healthy foods, budget shopping,
                            recipes, fresh products, family shopping,
                            seasonal items, and personalized
                            recommendations.
                          </p>

                        </motion.div>
                      )}

                      {messages.map(
                        (message, index) => (

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
                            className={`flex ${
                              message.role === 'user'
                                ? 'justify-end'
                                : 'justify-start'
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
                        )
                      )}

                      {loading && (

                        <motion.div
                          initial={{
                            opacity: 0,
                          }}
                          animate={{
                            opacity: 1,
                          }}
                          className="flex justify-start"
                        >

                          <div className="bg-muted rounded-2xl px-5 py-4">

                            <div className="flex items-center gap-3">

                              <RefreshCw className="h-4 w-4 animate-spin" />

                              <span>
                                AI generating shopping intelligence...
                              </span>

                            </div>

                          </div>

                        </motion.div>
                      )}

                    </AnimatePresence>

                  </div>

                </ScrollArea>

                {/* INPUT */}

                <div className="border-t p-4">

                  <div className="flex gap-3">

                    <Input
                      placeholder="Ask smart shopping questions..."
                      value={input}
                      onChange={(e) =>
                        setInput(
                          e.target.value
                        )
                      }
                      onKeyDown={(e) => {

                        if (
                          e.key === 'Enter'
                        ) {
                          handleSend();
                        }
                      }}
                    />

                    <Button
                      onClick={handleSend}
                      disabled={loading}
                    >

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

export default AIShoppingAssistant;