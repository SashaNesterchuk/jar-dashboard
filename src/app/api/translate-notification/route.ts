import { NextRequest } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TranslationRequest {
  title: string;
  bodyShort: string;
  bodyLong: string;
}

const LANGUAGES = [
  { code: "es", name: "Spanish (Español)" },
  { code: "de", name: "German (Deutsch)" },
  { code: "fr", name: "French (Français)" },
  { code: "pt", name: "Portuguese (Português)" },
  { code: "uk", name: "Ukrainian (Українська)" },
];

export async function POST(req: NextRequest) {
  try {
    const body: TranslationRequest = await req.json();

    // Validate input
    if (!body.title || !body.bodyShort || !body.bodyLong) {
      return Response.json(
        { error: "Missing required fields: title, bodyShort, bodyLong" },
        { status: 400 }
      );
    }

    // Build prompt for all languages at once
    const prompt = `You are translating push notification content for a mental wellness mobile app called "Mind Jar".

Translate the following notification from English to ALL of these languages: Spanish (es), German (de), French (fr), Portuguese (pt), and Ukrainian (uk).

IMPORTANT RULES:
- Keep the meaning and intent of the original text
- Make it engaging and appealing to encourage users to open the app
- Don't invent new content, stay true to the original message
- Use natural, native-sounding language for each target language
- Keep character limits in mind (this is for mobile push notifications)
- Title should be around 30-50 characters
- Body (short) should be around 90-120 characters  
- Body (long) should be around 180-250 characters

Original English content:
Title: ${body.title}
Body (short): ${body.bodyShort}
Body (long): ${body.bodyLong}

Respond ONLY with valid JSON in this EXACT format (no markdown, no code blocks):
{
  "es": {
    "title": "translated Spanish title",
    "bodyShort": "translated Spanish short body",
    "bodyLong": "translated Spanish long body"
  },
  "de": {
    "title": "translated German title",
    "bodyShort": "translated German short body",
    "bodyLong": "translated German long body"
  },
  "fr": {
    "title": "translated French title",
    "bodyShort": "translated French short body",
    "bodyLong": "translated French long body"
  },
  "pt": {
    "title": "translated Portuguese title",
    "bodyShort": "translated Portuguese short body",
    "bodyLong": "translated Portuguese long body"
  },
  "uk": {
    "title": "translated Ukrainian title",
    "bodyShort": "translated Ukrainian short body",
    "bodyLong": "translated Ukrainian long body"
  }
}`;

    console.log("Calling OpenAI for translations...");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional translator specializing in mobile app notifications. You always respond with valid JSON only, no markdown formatting.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content?.trim();

    if (!responseText) {
      throw new Error("Empty response from OpenAI");
    }

    console.log("OpenAI response:", responseText);

    // Parse JSON response (handle potential markdown code blocks)
    let translations;
    try {
      // Remove markdown code blocks if present
      const cleanedResponse = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      
      translations = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Response text:", responseText);
      throw new Error("Failed to parse OpenAI response as JSON");
    }

    // Validate structure
    for (const lang of LANGUAGES) {
      if (
        !translations[lang.code] ||
        !translations[lang.code].title ||
        !translations[lang.code].bodyShort ||
        !translations[lang.code].bodyLong
      ) {
        throw new Error(`Missing translation for language: ${lang.code}`);
      }
    }

    console.log("Translations completed successfully");

    return Response.json(translations, { status: 200 });
  } catch (error: any) {
    console.error("Error in translate-notification:", error);
    
    // Return user-friendly error messages
    if (error.message?.includes("API key")) {
      return Response.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    if (error.message?.includes("rate limit")) {
      return Response.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429 }
      );
    }

    return Response.json(
      { error: error.message || "Translation failed" },
      { status: 500 }
    );
  }
}

