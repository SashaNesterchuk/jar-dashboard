import { NextResponse } from "next/server";

const POSTHOG_HOST = process.env.POSTHOG_HOST;
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;

if (!POSTHOG_API_KEY) {
  console.error("POSTHOG_API_KEY is not set");
}

interface PostHogQueryResponse {
  results?: Array<Array<number | string>>;
  responseData?: {
    results?: Array<Array<number | string>>;
  };
}

async function queryPostHog(query: string): Promise<number> {
  if (!POSTHOG_API_KEY) {
    throw new Error("POSTHOG_API_KEY is not configured");
  }

  const apiKey = POSTHOG_API_KEY.trim();
  const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`;
  const body = JSON.stringify({
    query: {
      kind: "HogQLQuery",
      query,
    },
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PostHog API error: ${response.status} - ${errorText}`);
  }

  const data: PostHogQueryResponse = await response.json();
  const results = data.results || data.responseData?.results;

  if (!results || results.length === 0) {
    return 0;
  }

  const value = results[0]?.[0];
  return typeof value === "number" ? value : Number(value) || 0;
}

async function queryPostHogArray(
  query: string
): Promise<Array<Array<number | string>>> {
  if (!POSTHOG_API_KEY) {
    throw new Error("POSTHOG_API_KEY is not configured");
  }

  const apiKey = POSTHOG_API_KEY.trim();
  const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`;
  const body = JSON.stringify({
    query: {
      kind: "HogQLQuery",
      query,
    },
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PostHog API error: ${response.status} - ${errorText}`);
  }

  const data: PostHogQueryResponse = await response.json();
  const results = data.results || data.responseData?.results;

  if (!results || results.length === 0) {
    return [];
  }

  return results;
}

const NY_EVENT_START = "2025-12-10T00:00:00"; // Start one day earlier to catch all events
const NY_EVENT_END = "2026-01-20T00:00:00"; // Extended end date
const TIMEZONE = "Europe/Warsaw";
const ENVIRONMENT = "production";

// Day-to-Practice-IDs mapping from jar/events/ny.ts
// This mapping allows us to count users who completed at least one practice per day
const DAY_PRACTICE_IDS: Record<number, string[]> = {
  1: [
    "c8705946-e4d7-4d37-85ec-9ab482fc1a35", // meditation[0] - Year Reflection
    "ny-day-1-mood", // checkin[0]
    "year-reflection", // journaling
  ],
  2: [
    "ny-gratitude", // journaling (isMainInDay)
    "ny-day-2-gratitude-profile", // day2GratitudeProfile (correct ID from grep)
    "ny-day-2-mood", // checkin[1]
  ],
  3: [
    "ny-day-3-holiday-stress", // day3 (correct ID from grep)
    "holiday-stress-relief", // journaling
    "ny-day-3-mood", // checkin[2]
  ],
  4: [
    "present-moment", // journaling (isMainInDay)
    "5f224699-f450-4127-a9d4-3a25f10de1a7", // day4 meditation
    "ny-day-4-mood", // checkin[3]
  ],
  5: [
    "4787a3b1-fd54-4e60-9bd3-b6779e43a6e8", // meditation[1] - Winter Peace
    "ny-day-5-mood", // checkin[4]
    "winter-comfort", // journaling
  ],
  6: [
    "ny-day-6-holiday-boundaries", // day6HolidayBoundaries (correct ID from grep)
    "ny-day-6-mood", // checkin[5]
    "setting-boundaries", // journaling
  ],
  7: [
    "letting-go", // journaling (isMainInDay)
    "a513fb29-125a-460a-b646-68b8fbef5e13", // day7 meditation
    "ny-day-7-mood", // checkin[6]
  ],
  8: [
    "ny-day-8-values-compass", // day8ValuesCompass (correct ID from grep)
    "ny-day-8-mood", // checkin[7]
    "what-truly-matters", // journaling
  ],
  9: [
    "letter-to-future-self", // journaling (isMainInDay)
    "ny-day-9-future-self", // day9FutureSelfTest
    "ny-day-9-mood", // checkin[8]
  ],
  10: [
    "de02d865-f6be-4961-99ae-4af908a07358", // meditation[2] - Inner Strength
    "ny-day-10-mood", // checkin[9]
    "inner-light", // journaling
  ],
  11: [
    "ny-day-11-joy-recognition", // day11JoyRecognition
    "ny-day-11-mood", // checkin[10]
    "joy-recognition", // journaling
  ],
  12: [
    "3f5c9376-253a-4140-9d05-bc9ba5214357", // meditation[3] - Energy Renewal
    "ny-day-12-mood", // checkin[11]
    "gratitude-celebration", // journaling
  ],
};

export async function GET() {
  try {
    // Query 1: Total Participants (using screen_viewed as fallback if ny_event_started is rare)
    let totalParticipants = 0;
    try {
      // First try ny_event_started
      const participantsQuery = `
        SELECT uniqExact(JSONExtractString(properties,'user_id')) AS value 
        FROM events 
        WHERE event = 'ny_event_started'
          AND timestamp >= toDateTime('${NY_EVENT_START}','${TIMEZONE}')
          AND timestamp < toDateTime('${NY_EVENT_END}','${TIMEZONE}')
          AND JSONExtractString(properties,'consent_status') = 'granted'
          AND coalesce(JSONExtractString(properties,'environment'),'production') = '${ENVIRONMENT}'
          AND JSONExtractString(properties,'user_id') IS NOT NULL
          AND JSONExtractString(properties,'user_id') != ''
      `;
      totalParticipants = await queryPostHog(participantsQuery);

      // If no results, try counting from screen_viewed instead
      if (totalParticipants === 0) {
        const fallbackQuery = `
          SELECT uniqExact(JSONExtractString(properties,'user_id')) AS value 
          FROM events 
          WHERE event = 'screen_viewed'
            AND JSONExtractString(properties,'screen_name') = 'ny_main'
            AND timestamp >= toDateTime('${NY_EVENT_START}','${TIMEZONE}')
            AND timestamp < toDateTime('${NY_EVENT_END}','${TIMEZONE}')
            AND JSONExtractString(properties,'consent_status') = 'granted'
            AND coalesce(JSONExtractString(properties,'environment'),'production') = '${ENVIRONMENT}'
            AND JSONExtractString(properties,'user_id') IS NOT NULL
            AND JSONExtractString(properties,'user_id') != ''
        `;
        totalParticipants = await queryPostHog(fallbackQuery);
      }
    } catch (error) {
      console.error("Error fetching total participants:", error);
    }

    // Query 2: Get all completed practices for NY event
    let allCompletedPractices: Array<{
      event_id: string;
      user_id: string;
      practice_type: string;
      practice_name: string;
    }> = [];
    let allStartedPractices: Array<{
      event_id: string;
      user_id: string;
      practice_type: string;
      practice_name: string;
    }> = [];
    try {
      // Get all practice_completed events
      const practiceCompletedQuery = `
        SELECT 
          JSONExtractString(properties,'event_id') AS event_id,
          JSONExtractString(properties,'user_id') AS user_id,
          JSONExtractString(properties,'practice_type') AS practice_type,
          JSONExtractString(properties,'practice_name') AS practice_name
        FROM events
        WHERE event = 'practice_completed'
          AND timestamp >= toDateTime('${NY_EVENT_START}','${TIMEZONE}')
          AND timestamp < toDateTime('${NY_EVENT_END}','${TIMEZONE}')
          AND JSONExtractString(properties,'consent_status') = 'granted'
          AND coalesce(JSONExtractString(properties,'environment'),'production') = '${ENVIRONMENT}'
          AND JSONExtractString(properties,'user_id') IS NOT NULL
          AND JSONExtractString(properties,'user_id') != ''
          AND JSONExtractString(properties,'event_id') IS NOT NULL
          AND JSONExtractString(properties,'event_id') != ''
          AND toInt(JSONExtractString(properties,'completion_percentage')) >= 80
      `;

      // Get all event_finished events
      const eventFinishedQuery = `
        SELECT 
          JSONExtractString(properties,'event_id') AS event_id,
          JSONExtractString(properties,'user_id') AS user_id,
          coalesce(JSONExtractString(properties,'event'), 'practice') AS practice_type,
          JSONExtractString(properties,'event_title') AS practice_name
        FROM events
        WHERE event = 'event_finished'
          AND timestamp >= toDateTime('${NY_EVENT_START}','${TIMEZONE}')
          AND timestamp < toDateTime('${NY_EVENT_END}','${TIMEZONE}')
          AND JSONExtractString(properties,'consent_status') = 'granted'
          AND coalesce(JSONExtractString(properties,'environment'),'production') = '${ENVIRONMENT}'
          AND JSONExtractString(properties,'user_id') IS NOT NULL
          AND JSONExtractString(properties,'user_id') != ''
          AND JSONExtractString(properties,'event_id') IS NOT NULL
          AND JSONExtractString(properties,'event_id') != ''
      `;

      // Get all practice_started events
      const practiceStartedQuery = `
        SELECT 
          JSONExtractString(properties,'event_id') AS event_id,
          JSONExtractString(properties,'user_id') AS user_id,
          JSONExtractString(properties,'practice_type') AS practice_type,
          JSONExtractString(properties,'practice_name') AS practice_name
        FROM events
        WHERE event = 'practice_started'
          AND timestamp >= toDateTime('${NY_EVENT_START}','${TIMEZONE}')
          AND timestamp < toDateTime('${NY_EVENT_END}','${TIMEZONE}')
          AND JSONExtractString(properties,'consent_status') = 'granted'
          AND coalesce(JSONExtractString(properties,'environment'),'production') = '${ENVIRONMENT}'
          AND JSONExtractString(properties,'user_id') IS NOT NULL
          AND JSONExtractString(properties,'user_id') != ''
          AND JSONExtractString(properties,'event_id') IS NOT NULL
          AND JSONExtractString(properties,'event_id') != ''
      `;

      // Get all journaling_started events (journaling uses different event name)
      const journalingStartedQuery = `
        SELECT 
          JSONExtractString(properties,'event_id') AS event_id,
          JSONExtractString(properties,'user_id') AS user_id,
          'journaling' AS practice_type,
          JSONExtractString(properties,'event_title') AS practice_name
        FROM events
        WHERE event = 'journaling_started'
          AND timestamp >= toDateTime('${NY_EVENT_START}','${TIMEZONE}')
          AND timestamp < toDateTime('${NY_EVENT_END}','${TIMEZONE}')
          AND JSONExtractString(properties,'consent_status') = 'granted'
          AND coalesce(JSONExtractString(properties,'environment'),'production') = '${ENVIRONMENT}'
          AND JSONExtractString(properties,'user_id') IS NOT NULL
          AND JSONExtractString(properties,'user_id') != ''
          AND JSONExtractString(properties,'event_id') IS NOT NULL
          AND JSONExtractString(properties,'event_id') != ''
      `;

      // Get all mood_check_in_started events (mood uses different event name)
      const moodStartedQuery = `
        SELECT 
          JSONExtractString(properties,'check_in_id') AS event_id,
          JSONExtractString(properties,'user_id') AS user_id,
          'mood' AS practice_type,
          'Mood Check-in' AS practice_name
        FROM events
        WHERE event = 'mood_check_in_started'
          AND timestamp >= toDateTime('${NY_EVENT_START}','${TIMEZONE}')
          AND timestamp < toDateTime('${NY_EVENT_END}','${TIMEZONE}')
          AND JSONExtractString(properties,'consent_status') = 'granted'
          AND coalesce(JSONExtractString(properties,'environment'),'production') = '${ENVIRONMENT}'
          AND JSONExtractString(properties,'user_id') IS NOT NULL
          AND JSONExtractString(properties,'user_id') != ''
          AND JSONExtractString(properties,'check_in_id') IS NOT NULL
          AND JSONExtractString(properties,'check_in_id') != ''
      `;

      // Get all meditation_started events (meditation uses different event name)
      const meditationStartedQuery = `
        SELECT 
          JSONExtractString(properties,'event_id') AS event_id,
          JSONExtractString(properties,'user_id') AS user_id,
          'meditation' AS practice_type,
          JSONExtractString(properties,'event_title') AS practice_name
        FROM events
        WHERE event = 'meditation_started'
          AND timestamp >= toDateTime('${NY_EVENT_START}','${TIMEZONE}')
          AND timestamp < toDateTime('${NY_EVENT_END}','${TIMEZONE}')
          AND JSONExtractString(properties,'consent_status') = 'granted'
          AND coalesce(JSONExtractString(properties,'environment'),'production') = '${ENVIRONMENT}'
          AND JSONExtractString(properties,'user_id') IS NOT NULL
          AND JSONExtractString(properties,'user_id') != ''
          AND JSONExtractString(properties,'event_id') IS NOT NULL
          AND JSONExtractString(properties,'event_id') != ''
      `;

      const [
        practiceResults,
        eventResults,
        practiceStartedResults,
        journalingStartedResults,
        moodStartedResults,
        meditationStartedResults,
      ] = await Promise.all([
        queryPostHogArray(practiceCompletedQuery),
        queryPostHogArray(eventFinishedQuery),
        queryPostHogArray(practiceStartedQuery),
        queryPostHogArray(journalingStartedQuery),
        queryPostHogArray(moodStartedQuery),
        queryPostHogArray(meditationStartedQuery),
      ]);

      // Process completed practices - deduplicate by event_id + user_id
      const completedMap = new Map<
        string,
        {
          event_id: string;
          user_id: string;
          practice_type: string;
          practice_name: string;
        }
      >();

      [...practiceResults, ...eventResults].forEach((row) => {
        const eventId = String(row[0] || "");
        const userId = String(row[1] || "");
        const practiceType = String(row[2] || "");
        const practiceName = String(row[3] || "");

        if (eventId && userId) {
          const key = `${eventId}:${userId}`;
          if (!completedMap.has(key)) {
            completedMap.set(key, {
              event_id: eventId,
              user_id: userId,
              practice_type: practiceType,
              practice_name: practiceName,
            });
          }
        }
      });

      allCompletedPractices = Array.from(completedMap.values());

      // Process started practices - deduplicate by event_id + user_id
      // Combine all 4 types of start events
      const startedMap = new Map<
        string,
        {
          event_id: string;
          user_id: string;
          practice_type: string;
          practice_name: string;
        }
      >();

      [
        ...practiceStartedResults,
        ...journalingStartedResults,
        ...moodStartedResults,
        ...meditationStartedResults,
      ].forEach((row) => {
        const eventId = String(row[0] || "");
        const userId = String(row[1] || "");
        const practiceType = String(row[2] || "");
        const practiceName = String(row[3] || "");

        if (eventId && userId) {
          const key = `${eventId}:${userId}`;
          if (!startedMap.has(key)) {
            startedMap.set(key, {
              event_id: eventId,
              user_id: userId,
              practice_type: practiceType,
              practice_name: practiceName,
            });
          }
        }
      });

      allStartedPractices = Array.from(startedMap.values());
    } catch (error) {
      console.error("Error fetching completed practices:", error);
    }

    // Query 3: User Engagement Details (sessions only)
    let userEngagementResults: Array<Array<number | string>> = [];
    try {
      const userEngagementQuery = `
        SELECT 
          JSONExtractString(properties,'user_id') AS user_id,
          count() AS sessions
        FROM events
        WHERE event = 'screen_viewed'
          AND JSONExtractString(properties,'screen_name') = 'ny_main'
          AND timestamp >= toDateTime('${NY_EVENT_START}','${TIMEZONE}')
          AND timestamp < toDateTime('${NY_EVENT_END}','${TIMEZONE}')
          AND JSONExtractString(properties,'consent_status') = 'granted'
          AND coalesce(JSONExtractString(properties,'environment'),'production') = '${ENVIRONMENT}'
          AND JSONExtractString(properties,'user_id') IS NOT NULL
          AND JSONExtractString(properties,'user_id') != ''
        GROUP BY user_id
        ORDER BY sessions DESC
        LIMIT 100
      `;
      userEngagementResults = await queryPostHogArray(userEngagementQuery);
    } catch (error) {
      console.error("Error fetching user engagement:", error);
    }

    // Process daily activity data - count UNIQUE USERS per day
    // Note: This counts unique users who completed at least one practice each day
    // e.g., if User1 completed 3 practices on Day 1, they count as 1 user for Day 1
    // That's why the sum of daily users is typically less than totalPracticesFinished
    const dailyActivityMap = new Map<number, Set<string>>();
    const dailyPracticeCountMap = new Map<number, number>();

    // Initialize all days
    for (let i = 1; i <= 12; i++) {
      dailyActivityMap.set(i, new Set());
      dailyPracticeCountMap.set(i, 0);
    }

    // Count users who completed at least one practice per day
    // AND count total practices completed per day
    allCompletedPractices.forEach(({ event_id, user_id }) => {
      // Find which day this practice belongs to
      Object.entries(DAY_PRACTICE_IDS).forEach(([dayStr, practiceIds]) => {
        if (practiceIds.includes(event_id)) {
          const day = Number(dayStr);
          dailyActivityMap.get(day)?.add(user_id);
          dailyPracticeCountMap.set(
            day,
            (dailyPracticeCountMap.get(day) || 0) + 1
          );
        }
      });
    });

    // Create daily user activity array for all 12 days
    const dailyActivity = [];
    for (let i = 1; i <= 12; i++) {
      dailyActivity.push({
        day: `Day ${i}`,
        users: dailyActivityMap.get(i)?.size || 0,
      });
    }

    // Create daily practice activity array for all 12 days
    const dailyPracticeActivity = [];
    for (let i = 1; i <= 12; i++) {
      dailyPracticeActivity.push({
        day: `Day ${i}`,
        practices: dailyPracticeCountMap.get(i) || 0,
      });
    }

    // Process user engagement data - count attempts (not unique practices)
    const userPracticesMap = new Map<
      string,
      {
        startedCount: number;
        finishedCount: number;
        sessions: number;
      }
    >();

    // Count started practice attempts per user
    allStartedPractices.forEach(({ event_id, user_id }) => {
      // Only count NY event practices
      const isNYPractice = Object.values(DAY_PRACTICE_IDS)
        .flat()
        .includes(event_id);
      if (!isNYPractice) return;

      if (!userPracticesMap.has(user_id)) {
        userPracticesMap.set(user_id, {
          startedCount: 0,
          finishedCount: 0,
          sessions: 0,
        });
      }
      userPracticesMap.get(user_id)!.startedCount++;
    });

    // Count finished practice attempts per user
    allCompletedPractices.forEach(({ event_id, user_id }) => {
      // Only count NY event practices
      const isNYPractice = Object.values(DAY_PRACTICE_IDS)
        .flat()
        .includes(event_id);
      if (!isNYPractice) return;

      if (!userPracticesMap.has(user_id)) {
        userPracticesMap.set(user_id, {
          startedCount: 0,
          finishedCount: 0,
          sessions: 0,
        });
      }
      userPracticesMap.get(user_id)!.finishedCount++;
    });

    // Add session counts from Query 3
    userEngagementResults.forEach((row) => {
      const userId = String(row[0] || "");
      const sessions = Number(row[1]) || 0;
      if (userId) {
        if (!userPracticesMap.has(userId)) {
          userPracticesMap.set(userId, {
            startedCount: 0,
            finishedCount: 0,
            sessions,
          });
        } else {
          userPracticesMap.get(userId)!.sessions = sessions;
        }
      }
    });

    // Convert to array and sort by practices finished
    const users = Array.from(userPracticesMap.entries())
      .map(([userId, data]) => ({
        id: userId,
        name: userId,
        practicesStarted: data.startedCount,
        practicesFinished: data.finishedCount,
        sessions: data.sessions,
      }))
      .filter((user) => user.practicesStarted > 0 || user.practicesFinished > 0)
      .sort((a, b) => b.practicesFinished - a.practicesFinished)
      .slice(0, 50); // Limit to top 50 users

    // Process practice types and individual practices data
    const practiceTypesCount = {
      breathing: 0,
      meditation: 0,
      journaling: 0,
      "self-discovery": 0,
      checkin: 0,
    };

    const practiceDetailsMap = new Map<
      string,
      {
        name: string;
        type: string;
        started: number;
        finished: number;
      }
    >();

    // Count started practices by type and ID
    allStartedPractices.forEach(
      ({ event_id, practice_type, practice_name }) => {
        // Only count NY event practices
        const isNYPractice = Object.values(DAY_PRACTICE_IDS)
          .flat()
          .includes(event_id);
        if (!isNYPractice) return;

        // Normalize type
        let normalizedType = practice_type.toLowerCase();
        if (normalizedType === "question") normalizedType = "self-discovery";
        if (normalizedType === "mood") normalizedType = "checkin";

        if (!practiceDetailsMap.has(event_id)) {
          practiceDetailsMap.set(event_id, {
            name: practice_name || event_id,
            type: normalizedType,
            started: 0,
            finished: 0,
          });
        }
        practiceDetailsMap.get(event_id)!.started++;
      }
    );

    // Count finished practices by type and ID
    allCompletedPractices.forEach(
      ({ event_id, practice_type, practice_name }) => {
        // Only count NY event practices
        const isNYPractice = Object.values(DAY_PRACTICE_IDS)
          .flat()
          .includes(event_id);
        if (!isNYPractice) return;

        // Normalize type
        let normalizedType = practice_type.toLowerCase();
        if (normalizedType === "question") normalizedType = "self-discovery";
        if (normalizedType === "mood") normalizedType = "checkin";

        if (
          normalizedType in practiceTypesCount &&
          normalizedType !== "practice"
        ) {
          practiceTypesCount[
            normalizedType as keyof typeof practiceTypesCount
          ]++;
        }

        if (!practiceDetailsMap.has(event_id)) {
          practiceDetailsMap.set(event_id, {
            name: practice_name || event_id,
            type: normalizedType,
            started: 0,
            finished: 0,
          });
        }
        practiceDetailsMap.get(event_id)!.finished++;
      }
    );

    // Helper function to find which day a practice belongs to
    const findPracticeDay = (practiceId: string): number | null => {
      for (const [dayStr, practiceIds] of Object.entries(DAY_PRACTICE_IDS)) {
        if (practiceIds.includes(practiceId)) {
          return Number(dayStr);
        }
      }
      return null;
    };

    // Convert to practices array
    const practices = Array.from(practiceDetailsMap.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        type:
          data.type.charAt(0).toUpperCase() +
          data.type.slice(1).replace("-", " "),
        day: findPracticeDay(id),
        started: data.started,
        finished: data.finished,
      }))
      .sort((a, b) => b.finished - a.finished);

    // Calculate total started and finished practices for NY event
    // Note: These count practice ATTEMPTS (unique event_id + user_id pairs)
    // e.g., if User1 started Practice1, that's 1 attempt
    //       if User2 started Practice1, that's another attempt
    // This ensures totalPracticesStarted/Finished matches the sum of individual user counts
    const totalPracticesStarted = allStartedPractices.filter(({ event_id }) =>
      Object.values(DAY_PRACTICE_IDS).flat().includes(event_id)
    ).length;

    const totalPracticesFinished = allCompletedPractices.filter(
      ({ event_id }) =>
        Object.values(DAY_PRACTICE_IDS).flat().includes(event_id)
    ).length;

    return NextResponse.json({
      totalParticipants,
      totalPracticesStarted,
      totalPracticesFinished,
      dailyActivity,
      dailyPracticeActivity,
      users,
      practiceTypes: practiceTypesCount,
      practices,
    });
  } catch (error) {
    console.error("NY Event API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch NY event data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
