"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { IconArrowLeft, IconLoader, IconBrain } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/date-range-picker";
import { UserEventsTimeline } from "@/components/user-events-timeline";
import { AIReviewSection } from "@/components/ai-review-section";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface UserEvent {
  timestamp: string;
  event: string;
  sessionId: string;
  properties: Record<string, any>;
}

interface UserEventsResponse {
  userId: string;
  startDate: string;
  endDate: string;
  events: UserEvent[];
  totalEvents: number;
}

export default function UserEventsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const router = useRouter();
  const resolvedParams = React.use(params);
  const { userId } = resolvedParams;

  // State
  const [events, setEvents] = React.useState<UserEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  // AI Review state
  const [aiAnalysis, setAiAnalysis] = React.useState<any>(null);
  const [isAiLoading, setIsAiLoading] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [showAiReview, setShowAiReview] = React.useState(false);

  // Date range state - default to today
  const getDefaultDateRange = () => {
    const today = new Date();
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const [dateRange, setDateRange] = React.useState(getDefaultDateRange);

  // Fetch events
  const fetchEvents = React.useCallback(
    async (start: Date, end: Date) => {
      setIsLoading(true);
      setError(null);

      try {
        const startIso = start.toISOString();
        const endIso = end.toISOString();

        const response = await fetch(
          `/api/users/${encodeURIComponent(
            userId
          )}/events?startDate=${encodeURIComponent(
            startIso
          )}&endDate=${encodeURIComponent(endIso)}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch user events");
        }

        const data: UserEventsResponse = await response.json();
        setEvents(data.events);
      } catch (err) {
        console.error("Error fetching events:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setEvents([]);
      } finally {
        setIsLoading(false);
      }
    },
    [userId]
  );

  // Fetch events on mount and when date range changes
  React.useEffect(() => {
    fetchEvents(dateRange.start, dateRange.end);
  }, [fetchEvents, dateRange]);

  // Handle date range change
  const handleDateRangeChange = (start: Date, end: Date) => {
    setDateRange({ start, end });
  };

  // Copy user ID to clipboard
  const handleCopyUserId = async () => {
    await navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle AI Review
  const handleAIReview = async () => {
    setIsAiLoading(true);
    setAiError(null);
    setShowAiReview(true);

    try {
      const response = await fetch(
        `/api/users/${encodeURIComponent(userId)}/ai-review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            startDate: dateRange.start.toISOString(),
            endDate: dateRange.end.toISOString(),
          }),
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate AI review");
      }

      const data = await response.json();
      setAiAnalysis(data.analysis);
    } catch (err) {
      console.error("Error generating AI review:", err);
      setAiError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto flex h-16 items-center gap-4 px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard")}
            className="shrink-0"
          >
            <IconArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to dashboard</span>
          </Button>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h1 className="text-xl font-semibold truncate">User Events</h1>
            <TooltipProvider>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleCopyUserId}
                    className="cursor-pointer rounded-md bg-muted px-3 py-1 font-mono text-sm hover:bg-muted/80 transition-colors truncate max-w-xs"
                  >
                    {userId}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    {copied ? (
                      <span className="text-green-500">✓ Copied!</span>
                    ) : (
                      <span>Click to copy user ID</span>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {!isLoading && (
            <div className="text-sm text-muted-foreground hidden sm:block">
              {events.length} event{events.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 lg:px-6 lg:py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Date Range Picker */}
          <DateRangePicker
            startDate={dateRange.start}
            endDate={dateRange.end}
            onDateRangeChange={handleDateRangeChange}
          />

          {/* AI Review Button */}
          <div className="flex justify-center">
            <Button
              onClick={handleAIReview}
              disabled={isAiLoading || isLoading || events.length === 0}
              size="lg"
              className="gap-2"
            >
              <IconBrain className="h-5 w-5" />
              {isAiLoading ? "Генерується AI аналіз..." : "AI Review"}
            </Button>
          </div>

          {/* AI Review Section */}
          {showAiReview && (
            <AIReviewSection
              analysis={aiAnalysis}
              isLoading={isAiLoading}
              error={aiError}
              totalEvents={events.length}
            />
          )}

          {/* Error State */}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="text-sm font-medium text-destructive">
                Error loading events: {error}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchEvents(dateRange.start, dateRange.end)}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12">
              <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Loading events...</span>
            </div>
          )}

          {/* Timeline */}
          {!isLoading && !error && (
            <UserEventsTimeline events={events} isLoading={isLoading} />
          )}
        </div>
      </main>
    </div>
  );
}
