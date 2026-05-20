import { supabase }
from '@/integrations/supabase/client';

export const getTrendingSearches =
  async () => {

    const { data, error } =
      await supabase
        .from('search_history')
        .select('query');

    if (error) {
      console.error(error);
      return [];
    }

    const frequencyMap:
      Record<string, number> = {};

    data.forEach((item) => {

      const normalized =
        item.query
          .toLowerCase()
          .trim();

      frequencyMap[normalized] =
        (frequencyMap[normalized] || 0) + 1;
    });

    return Object.entries(
      frequencyMap
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

export const getVendorRecommendations =
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

    // Similar searches
    const otherVendorQueries =
      data.filter(
        (item) =>
          item.shop_id !== shopId
      );

    const grouped:
      Record<string, number> = {};

    otherVendorQueries.forEach(
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
      .slice(0, 8)
      .map(([query, count]) => ({
        query,
        count,
      }));
  };

export const getSuggestedQueries =
  async (
    partial: string
  ) => {

    const { data, error } =
      await supabase
        .from('search_history')
        .select('query');

    if (error) {
      console.error(error);
      return [];
    }

    return data
      .filter(
        (item) =>
          item.query
            .toLowerCase()
            .includes(
              partial.toLowerCase()
            )
      )
      .slice(0, 5);
  };