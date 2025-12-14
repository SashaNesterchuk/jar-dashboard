import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AnalyticsCapture {
  [key: string]: string;
}

interface UserEvent {
  event: string;
  timestamp: string;
  properties?: Record<string, any>;
}

interface AnalysisResult {
  whatISee: string;
  conclusions: string;
  assumptions: string;
  rawResponse: string;
}

// Technical events to exclude from user behavior analysis
// Only truly technical/system events - not user actions
const TECHNICAL_EVENTS = [
  "revenue_cat_configure",
  "revenue_cat_posthog_user_id",
  "premium_status_hook_initialized",
  "premium_cache_invalidated",
  "screen_load_time",
  "app_startup_time",
  "api_response_time",
  "ai_generation_time",
  "load_offerings_started",
  "load_offerings_success",
  "load_offerings_error",
  "load_offerings_no_current",
  "$pageview", // Auto-tracked pageviews
];

// No filtering - we want to see ALL user events
function isUserFacingEvent(eventName: string): boolean {
  // Return true for all events - no filtering
  return true;
}

function getUniqueEventNames(events: UserEvent[]): string[] {
  // No filtering - take all events
  const allEventNames = events.map((e) => e.event);

  console.log(`Total events received: ${events.length}`);

  // Get unique event names - NO LIMIT, take all unique types
  const unique = Array.from(new Set(allEventNames));

  console.log(`Unique event types: ${unique.length}`);
  console.log(`Event types:`, unique);

  // Return ALL unique events - no limits
  return unique;
}

function buildPrompt(
  uniqueEvents: string[],
  analyticsCapture: AnalyticsCapture
): string {
  // Build event descriptions
  const eventDescriptions = uniqueEvents
    .map((eventName) => {
      const description = analyticsCapture[eventName] || "Опис події відсутній";
      return `- ${eventName}: ${description}`;
    })
    .join("\n");

  return `Ти - аналітик поведінки користувачів додатку Mind Jar (застосунок для ментального здоров'я).

У тебе є список УНІКАЛЬНИХ подій (events), які користувач зробив за певний період:

${eventDescriptions}

Проаналізуй поведінку користувача та надай відповідь українською мовою у форматі:

## ЩО БАЧУ
[Опиши які дії користувач виконував, якими функціями користувався, які практики завершував. Будь конкретним, базуйся ТІЛЬКИ на наданих подіях.]

## ВИСНОВКИ
[Опиши основні патерни поведінки, що користувач намагається досягти, який рівень залученості.]

## ПРИПУЩЕННЯ
[Опиши можливі причини поведінки, що може цікавити користувача далі.]

ВАЖЛИВО:
- Базуйся ТІЛЬКИ на наданих подіях
- НЕ вигадуй події, яких немає
- Пиши українською мовою
- Будь конкретним та лаконічним
- Використовуй опис подій для кращого розуміння контексту`;
}

function parseAnalysisResponse(response: string): AnalysisResult {
  // Try to extract sections from the response
  const whatISeeMatch = response.match(/##\s*ЩО БАЧУ\s*\n([\s\S]*?)(?=##|$)/i);
  const conclusionsMatch = response.match(
    /##\s*ВИСНОВКИ\s*\n([\s\S]*?)(?=##|$)/i
  );
  const assumptionsMatch = response.match(
    /##\s*ПРИПУЩЕННЯ\s*\n([\s\S]*?)(?=##|$)/i
  );

  return {
    whatISee: whatISeeMatch?.[1]?.trim() || "",
    conclusions: conclusionsMatch?.[1]?.trim() || "",
    assumptions: assumptionsMatch?.[1]?.trim() || "",
    rawResponse: response,
  };
}

export async function analyzeUserBehavior(
  events: UserEvent[],
  analyticsCapture: AnalyticsCapture
): Promise<AnalysisResult> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    if (events.length === 0) {
      return {
        whatISee: "Жодних подій не знайдено за цей період.",
        conclusions: "Користувач не виконував жодних дій.",
        assumptions: "Можливо, користувач не користувався застосунком.",
        rawResponse: "",
      };
    }

    // Get unique user-facing events
    const uniqueEvents = getUniqueEventNames(events);

    if (uniqueEvents.length === 0) {
      return {
        whatISee: "Знайдено лише технічні події, жодних дій користувача.",
        conclusions: "Немає даних про поведінку користувача.",
        assumptions:
          "Неможливо зробити висновки без даних про дії користувача.",
        rawResponse: "",
      };
    }

    const prompt = buildPrompt(uniqueEvents, analyticsCapture);

    // Call OpenAI API with GPT-4o-mini for cost optimization
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Ти - експерт аналітик поведінки користувачів застосунків для ментального здоров'я. Пиши українською мовою.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const responseText = completion.choices[0]?.message?.content || "";

    if (!responseText) {
      throw new Error("Empty response from OpenAI");
    }

    return parseAnalysisResponse(responseText);
  } catch (error) {
    console.error("Error analyzing user behavior:", error);

    if (error instanceof Error) {
      throw new Error(`Failed to analyze user behavior: ${error.message}`);
    }

    throw new Error("Failed to analyze user behavior: Unknown error");
  }
}
