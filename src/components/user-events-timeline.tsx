"use client";

import * as React from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { IconChevronDown, IconChevronRight, IconAlertCircle } from "@tabler/icons-react";
import analyticsCapture from "@/utils/ANALYTICS_CAPTURE.json";

const userEventSchema = z.object({
  timestamp: z.string(),
  event: z.string(),
  sessionId: z.string(),
  properties: z.record(z.any()),
});

type UserEvent = z.infer<typeof userEventSchema>;

// Type for analytics capture descriptions
type AnalyticsCapture = Record<string, string>;

interface UserEventsTimelineProps {
  events: UserEvent[];
  isLoading?: boolean;
}

interface GroupedEvents {
  [date: string]: UserEvent[];
}

interface DuplicateStats {
  [eventName: string]: number;
}

interface DeduplicationResult {
  deduplicated: UserEvent[];
  duplicateStats: DuplicateStats;
  totalRemoved: number;
}

// Deduplicate events that happened within a short time window (500ms)
function deduplicateEvents(events: UserEvent[]): DeduplicationResult {
  if (events.length === 0) {
    return {
      deduplicated: events,
      duplicateStats: {},
      totalRemoved: 0,
    };
  }

  const deduplicated: UserEvent[] = [];
  const duplicateStats: DuplicateStats = {};
  const DEDUP_WINDOW_MS = 500; // 500 milliseconds

  for (let i = 0; i < events.length; i++) {
    const currentEvent = events[i];
    const currentTime = new Date(currentEvent.timestamp).getTime();

    // Check if this is a duplicate of the last added event
    const lastAdded = deduplicated[deduplicated.length - 1];
    if (lastAdded) {
      const lastTime = new Date(lastAdded.timestamp).getTime();
      const timeDiff = Math.abs(currentTime - lastTime);

      // If same event type and within time window, skip it
      if (
        lastAdded.event === currentEvent.event &&
        timeDiff < DEDUP_WINDOW_MS
      ) {
        // Count this duplicate
        duplicateStats[currentEvent.event] =
          (duplicateStats[currentEvent.event] || 0) + 1;
        continue;
      }
    }

    deduplicated.push(currentEvent);
  }

  const totalRemoved = Object.values(duplicateStats).reduce(
    (sum, count) => sum + count,
    0
  );

  return {
    deduplicated,
    duplicateStats,
    totalRemoved,
  };
}

function getEventDescription(eventName: string): string {
  const descriptions = analyticsCapture as AnalyticsCapture;
  return descriptions[eventName] || eventName;
}

function getEventColor(eventName: string): string {
  if (eventName.includes("check_in") || eventName.includes("mood")) {
    return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
  }
  if (
    eventName.includes("practice") ||
    eventName.includes("breathing") ||
    eventName.includes("meditation")
  ) {
    return "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20";
  }
  if (eventName.includes("journal")) {
    return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20";
  }
  if (eventName.includes("session")) {
    return "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20";
  }
  if (eventName.includes("screen") || eventName.includes("page")) {
    return "bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/20";
  }
  return "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20";
}

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return timestamp;
  }
}

function formatDate(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  } catch {
    return timestamp;
  }
}

function groupEventsByDate(events: UserEvent[]): GroupedEvents {
  const grouped: GroupedEvents = {};

  events.forEach((event) => {
    try {
      const date = new Date(event.timestamp);
      const dateKey = date.toISOString().split("T")[0];

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    } catch (error) {
      console.error("Error grouping event:", error);
    }
  });

  return grouped;
}

function EventItem({ event }: { event: UserEvent }) {
  const [expanded, setExpanded] = React.useState(false);

  // Filter out common/internal properties for cleaner display
  const displayProperties = React.useMemo(() => {
    const { user_id, session_id, consent_status, environment, ...rest } =
      event.properties;
    return rest;
  }, [event.properties]);

  const hasProperties = Object.keys(displayProperties).length > 0;
  const description = getEventDescription(event.event);
  const isUnknownEvent = description === event.event;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-sm text-muted-foreground shrink-0">
                  {formatTime(event.timestamp)}
                </span>
                <Badge
                  variant="outline"
                  className={`${getEventColor(event.event)} border`}
                >
                  {event.event}
                </Badge>
                {isUnknownEvent && (
                  <TooltipProvider>
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <IconAlertCircle className="h-4 w-4 text-yellow-600 shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Событие не описано в ANALYTICS_CAPTURE.json</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <p className="text-sm text-foreground/90 break-words">
                {description}
              </p>
            </div>
            <TooltipProvider>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-xs text-muted-foreground font-mono shrink-0">
                    {event.sessionId.slice(0, 8)}...
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <p className="font-semibold">Session ID:</p>
                    <p className="font-mono">{event.sessionId}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {hasProperties && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? (
                  <IconChevronDown className="h-4 w-4" />
                ) : (
                  <IconChevronRight className="h-4 w-4" />
                )}
                <span>
                  {Object.keys(displayProperties).length} properties
                </span>
              </button>

              {expanded && (
                <div className="rounded-md bg-muted/50 p-3">
                  <pre className="text-xs overflow-x-auto">
                    {JSON.stringify(displayProperties, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function UserEventsTimeline({
  events,
  isLoading = false,
}: UserEventsTimelineProps) {
  // Deduplicate events first
  const deduplicationResult = React.useMemo(
    () => deduplicateEvents(events),
    [events]
  );

  const { deduplicated: deduplicatedEvents, duplicateStats, totalRemoved } = deduplicationResult;

  const groupedEvents = React.useMemo(
    () => groupEventsByDate(deduplicatedEvents),
    [deduplicatedEvents]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            <div className="space-y-2">
              <div className="h-24 bg-muted animate-pulse rounded-lg" />
              <div className="h-24 bg-muted animate-pulse rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <Card className="p-12">
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground">
            No events found
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Try adjusting the date range to see more events
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Show duplicate info if any were removed */}
      {totalRemoved > 0 && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <IconAlertCircle className="h-5 w-5 text-blue-600" />
            <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
              {totalRemoved} duplicate event{totalRemoved !== 1 ? "s" : ""} removed
            </p>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-400 mb-2">
            Events that occurred within 500ms were deduplicated
          </p>
          
          {/* Duplicate breakdown */}
          <div className="mt-3 space-y-1">
            <p className="text-xs font-semibold text-blue-800 dark:text-blue-200">
              Breakdown by event type:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {Object.entries(duplicateStats)
                .sort(([, a], [, b]) => b - a)
                .map(([eventName, count]) => (
                  <div
                    key={eventName}
                    className="text-xs text-blue-700 dark:text-blue-300 flex justify-between gap-2 px-2 py-1 bg-blue-500/5 rounded"
                  >
                    <span className="truncate font-mono">{eventName}</span>
                    <span className="font-semibold shrink-0">×{count}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {Object.entries(groupedEvents)
        .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
        .map(([date, dateEvents]) => (
          <div key={date} className="space-y-4">
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 pb-2">
              <h3 className="text-lg font-semibold">
                {formatDate(dateEvents[0].timestamp)}
              </h3>
              <Separator className="mt-2" />
            </div>

            <div className="space-y-3 pl-4 border-l-2 border-muted">
              {dateEvents.map((event, index) => (
                <EventItem key={`${event.timestamp}-${index}`} event={event} />
              ))}
            </div>

            <div className="text-sm text-muted-foreground pl-4">
              {dateEvents.length} event{dateEvents.length !== 1 ? "s" : ""}
            </div>
          </div>
        ))}
    </div>
  );
}

