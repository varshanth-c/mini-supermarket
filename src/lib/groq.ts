const API_KEY =
  import.meta.env
    .VITE_GROQ_API_KEY;

const MODEL =
  'llama-3.3-70b-versatile';

export const askGroq = async (
  prompt: string
) => {

  const response =
    await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          Authorization:
            `Bearer ${API_KEY}`,
        },

        body: JSON.stringify({
          model: MODEL,

          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],

          temperature: 0.4,

          max_tokens: 1500,
        }),
      }
    );

  const data =
    await response.json();

  return (
    data?.choices?.[0]
      ?.message?.content ||
    'No AI response generated.'
  );
};