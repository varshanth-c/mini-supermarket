import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = 3000;

// Setup JSON body parsing with an increased limit to accommodate image uploads easily
app.use(express.json({ limit: "15mb" }));

// Lazy initializer for Google GenAI client to preserve startup safety
let genaiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genaiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please configure it in your Settings > Secrets panel.");
    }
    genaiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genaiClient;
}

// REST Endpoints
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    apiKeyConfigured: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString()
  });
});

app.post("/api/analyze", async (req, res) => {
  try {
    const { image, mimeType, currentStorage, sensors } = req.body;

    if (!image || !mimeType) {
      res.status(400).json({ error: "Missing required 'image' (base64 string) or 'mimeType' parameters." });
      return;
    }

    // Initialize/retrieve client safely
    const ai = getGenAI();

    // Setup base64 image chunk for the Gemini multimodal API call
    const imagePart = {
      inlineData: {
        mimeType,
        data: image,
      },
    };

    const currentStorageContext = currentStorage && currentStorage !== "unknown"
      ? `The user states this raw item is currently stored in: "${currentStorage}". Consider this when calculating remaining shelf life if stored optimally vs in their current setup.`
      : "The current storage location is not specified or unknown. Help them understand why storing it properly is beneficial.";

    let sensorContext = "";
    if (sensors) {
      sensorContext = `
      Current IoT microclimate sensor logs when photographed:
      - Temperature: ${sensors.temperature}°C (Evaluate potential chilling injuries or high-temp transpiration)
      - Humidity: ${sensors.humidity}% (Assess transpirational water loss or bacterial/mould spores triggers)
      - CO₂ Respiration level: ${sensors.co2_ppm} ppm (Analyze if active plant respiration / decay represents rapid carbon expiration)
      - Stored Duration: ${sensors.storage_hours} hours already logged in this setup
      - Ambient Light setup: ${sensors.ambient_light || "moderate"} (UV influence)

      CRITICAL: Integrate these real physical climate conditions into your scientific deduction. For example, if Temperature is elevated (>30°C) or Humidity is dangerously damp (>80%), state why that hastens deterioration and how the user can counter it in your preservation tips and freshness explanation. Modify the calculated remaining shelf days appropriately.
      `;
    }

    const textPart = {
      text: `Analyze the provided image containing a single fruit or vegetable or a group of fruits/vegetables.
      
      Identify:
      1. What fruit or vegetable is shown (the dominant one if multiple).
      2. Its classification (Fruit/Vegetable).
      3. An accurate assessment of its freshness on a scale from 0 to 100 (where 100 is pristine, freshly picked peak quality, and 0 is advanced decomposition/mold). 
      4. Assign a freshness category label (e.g. "Fresh", "Ripe", "Slightly Overripe", "Overripe", "Spoiled/Decaying").
      5. List key visual observations/indicators (e.g. surface blemishes, soft spots, bruising, glossy skin, color change) that defend your score.
      6. Provide professional storage instructions:
         - Best storage location (e.g., refrigerator, ventilated countertop, dark dry pantry).
         - Recommended storage temperature.
         - Ethylene warnings: Is it sensitive to ethylene gas (like leafy greens, carrots) or does it produce ethylene (like apples, bananas, tomatoes)? Describe companion storing rules.
         - Clear step-by-step preservation instructions to maximize its shelf-life.
      7. Provide remaining shelf life:
         - Estimate how many days/weeks it will last under ideal recommended conditions.
         - Estimate how many days/weeks it will last under current storage (${currentStorageContext}) if it differs significantly from the ideal recommendation.
         - Visual/text indicators of exact signs that will show it has crossed into spoiled/unusable category.
      8. Provide immediate and long-term actionable suggestions:
         - Immediate action (e.g., eat raw today, wash only right before consumption).
         - Long-term preservation (e.g., freezing method, pickling, drying).
         - Creative "Rescue" recipe/idea if it is starting to get overripe or has minor spots (e.g., blend into a smoothie, bake banana bread, use for soup stock, make quick jam).
      9. A unique, engaging, short piece of dietary/botanical trivia about this item.

      Context: ${currentStorageContext}
      ${sensorContext}

      Your answer must strictly adhere to the requested JSON layout schema. Do not include markdown code block characters around the JSON in the response string, output pure JSON matching the schema types.`
    };

    // Call Gemini 3.5 Flash for the multimodal inquiry
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: {
        parts: [imagePart, textPart]
      },
      config: {
        systemInstruction: "You are an expert food scientist, agriculturist, and culinary fresh-keeping expert. Analyze the visual state of the fruit or vegetable with clinical accuracy and yield helpful, practical, food safety-conscious answers.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Name of the fruit or vegetable" },
            type: { type: Type.STRING, description: "Classification category, e.g. fruit, vegetable, herb" },
            confidence: { type: Type.NUMBER, description: "Your identification confidence from 0 to 100" },
            freshnessClass: { type: Type.STRING, description: "Category label: Fresh, Ripe, Slightly Overripe, Overripe, or Spoiled/Decaying" },
            freshnessScore: { type: Type.NUMBER, description: "Freshness score from 0 (rotten/unusable) to 100 (perfectly freshly-harvested/prime)" },
            freshnessExplanation: { type: Type.STRING, description: "Text explanation of why the item received this freshness score based on visual findings." },
            indicators: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of distinct visual items observed (e.g. 'No bruising', 'Slight skin wrinkling', 'Minor stem discoloration')"
            },
            optimalStorage: {
              type: Type.OBJECT,
              properties: {
                location: { type: Type.STRING, description: "Best storage site e.g., 'Crisper Drawer (High Humidity)', 'Countertop (out of direct sunlight)'" },
                temperature: { type: Type.STRING, description: "Suggested ideal temperature range (e.g., '1-4°C (34-40°F)')" },
                ethyleneSensitivity: { type: Type.STRING, description: "Info on whether it is an ethylene producer, sensitive, or neutral, and storage implications." },
                instructions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Specific practical steps to store it correctly immediately (e.g. 'Do not wash until consumption', 'Keep inside breathable paper bag')"
                }
              },
              required: ["location", "instructions"]
            },
            shelfLife: {
              type: Type.OBJECT,
              properties: {
                recommendedStorageDays: { type: Type.STRING, description: "Estimated safe remaining days in optimal storage e.g. '5 to 7 days'" },
                currentStorageDays: { type: Type.STRING, description: "Estimated safe remaining days in current specified storage conditions" },
                indicatorsOfSpoilage: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Warning signs indicating it has spoiled (e.g. 'Sour fermented odor', 'Fuzzy white fungal mold', 'Extreme mushiness')"
                }
              },
              required: ["recommendedStorageDays", "indicatorsOfSpoilage"]
            },
            preservationTips: {
              type: Type.OBJECT,
              properties: {
                immediateAction: { type: Type.STRING, description: "What to do right now, e.g., 'Eat or cook within 24 hours to avoid bruising loss'" },
                longTermPreservation: { type: Type.STRING, description: "Best long-term backup process, e.g. how to blanch, freeze, or preserve it" },
                rescueIdea: { type: Type.STRING, description: "A highly relevant recovery culinary recipe/idea if slightly overripe" }
              },
              required: ["immediateAction", "longTermPreservation"]
            },
            funTrivia: { type: Type.STRING, description: "An interesting nutritional, historical, or scientific fact about this item" }
          },
          required: [
            "name",
            "type",
            "confidence",
            "freshnessClass",
            "freshnessScore",
            "freshnessExplanation",
            "indicators",
            "optimalStorage",
            "shelfLife",
            "preservationTips",
            "funTrivia"
          ]
        }
      }
    });

    const parsedData = JSON.parse(response.text?.trim() || "{}");
    res.json(parsedData);
  } catch (error: any) {
    console.error("Gemini analysis server-side crash:", error);
    res.status(500).json({
      error: "Error during fruit/vegetable analysis. Please try again.",
      details: error.message || String(error)
    });
  }
});

app.post("/api/rescue-recipe", async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "Missing or invalid 'items' inventory array in body" });
      return;
    }

    const ai = getGenAI();

    const itemsContext = items
      .map(
        (item: any, idx: number) =>
          `${idx + 1}. Name: "${item.name}" (Freshness Level: ${item.freshnessScore}/100, Type: "${item.type || "Organic"}")`
      )
      .join("\n");

    const textPart = {
      text: `Role-play as an expert eco-chef, nutritionist, and molecular food-science authority. 
      You are presented with the following surplus/near-expiration produce items currently stored in a home pantry:
      
      ${itemsContext}
      
      Create a highly tasty, practical, zero-waste culinary rescue recipe that creatively marries these items (or as many of them as possible). Do not suggest buying rare, expensive ingredients; prefer pantry staples. Include detailed culinary chemistry tips (e.g., how to offset acidic overripe tomatoes, how starch in bananas works under heat, or thermal preservation keys).
      
      Return a cleanly structured JSON response conforming strictly to this format:
      {
        "recipeTitle": "Elegant title of the recipe",
        "servings": "e.g. 2-4 portions",
        "prepTime": "e.g. 15 minutes",
        "cookTime": "e.g. 25 minutes",
        "molecularCulinarySecret": "A short chef's explanation of the kitchen chemistry that makes this zero-waste combination successful",
        "pantryStaplesNeeded": ["additional minor staples like oil, flour, salt"],
        "instructions": [
          "Step 1...",
          "Step 2..."
        ],
        "nutritionalValueExplanation": "Briefly state the digestive and vitamin profile of the cooked result."
      }`
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [textPart],
      config: {
        systemInstruction: "You are a professional Michelin-star zero-waste Chef and Food Biochemist. Generate highly logical, healthy, and easy-to-follow culinary solutions for surplus ingredients.",
        responseMimeType: "application/json"
      }
    });

    const recipeData = JSON.parse(response.text?.trim() || "{}");
    res.json(recipeData);
  } catch (error: any) {
    console.error("Gemini rescue recipe server-side crash:", error);
    res.status(500).json({
      error: "Error composing culinary recovery recipe using AI.",
      details: error.message || String(error)
    });
  }
});

// Configure Vite middleware / production serving
async function configureServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running in ${process.env.NODE_ENV || "development"} mode on http://0.0.0.0:${PORT}`);
  });
}

configureServer();
