import { supabase }
from '@/integrations/supabase/client';

export const getAutocompleteSuggestions =
  async (
    partial: string
  ) => {

    if (!partial)
      return [];

    const { data, error } =
      await supabase
        .from('search_history')
        .select('query');

    if (error) {
      console.error(error);
      return [];
    }

    const matches =
      data.filter(
        (item) =>
          item.query
            .toLowerCase()
            .includes(
              partial.toLowerCase()
            )
      );

    const unique =
      Array.from(
        new Set(
          matches.map(
            (m) => m.query
          )
        )
      );

    return unique.slice(0, 6);
  };

export const getCollaborativeInsights =
  async (
    shopId: string
  ) => {

    const { data, error } =
      await supabase
        .from('search_history')
        .select('*');

    if (error) {
      console.error(error);
      return [];
    }

    const otherVendors =
      data.filter(
        (item) =>
          item.shop_id !== shopId
      );

    const grouped:
      Record<string, number> = {};

    otherVendors.forEach(
      (item) => {

        grouped[item.query] =
          (grouped[item.query] || 0) + 1;
      }
    );

    return Object.entries(
      grouped
    )
      .sort(
        (a, b) => b[1] - a[1]
      )
      .slice(0, 10)
      .map(([query, count]) => ({
        query,
        count,
      }));
  };

export const getTrendScores =
  async () => {

    const { data, error } =
      await supabase
        .from('search_history')
        .select('*');

    if (error) {
      console.error(error);
      return [];
    }

    const trendMap:
      Record<
        string,
        {
          count: number;
          recent: number;
        }
      > = {};

    const now =
      new Date();

    data.forEach((item) => {

      const query =
        item.query
          .toLowerCase();

      if (!trendMap[query]) {
        trendMap[query] = {
          count: 0,
          recent: 0,
        };
      }

      trendMap[query].count++;

      const created =
        new Date(
          item.created_at
        );

      const diffDays =
        (
          now.getTime() -
          created.getTime()
        ) /
        (1000 * 60 * 60 * 24);

      if (diffDays <= 7) {
        trendMap[query].recent++;
      }
    });

    return Object.entries(
      trendMap
    )
      .map(([query, stats]) => ({

        query,

        score:
          stats.count * 2 +
          stats.recent * 5,

        total:
          stats.count,

        recent:
          stats.recent,
      }))
      .sort(
        (a, b) =>
          b.score - a.score
      )
      .slice(0, 10);
  };