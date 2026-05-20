import { supabase }
from '@/integrations/supabase/client';
import {
  generateSemanticTags,
} from './semanticEngine';
interface SaveMemoryProps {
  shopId: string;
  userId: string;
  module: string;
  question: string;
  response: string;
  tags?: string[];
}

export const saveAIMemory =
  async ({
    shopId,
    userId,
    module,
    question,
    response,
    tags =
  generateSemanticTags(
    question
  ),
  }: SaveMemoryProps) => {

    const { error } =
      await supabase
        .from('ai_memory')
        .insert({
          shop_id: shopId,

          user_id: userId,

          module,

          role: 'assistant',

          question,

          response,

          tags,
        });

    if (error) {
      console.error(
        'AI memory save error:',
        error
      );
    }
  };

export const saveSearchHistory =
  async ({
    shopId,
    userId,
    module,
    query,
    category,
  }: {
    shopId: string;
    userId: string;
    module: string;
    query: string;
    category?: string;
  }) => {

    const { error } =
      await supabase
        .from('search_history')
        .insert({
          shop_id: shopId,

          user_id: userId,

          module,

          query,

          category,
        });

    if (error) {
      console.error(
        'Search history error:',
        error
      );
    }
  };