// ============================================================
// EnterpriseAI.ts
// NLP → SQL PIPELINE
// Flow: User Question → Groq generates SQL → Run on Supabase
//       → Groq explains results in plain English
// ✅ No embeddings, no vectors, no indexing needed
// ✅ Real answers from real data every time
// ============================================================

import { supabase } from '@/integrations/supabase/client';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// ============================================================
// TYPES
// ============================================================

export interface RAGChunk {
  id?: string;
  chunk_type: string;
  content: string;
  metadata?: any;
  similarity?: number;
}

export interface MemoryEntry {
  question: string;
  response: string;
  similarity?: number;
  created_at?: string;
}

export interface NLPSQLResult {
  sql: string;
  data: any[];
  response: string;
  success: boolean;
  error?: string;
}

// ============================================================
// DATABASE SCHEMA CONTEXT
// Matches the REAL Supabase schema exactly
// ============================================================

const DB_SCHEMA = `
You have access to a PostgreSQL retail database with these tables:

TABLE: inventory
  - id (uuid)
  - shop_id (uuid) ← always filter by this
  - item_name (text) — product name (NOT "name", NOT "product_name")
  - category (text) — product category
  - brand (text) — brand name
  - description (text)
  - quantity (integer) — current stock quantity (NOT "stock")
  - unit_price (numeric) — selling price per unit (NOT "price")
  - cost_price (numeric) — cost/purchase price per unit
  - low_stock_threshold (integer) — triggers reorder alert (default 10)
  - is_available (boolean) — whether item is active
  - freshness_grade (text) — A/B/C/D/F
  - freshness_score (numeric)
  - freshness_action (text)
  - ai_recommended_price (numeric)
  - discount_percent (numeric)
  - spoilage_hours (numeric)
  - created_at (timestamptz)
  - updated_at (timestamptz)

TABLE: sales
  - id (uuid)
  - shop_id (uuid) ← always filter by this
  - customer_name (text)
  - customer_phone (text)
  - total_amount (numeric) — total bill value
  - payment_method (text) — 'cash', 'online', 'card', etc.
  - items (jsonb) — JSON array of sold items. Each object has EXACTLY these keys:
      {
        "id": text,
        "item_name": text,          ← product name
        "category": text,           ← product category
        "unit_price": numeric,      ← price per unit
        "cart_quantity": numeric,   ← ⚠️ units sold (NOT "quantity")
        "total_price": numeric,     ← ⚠️ line total (NOT "total")
        "final_amount": numeric     ← same as total_price after discounts
      }
  - bill_data (jsonb) — mirrors items, same structure
  - created_at (timestamptz)

  ⚠️ CRITICAL — The items JSONB uses these EXACT field names:
     "cart_quantity"  (NOT "quantity")
     "total_price"    (NOT "total", NOT "final_amount")
     "item_name"      ✅ correct
     "unit_price"     ✅ correct

  To query individual products sold, ALWAYS use this exact pattern:
  SELECT
    elem->>'item_name' AS product_name,
    SUM((elem->>'cart_quantity')::numeric) AS total_quantity,
    SUM((elem->>'total_price')::numeric) AS total_revenue
  FROM sales, jsonb_array_elements(items) AS elem
  WHERE shop_id = '<SHOP_ID>'
  GROUP BY product_name
  ORDER BY total_revenue DESC

TABLE: expenses
  - id (uuid)
  - shop_id (uuid) ← always filter by this
  - amount (numeric)
  - category (text)
  - description (text)
  - date (date)
  - created_at (timestamptz)

TABLE: purchase_orders
  - id (uuid)
  - shop_id (uuid) ← always filter by this
  - supplier_id (uuid)
  - item_name (text)
  - quantity_ordered (numeric)
  - unit_cost (numeric)
  - total_cost (numeric)
  - status (text) — 'pending', 'received', 'cancelled'
  - notes (text)
  - raised_at (timestamptz)
  - expected_at (timestamptz)
  - received_at (timestamptz)

TABLE: suppliers
  - id (uuid)
  - shop_id (uuid) ← always filter by this
  - name (text)
  - category (text)
  - rating (numeric) — 1 to 5
  - contact_email (text)
  - created_at (timestamptz)

TABLE: ai_memory
  - id (uuid)
  - shop_id (uuid)
  - user_id (uuid)
  - module (text)
  - role (text)
  - question (text)
  - response (text)
  - created_at (timestamptz)

STRICT RULES:
- Always add WHERE shop_id = '<SHOP_ID>' to every query
- Use SELECT only — never INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE
- Return max 50 rows unless asked for more
- Use ORDER BY and LIMIT to keep results focused
- For "this week" use: created_at >= NOW() - INTERVAL '7 days'
- For "today" use: created_at >= NOW() - INTERVAL '1 day'
- For "this month" use: created_at >= NOW() - INTERVAL '30 days'
- Always alias aggregates e.g. SUM(cart_quantity) AS total_quantity
- inventory column is item_name (NOT name, NOT product_name)
- inventory column is quantity (NOT stock)
- inventory column is unit_price (NOT price)
- sales product details live inside items JSONB — ALWAYS use jsonb_array_elements(items) to access them
- sales JSONB item fields: item_name, cart_quantity, total_price, unit_price, category, final_amount
- sales JSONB does NOT have fields named "quantity" or "total" — use cart_quantity and total_price
- profit per item = unit_price - cost_price (from inventory table)
- low stock items = WHERE quantity <= low_stock_threshold
`;

// ============================================================
// STEP 1: NLP → SQL (Groq generates the SQL query)
// ============================================================

async function generateSQL(question: string, shopId: string): Promise<string> {
  const prompt = `${DB_SCHEMA}

SHOP_ID to use in all queries: '${shopId}'

User question: "${question}"

Generate a single PostgreSQL SELECT query that answers this question.
Replace <SHOP_ID> with the actual shop_id value provided above.

CRITICAL REMINDERS before writing SQL:
- inventory table: use item_name, quantity, unit_price, cost_price
- sales table: individual product data is ONLY inside items JSONB column
- Use jsonb_array_elements(items) AS elem to expand items
- Inside the JSONB elem, the EXACT field names are:
    elem->>'item_name'                        ← product name
    (elem->>'cart_quantity')::numeric         ← units sold (NOT quantity, NOT qty)
    (elem->>'total_price')::numeric           ← line revenue (NOT total, NOT final_amount)
    (elem->>'unit_price')::numeric            ← unit price
    elem->>'category'                         ← category
- Never use elem->>'quantity' or elem->>'total' — those keys do NOT exist

Rules:
- Return ONLY the SQL query, nothing else
- No markdown, no backticks, no explanation
- No semicolon at the end
- Only SELECT statements allowed`;

  const response = await fetch('[https://api.groq.com/openai/v1/chat/completions](https://api.groq.com/openai/v1/chat/completions)', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a PostgreSQL expert. You only output raw SQL SELECT queries. No markdown, no explanation, no backticks. You always use the exact column names provided in the schema.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
    }),
  });

  const data = await response.json();
  let sql = data.choices?.[0]?.message?.content?.trim() || '';

  // ✅ FIX: Kept entirely on one line so Vite doesn't crash
  sql = sql.replace(/```sql/gi, '').replace(/```/g, '').trim();
  
  // Remove trailing semicolon (Supabase RPC doesn't like it)
  sql = sql.replace(/;$/, '').trim();

  return sql;
}

// ============================================================
// STEP 2: Run SQL on Supabase via rpc('run_nlp_sql')
// ============================================================

async function runSQL(sql: string): Promise<{ data: any[]; error: string | null }> {
  try {
    // Safety check — only allow SELECT
    const normalized = sql.trim().toLowerCase();
    if (!normalized.startsWith('select')) {
      return { data: [], error: 'Only SELECT queries are allowed' };
    }

    const { data, error } = await supabase.rpc('run_nlp_sql', { query: sql });

    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

// ============================================================
// STEP 3: Groq explains the SQL results in plain English
// ============================================================

async function explainResults(
  question: string,
  sql: string,
  data: any[],
  error: string | null
): Promise<string> {
  let dataSection = '';

  if (error) {
    dataSection = `SQL Error: ${error}`;
  } else if (data.length === 0) {
    dataSection = 'Query returned no results.';
  } else {
    dataSection = `Query returned ${data.length} rows:\n${JSON.stringify(data, null, 2)}`;
  }

  const prompt = `The user asked: "${question}"

SQL query used:
${sql}

Results:
${dataSection}

Now answer the user's question directly using the actual data above.
- Use specific product names, numbers, and figures from the results
- Be concise and clear
- Format nicely with bullet points where helpful
- If there was an error, explain what went wrong simply
- Do NOT say "based on the data" or "according to the results" — just answer directly`;

  const response = await fetch('[https://api.groq.com/openai/v1/chat/completions](https://api.groq.com/openai/v1/chat/completions)', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content:
            `You are an expert retail business analyst.
            
IMPORTANT:
- Always use the Indian Rupee symbol (₹) for ALL monetary values.
- NEVER use the dollar sign ($) or any other currency symbol.
- Format all large numbers using the en-IN locale format (e.g., ₹1,00,000 instead of ₹100,000).

Answer questions directly using real data. Be specific, concise, and actionable.`
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    }),
  });

  const result = await response.json();
  return result.choices?.[0]?.message?.content || 'Could not generate explanation.';
}

// ============================================================
// SAVE MEMORY
// ============================================================

export async function saveMemory(params: {
  shopId: string;
  userId: string;
  question: string;
  response: string;
}) {
  try {
    await supabase.from('ai_memory').insert({
      shop_id: params.shopId,
      user_id: params.userId,
      module: 'enterprise_rag',
      role: 'assistant',
      question: params.question,
      response: params.response,
    });
  } catch (error) {
    console.error('Memory Save Error:', error);
  }
}

// ============================================================
// LOAD CHAT HISTORY
// ============================================================

export async function loadChatHistory(params: {
  shopId: string;
  userId: string;
  limit?: number;
}): Promise<Array<{ question: string; response: string; created_at: string }>> {
  try {
    const { data, error } = await supabase
      .from('ai_memory')
      .select('question, response, created_at')
      .eq('shop_id', params.shopId)
      .eq('user_id', params.userId)
      .eq('module', 'enterprise_rag')
      .order('created_at', { ascending: true })
      .limit(params.limit || 30);

    if (error) throw error;
    // ✅ Returns an empty array correctly when no history exists
    return data || [];
  } catch (error) {
    console.error('Load Chat History Error:', error);
    return [];
  }
}

// ============================================================
// CLEAR CHAT HISTORY
// ============================================================

export async function clearChatHistory(params: {
  shopId: string;
  userId: string;
}): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ai_memory')
      .delete()
      .eq('shop_id', params.shopId)
      .eq('user_id', params.userId)
      .eq('module', 'enterprise_rag');

    if (error) {
      throw new Error(`Failed to clear history: ${error.message}`);
    }
    return true;
  } catch (error) {
    console.error('Clear Chat History Error:', error);
    throw error;
  }
}

// ============================================================
// RETRIEVE MEMORY
// ============================================================

export async function retrieveMemory(params: {
  shopId: string;
  query: string;
  topK?: number;
}): Promise<MemoryEntry[]> {
  try {
    const keywords = params.query
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(' ')
      .filter((w) => w.length > 3)
      .slice(0, 4);

    if (keywords.length === 0) return [];

    const filter = keywords.map((k) => `question.ilike.%${k}%`).join(',');

    const { data } = await supabase
      .from('ai_memory')
      .select('question, response, created_at')
      .eq('shop_id', params.shopId)
      .eq('module', 'enterprise_rag')
      .or(filter)
      .order('created_at', { ascending: false })
      .limit(params.topK || 3);

    return data || [];
  } catch (error) {
    return [];
  }
}

// ============================================================
// COMPATIBILITY SHIMS
// ============================================================

export async function storeEmbedding(_params: any) {}
export async function semanticSearch(_params: any): Promise<RAGChunk[]> {
  return [];
}
export function buildEnterprisePrompt(_params: any): string {
  return '';
}
export async function indexShopData(_shopId: string) {
  return { success: true };
}
export async function generateEmbedding(_text: string): Promise<number[]> {
  return [];
}
export async function askGroq(prompt: string): Promise<string> {
  const response = await fetch('[https://api.groq.com/openai/v1/chat/completions](https://api.groq.com/openai/v1/chat/completions)', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response';
}

// ============================================================
// MAIN PIPELINE: NLP → SQL → Results → Plain English Answer
// ============================================================

export async function runEnterpriseRAG(params: {
  shopId: string;
  userId: string;
  query: string;
}): Promise<{
  response: string;
  sql?: string;
  data?: any[];
  context: any[];
  memory: any[];
  success: boolean;
}> {
  try {
    // Step 1: Generate SQL from natural language
    const sql = await generateSQL(params.query, params.shopId);
    console.log('Generated SQL:', sql);

    // Step 2: Run the SQL
    const { data, error } = await runSQL(sql);
    console.log('SQL Results:', data, error);

    // Step 3: Explain results in plain English
    const response = await explainResults(params.query, sql, data, error);

    // Save to memory in background
    saveMemory({
      shopId: params.shopId,
      userId: params.userId,
      question: params.query,
      response,
    });

    return { response, sql, data, context: [], memory: [], success: true };
  } catch (error) {
    console.error('NLP→SQL Pipeline Error:', error);
    return {
      response: 'Something went wrong. Please try again.',
      context: [],
      memory: [],
      success: false,
    };
  }
}
