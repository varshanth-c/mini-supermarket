import { supabase }
from '@/integrations/supabase/client';

export const getTopSemanticIssues =
  async () => {

    const { data, error } =
      await supabase
        .from('ai_memory')
        .select('tags');

    if (error) {
      console.error(error);
      return [];
    }

    const counts:
      Record<string, number> = {};

    data.forEach((item) => {

      (item.tags || [])
        .forEach((tag: string) => {

          counts[tag] =
            (counts[tag] || 0) + 1;
        });
    });

    return Object.entries(
      counts
    )
      .sort(
        (a, b) => b[1] - a[1]
      )
      .slice(0, 10)
      .map(([tag, count]) => ({
        tag,
        count,
      }));
  };