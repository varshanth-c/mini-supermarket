const keywordGroups = {

  dairy: [
    'milk',
    'cheese',
    'curd',
    'butter',
    'paneer',
  ],

  freshness: [
    'freshness',
    'spoiled',
    'rotten',
    'expiry',
    'spoilage',
  ],

  beverages: [
    'juice',
    'drink',
    'cola',
    'water',
    'soda',
  ],

  inventory: [
    'stock',
    'inventory',
    'reorder',
    'supply',
  ],

  demand: [
    'sales',
    'demand',
    'trend',
    'forecast',
  ],

  snacks: [
    'chips',
    'snacks',
    'biscuits',
    'cookies',
  ],

  fruits: [
    'banana',
    'apple',
    'orange',
    'mango',
    'fruit',
  ],
};

export const generateSemanticTags =
  (
    text: string
  ) => {

    const lower =
      text.toLowerCase();

    const tags:
      string[] = [];

    Object.entries(
      keywordGroups
    ).forEach(
      ([group, words]) => {

        const matched =
          words.some(
            (word) =>
              lower.includes(word)
          );

        if (matched) {
          tags.push(group);
        }
      }
    );

    return tags;
  };

export const calculateSemanticSimilarity =
  (
    tagsA: string[],
    tagsB: string[]
  ) => {

    const intersection =
      tagsA.filter(
        (tag) =>
          tagsB.includes(tag)
      );

    return (
      intersection.length /
      Math.max(
        tagsA.length,
        tagsB.length,
        1
      )
    );
  };