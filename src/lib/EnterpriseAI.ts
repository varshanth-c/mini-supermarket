// ============================================================
// EnterpriseAI.ts
// CENTRALIZED ENTERPRISE RAG + MEMORY + VECTOR ENGINE
// ============================================================

import { supabase }
from '@/integrations/supabase/client';

import { GoogleGenerativeAI }
from '@google/generative-ai';

// ============================================================
// CONFIG
// ============================================================

const GEMINI_API_KEY =
  import.meta.env
    .VITE_GEMINI_API_KEY;

const GROQ_API_KEY =
  import.meta.env
    .VITE_GROQ_API_KEY;

const genAI =
  new GoogleGenerativeAI(
    GEMINI_API_KEY
  );

const GROQ_MODEL =
  'llama-3.3-70b-versatile';

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

// ============================================================
// GEMINI EMBEDDINGS
// ============================================================

export async function generateEmbedding(
  text: string
): Promise<number[]> {

  try {

    const model =
      genAI.getGenerativeModel({
        model:
          'text-embedding-004',
      });

    const result =
      await model.embedContent(
        text
      );

    return (
      result.embedding.values
    );

  } catch (error) {

    console.error(
      'Embedding Error:',
      error
    );

    return [];
  }
}

// ============================================================
// GROQ CHAT COMPLETION
// ============================================================

export async function askGroq(
  prompt: string
): Promise<string> {

  try {

    const response =
      await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {

          method: 'POST',

          headers: {

            'Content-Type':
              'application/json',

            Authorization:
              `Bearer ${GROQ_API_KEY}`,
          },

          body: JSON.stringify({

            model:
              GROQ_MODEL,

            messages: [

              {
                role:
                  'system',

                content:
                  `
You are an Enterprise Retail Intelligence AI.

You specialize in:
- inventory optimization
- supplier intelligence
- sales forecasting
- procurement strategy
- freshness management
- retail analytics
- operational optimization

Always provide:
- business reasoning
- operational insights
- practical recommendations
- strategic suggestions
`,
              },

              {
                role:
                  'user',

                content:
                  prompt,
              },
            ],

            temperature:
              0.4,
          }),
        }
      );

    const data =
      await response.json();

    return (
      data.choices?.[0]
        ?.message
        ?.content
      || 'No response'
    );

  } catch (error) {

    console.error(
      'Groq Error:',
      error
    );

    return 'AI response failed.';
  }
}

// ============================================================
// VECTOR STORAGE
// ============================================================

export async function storeEmbedding(
  params: {
    shopId: string;
    chunkType: string;
    content: string;
    metadata?: any;
  }
) {

  try {

    const embedding =
      await generateEmbedding(
        params.content
      );

    if (
      !embedding.length
    ) return;

    await supabase
      .from('rag_chunks')
      .insert({

        shop_id:
          params.shopId,

        chunk_type:
          params.chunkType,

        content:
          params.content,

        metadata:
          params.metadata || {},

        embedding,
      });

  } catch (error) {

    console.error(
      'Store Embedding Error:',
      error
    );
  }
}

// ============================================================
// SEMANTIC SEARCH
// ============================================================

export async function semanticSearch(
  params: {
    shopId: string;
    query: string;
    topK?: number;
    chunkTypes?: string[];
  }
): Promise<RAGChunk[]> {

  try {

    const embedding =
      await generateEmbedding(
        params.query
      );

    const { data, error } =
      await supabase.rpc(
        'match_rag_chunks',
        {

          p_shop_id:
            params.shopId,

          query_embedding:
            embedding,

          match_threshold:
            0.65,

          match_count:
            params.topK || 6,

          p_chunk_types:
            params.chunkTypes || null,
        }
      );

    if (error)
      throw error;

    return data || [];

  } catch (error) {

    console.error(
      'Semantic Search Error:',
      error
    );

    return [];
  }
}

// ============================================================
// MEMORY SAVE
// ============================================================

export async function saveMemory(
  params: {
    shopId: string;
    userId: string;
    question: string;
    response: string;
  }
) {

  try {

    const embedding =
      await generateEmbedding(
        params.question
      );

    await supabase
      .from(
        'ai_memory_embeddings'
      )
      .insert({

        shop_id:
          params.shopId,

        user_id:
          params.userId,

        question:
          params.question,

        response:
          params.response,

        embedding,
      });

  } catch (error) {

    console.error(
      'Memory Save Error:',
      error
    );
  }
}

// ============================================================
// MEMORY RETRIEVAL
// ============================================================

export async function retrieveMemory(
  params: {
    shopId: string;
    query: string;
    topK?: number;
  }
): Promise<MemoryEntry[]> {

  try {

    const embedding =
      await generateEmbedding(
        params.query
      );

    const { data, error } =
      await supabase.rpc(
        'match_ai_memory',
        {

          p_shop_id:
            params.shopId,

          query_embedding:
            embedding,

          match_threshold:
            0.70,

          match_count:
            params.topK || 3,
        }
      );

    if (error)
      throw error;

    return data || [];

  } catch (error) {

    console.error(
      'Memory Retrieval Error:',
      error
    );

    return [];
  }
}

// ============================================================
// BUILD ENTERPRISE PROMPT
// ============================================================

export function buildEnterprisePrompt(
  params: {
    query: string;
    context: RAGChunk[];
    memory: MemoryEntry[];
  }
): string {

  const {
    query,
    context,
    memory,
  } = params;

  return `

==================================================
ENTERPRISE RETAIL KNOWLEDGE BASE
==================================================

${context
  .map(
    (item, index) =>

      `[${index + 1}] (${item.chunk_type})

${item.content}`
  )
  .join('\n\n')}

==================================================
RELEVANT PAST AI MEMORY
==================================================

${memory
  .map(
    (m, index) =>

`Memory ${index + 1}

Q:
${m.question}

A:
${m.response}`
  )
  .join('\n\n')}

==================================================
USER QUESTION
==================================================

${query}

==================================================
RESPONSE REQUIREMENTS
==================================================

Provide:
- operational insights
- inventory reasoning
- supplier analysis
- sales intelligence
- strategic recommendations
- forecasting suggestions
- risk detection
- business optimization advice

Use ONLY available business context.

`;
}

// ============================================================
// INDEX SHOP DATA
// ============================================================

export async function indexShopData(
  shopId: string
) {

  try {

    // ------------------------------------------------
    // INVENTORY
    // ------------------------------------------------

    const {
      data: inventory,
    } = await supabase
      .from('inventory')
      .select('*')
      .eq(
        'shop_id',
        shopId
      );

    for (const item of inventory || []) {

      const content =
`
Product:
${item.name}

Category:
${item.category}

Stock:
${item.stock}

Price:
${item.price}

Freshness:
${item.freshness_grade || 'Unknown'}

Supplier:
${item.supplier_name || 'Unknown'}
`;

      await storeEmbedding({

        shopId,

        chunkType:
          'inventory',

        content,

        metadata: {

          inventory_id:
            item.id,
        },
      });
    }

    // ------------------------------------------------
    // SALES
    // ------------------------------------------------

    const {
      data: sales,
    } = await supabase
      .from('sales')
      .select('*')
      .eq(
        'shop_id',
        shopId
      );

    for (const sale of sales || []) {

      const content =
`
Sale Record

Product:
${sale.product_name}

Quantity:
${sale.quantity}

Revenue:
${sale.total_amount}

Date:
${sale.created_at}
`;

      await storeEmbedding({

        shopId,

        chunkType:
          'sale',

        content,

        metadata: {

          sale_id:
            sale.id,
        },
      });
    }

    // ------------------------------------------------
    // SUPPLIERS
    // ------------------------------------------------

    const {
      data: suppliers,
    } = await supabase
      .from('suppliers')
      .select('*')
      .eq(
        'shop_id',
        shopId
      );

    for (const supplier of suppliers || []) {

      const content =
`
Supplier:
${supplier.name}

Category:
${supplier.category}

Rating:
${supplier.rating}

Email:
${supplier.contact_email}
`;

      await storeEmbedding({

        shopId,

        chunkType:
          'vendor',

        content,

        metadata: {

          supplier_id:
            supplier.id,
        },
      });
    }

    return {
      success: true,
    };

  } catch (error) {

    console.error(
      'Indexing Error:',
      error
    );

    return {
      success: false,
    };
  }
}

// ============================================================
// FULL ENTERPRISE RAG PIPELINE
// ============================================================

export async function runEnterpriseRAG(
  params: {
    shopId: string;
    userId: string;
    query: string;
  }
) {

  try {

    // ------------------------------------------------
    // SEMANTIC SEARCH
    // ------------------------------------------------

    const context =
      await semanticSearch({

        shopId:
          params.shopId,

        query:
          params.query,

        topK: 8,
      });

    // ------------------------------------------------
    // MEMORY SEARCH
    // ------------------------------------------------

    const memory =
      await retrieveMemory({

        shopId:
          params.shopId,

        query:
          params.query,
      });

    // ------------------------------------------------
    // BUILD PROMPT
    // ------------------------------------------------

    const prompt =
      buildEnterprisePrompt({

        query:
          params.query,

        context,

        memory,
      });

    // ------------------------------------------------
    // GROQ RESPONSE
    // ------------------------------------------------

    const response =
      await askGroq(
        prompt
      );

    // ------------------------------------------------
    // SAVE MEMORY
    // ------------------------------------------------

    await saveMemory({

      shopId:
        params.shopId,

      userId:
        params.userId,

      question:
        params.query,

      response,
    });

    // ------------------------------------------------
    // RETURN
    // ------------------------------------------------

    return {

      response,

      context,

      memory,

      success: true,
    };

  } catch (error) {

    console.error(
      'Enterprise RAG Error:',
      error
    );

    return {

      response:
        'AI failed.',

      context: [],

      memory: [],

      success: false,
    };
  }
}