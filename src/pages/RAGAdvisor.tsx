// ============================================================
// RAGAdvisor.tsx — AI Business Advisor (Member 2 module)
// ============================================================
// This is the core RAG integration for the supermarket.
// Architecture: Multi-shop isolation using shop_id
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Send, Loader2, Bot, User, Sparkles,
  Package, ShoppingCart, AlertTriangle, RefreshCw,
  MessageSquare, Database
} from 'lucide-react';

// ── Config ────────────────────────────────────────────────
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';

// ── Types ─────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface StoreContext {
  inventory:      any[];
  recentSales:    any[];
  lowStock:       any[];
  freshScans:     any[];
  monthExpenses: number;
  totalRevenue:  number;
  topItems:      string[];
}

// ── Suggested questions ───────────────────────────────────
const SUGGESTED = [
  "Which items have the best profit margin right now?",
  "What should I reorder today based on current stock?",
  "Which perishables need urgent attention?",
  "How was my revenue this week compared to last week?",
  "Suggest a discount strategy for near-spoilage stock",
  "What are my top 3 selling items this month?",
];

// ── Build live store context from Supabase data ───────────
function buildContextPrompt(ctx: StoreContext): string {
  const inventoryText = ctx.inventory
    .slice(0, 40)
    .map(i => `  - ${i.item_name} (${i.category}): qty=${i.quantity}, price=₹${i.unit_price}, cost=₹${i.cost_price || 'N/A'}${i.freshness_score ? `, freshness=${i.freshness_score}%` : ''}`)
    .join('\n');

  const salesText = ctx.recentSales
    .slice(0, 10)
    .map(s => `  - ₹${s.total_amount} on ${new Date(s.created_at).toLocaleDateString('en-IN')} to ${s.customer_name || 'Customer'}`)
    .join('\n');

  const lowStockText = ctx.lowStock
    .map(i => `  - ${i.item_name}: only ${i.quantity} units left`)
    .join('\n') || '  None currently';

  return `
You are an AI business advisor for a supermarket. You ONLY answer based on the live store data below.
If data is insufficient, say so clearly. Do not make up numbers.
Be concise, actionable, and specific to this store's actual data.
Use ₹ for currency. Today is ${new Date().toLocaleDateString('en-IN')}.

=== LIVE STORE DATA ===
INVENTORY:
${inventoryText}

RECENT SALES (Last 30 days):
  Total revenue: ₹${ctx.totalRevenue.toLocaleString('en-IN')}
  Top items: ${ctx.topItems.join(', ') || 'N/A'}
${salesText}

LOW STOCK ALERTS:
${lowStockText}

EXPENSES THIS MONTH: ₹${ctx.monthExpenses.toLocaleString('en-IN')}
=== END STORE DATA ===
`.trim();
}

// ── FIX 2 & 3 & 4 & 5: Updated Fetching Logic ─────────────
async function fetchStoreContext(shopId: string): Promise<StoreContext> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const monthStart = new Date();
  monthStart.setDate(1);

  // FIX 3: Inventory Query (Multi-shop isolation)
  const { data: inventory = [] } = await supabase
    .from('inventory')
    .select('*')
    .eq('shop_id', shopId)
    .order('item_name');

  // FIX 4: Sales Query (Multi-shop isolation)
  const { data: recentSales = [] } = await supabase
    .from('sales')
    .select(`
      total_amount,
      created_at,
      customer_name,
      items
    `)
    .eq('shop_id', shopId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  // FIX 5: Expense Query (Multi-shop isolation)
  const { data: expenses = [] } = await supabase
    .from('expenses')
    .select('amount')
    .eq('shop_id', shopId)
    .gte('date', monthStart.toISOString().split('T')[0]);

  // Calculations
  const lowStock = (inventory as any[]).filter(i => i.quantity <= (i.low_stock_threshold || 10));
  const freshScans = (inventory as any[]).filter(i => i.last_scanned_at && i.freshness_score);
  const monthExpenses = (expenses as any[]).reduce((s, e) => s + Number(e.amount), 0);
  const totalRevenue = (recentSales as any[]).reduce((s, r) => s + Number(r.total_amount), 0);

  // Extract top items from sales JSON
  const itemCount = new Map<string, number>();
  (recentSales as any[]).forEach(sale => {
    let items = sale.items;
    if (typeof items === 'string') { try { items = JSON.parse(items); } catch { items = []; } }
    if (Array.isArray(items)) {
      items.forEach((item: any) => {
        itemCount.set(item.item_name, (itemCount.get(item.item_name) || 0) + (item.cart_quantity || 1));
      });
    }
  });
  
  const topItems = Array.from(itemCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  return {
    inventory: inventory as any[],
    recentSales: recentSales as any[],
    lowStock,
    freshScans,
    monthExpenses,
    totalRevenue,
    topItems,
  };
}

// ── Call Groq API ─────────────────────────────────────────
async function callGroq(messages: { role: string; content: string }[], systemPrompt: string): Promise<string> {
  if (!GROQ_API_KEY) return "⚠️ Groq Key missing.";
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: 600,
      temperature: 0.3,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'Error fetching response.';
}

// ── Main Page Component ───────────────────────────────────
const RAGAdvisor = () => {
  // FIX 1: New Auth Hook Signature
  const { user, profile } = useAuth();
  const role = profile?.role;
  const isShopAdmin = role === 'shop_admin';

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ctx, setCtx] = useState<StoreContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // FIX 6 & 7: Updated Dependency Array and Logic
  useEffect(() => {
    if (!profile?.shop_id) return;
    setCtxLoading(true);
    fetchStoreContext(profile.shop_id)
      .then(setCtx)
      .finally(() => setCtxLoading(false));
  }, [profile?.shop_id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (text?: string) => {
    const q = (text || input).trim();
    if (!q || loading || !ctx) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: q, timestamp: new Date() }]);
    setLoading(true);

    try {
      const history = messages.slice(-4).map(m => ({ role: m.role, content: m.content }));
      history.push({ role: 'user', content: q });
      const answer = await callGroq(history, buildContextPrompt(ctx));
      setMessages(prev => [...prev, { role: 'assistant', content: answer, timestamp: new Date() }]);
    } catch (err: any) {
      setError("Failed to connect to AI.");
    } finally {
      setLoading(false);
    }
  };

  // FIX 8: Refresh with Shop ID
  const refreshContext = async () => {
    if (!profile?.shop_id) return;
    setCtxLoading(true);
    const fresh = await fetchStoreContext(profile.shop_id);
    setCtx(fresh);
    setCtxLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#070e07', color: '#e5e7eb', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      
      {/* Header */}
      <div style={{ background: '#0d1a0e', borderBottom: '1px solid #1e2a1e', padding: '16px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ width: 40, height: 40, background: '#1e1b4b', borderRadius: 8, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Bot color="#818cf8" />
            </div>
            <div>
              <h2 style={{ fontSize: 16, margin: 0 }}>RAG Advisor</h2>
              <p style={{ fontSize: 10, color: '#6b7280', margin: 0 }}>Connected to: {profile?.shop_id ? 'Store ID ' + profile.shop_id.slice(0,8) : 'Loading...'}</p>
            </div>
          </div>
          <button onClick={refreshContext} disabled={ctxLoading} style={{ background: 'none', border: '1px solid #1e2a1e', color: '#4ade80', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', display: 'flex', gap: 6 }}>
            <RefreshCw size={12} className={ctxLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {ctx && (
        <div style={{ background: '#0a140a', padding: '8px', borderBottom: '1px solid #1e2a1e' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', gap: 20, fontSize: 11, color: '#9ca3af' }}>
            <span><Package size={12} inline /> Inventory: {ctx.inventory.length}</span>
            <span><ShoppingCart size={12} inline /> Sales: {ctx.recentSales.length}</span>
            <span style={{ color: ctx.lowStock.length > 0 ? '#f87171' : '#9ca3af' }}><AlertTriangle size={12} inline /> Low Stock: {ctx.lowStock.length}</span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: 40 }}>
              <Sparkles size={40} color="#818cf8" style={{ marginBottom: 16 }} />
              <h3>Store Intelligence Advisor</h3>
              <p style={{ color: '#6b7280', fontSize: 14 }}>Ask about sales trends, inventory health, or business strategies.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 20 }}>
                {SUGGESTED.map(s => (
                  <button key={s} onClick={() => handleSend(s)} style={{ background: '#0d1a0e', border: '1px solid #1e2a1e', color: '#e5e7eb', padding: '8px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer' }}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 20, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: m.role === 'user' ? '#166534' : '#1e1b4b', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div style={{ background: m.role === 'user' ? '#0d2010' : '#0f0f1a', padding: '12px', borderRadius: 12, maxWidth: '70%', fontSize: 14, lineHeight: 1.6 }}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && <div style={{ color: '#818cf8', fontSize: 12 }}><Loader2 className="animate-spin" size={14} inline /> AI is analyzing store context...</div>}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{ background: '#0d1a0e', padding: '20px', borderTop: '1px solid #1e2a1e' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', gap: 10 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="Ask a business question..."
            style={{ flex: 1, background: '#070e07', border: '1px solid #1e2a1e', borderRadius: 8, padding: '12px', color: '#e5e7eb', resize: 'none' }}
            rows={1}
          />
          <button onClick={() => handleSend()} disabled={loading || !input.trim()} style={{ width: 48, background: '#166534', color: '#4ade80', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RAGAdvisor;