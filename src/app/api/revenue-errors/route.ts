import { NextRequest, NextResponse } from "next/server";

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

export interface RevenueError {
  timestamp: string;
  errorType: string;
  errorMessage: string;
  context: string | null;
  userId: string | null;
  country: string | null;
  platform: string | null;
  errorCode: string | null;
  specificErrorType: string | null;
  reason: string | null;
  duration: number | null;
  userMessage: string | null;
  isUserCancelled: boolean | null;
  isNetworkError: boolean | null;
  isStoreError: boolean | null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { error: "dateFrom and dateTo parameters are required" },
        { status: 400 }
      );
    }

    // Build HogQL query to fetch revenue errors
    // NOTE: This query fetches ERROR events only. Success events like:
    // - revenue_cat_configure_started, revenue_cat_configure_success
    // - load_offerings_started, load_offerings_success, load_offerings_no_current
    // - purchase_package_started, purchase_package_store_initiated, purchase_package (success)
    // - restore_purchases_started, restore_purchases (success)
    // - revenue_cat_posthog_user_id_set
    // - premium_cache_invalidated, premium_access_checked
    // are NOT included. Add includeSuccess=true parameter to fetch all events in the future.
    const query = `
      SELECT 
        timestamp,
        event as errorType,
        JSONExtractString(properties, 'error') as errorMessage,
        JSONExtractString(properties, 'context') as context,
        distinct_id as userId,
        JSONExtractString(properties, 'country') as country,
        JSONExtractString(properties, 'platform') as platform,
        JSONExtractString(properties, 'error_code') as errorCode,
        JSONExtractString(properties, 'error_type') as specificErrorType,
        JSONExtractString(properties, 'reason') as reason,
        JSONExtractString(properties, 'duration') as duration,
        JSONExtractString(properties, 'user_message') as userMessage,
        JSONExtractString(properties, 'isUserCancelled') as isUserCancelled,
        JSONExtractString(properties, 'isNetworkError') as isNetworkError,
        JSONExtractString(properties, 'isStoreError') as isStoreError,
        JSONExtractString(properties, 'action') as action
      FROM events
      WHERE 
        (
          event IN (
            'purchase_package_error',
            'restore_purchases_error',
            'load_offerings_error',
            'failed_check_subscription',
            'revenue_cat_configure_error',
            'revenue_cat_posthog_user_id_error'
          )
          OR (
            event = 'price_screen_action' 
            AND JSONExtractString(properties, 'action') IN ('purchase_error', 'restore_error', 'package_load_failed')
          )
        )
        AND timestamp >= toDateTime('${dateFrom}')
        AND timestamp <= toDateTime('${dateTo}')
      ORDER BY timestamp DESC
      LIMIT 1000
    `;

    const results = await queryPostHogArray(query);

    // Parse results into RevenueError objects
    const errors: RevenueError[] = results.map((row) => {
      const [
        timestamp,
        errorType,
        errorMessage,
        context,
        userId,
        country,
        platform,
        errorCode,
        specificErrorType,
        reason,
        duration,
        userMessage,
        isUserCancelled,
        isNetworkError,
        isStoreError,
        action,
      ] = row;

      // For price_screen_action events, append the action to the error type
      let displayErrorType = String(errorType);
      if (errorType === "price_screen_action" && action) {
        displayErrorType = `price_screen_action (${action})`;
      }

      return {
        timestamp: String(timestamp),
        errorType: displayErrorType,
        errorMessage: errorMessage ? String(errorMessage) : "No error message",
        context: context ? String(context) : null,
        userId: userId ? String(userId) : null,
        country: country ? String(country) : null,
        platform: platform ? String(platform) : null,
        errorCode: errorCode ? String(errorCode) : null,
        specificErrorType: specificErrorType ? String(specificErrorType) : null,
        reason: reason ? String(reason) : null,
        duration: duration && String(duration) !== "" ? Number(duration) : null,
        userMessage: userMessage ? String(userMessage) : null,
        isUserCancelled:
          isUserCancelled !== null && isUserCancelled !== undefined
            ? Boolean(isUserCancelled)
            : null,
        isNetworkError:
          isNetworkError !== null && isNetworkError !== undefined
            ? Boolean(isNetworkError)
            : null,
        isStoreError:
          isStoreError !== null && isStoreError !== undefined
            ? Boolean(isStoreError)
            : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: errors,
      count: errors.length,
    });
  } catch (error) {
    console.error("Error fetching revenue errors:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

