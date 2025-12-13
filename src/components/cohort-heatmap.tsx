"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CohortData {
  cohortDate: string;
  cohortSize: number;
  retention: {
    day0: number;
    day1: number;
    day7: number;
    day14: number;
    day30: number;
    day60?: number;
    day90?: number;
  };
}

interface CohortHeatmapProps {
  cohorts: CohortData[];
  showExtendedDays?: boolean;
}

function getRetentionColor(percentage: number): string {
  // Color gradient from red (poor) to green (good)
  if (percentage >= 50) return "bg-green-600 text-white";
  if (percentage >= 40) return "bg-green-500 text-white";
  if (percentage >= 30) return "bg-yellow-500 text-gray-900";
  if (percentage >= 20) return "bg-orange-500 text-white";
  if (percentage >= 10) return "bg-red-500 text-white";
  return "bg-red-600 text-white";
}

function formatCohortDate(dateStr: string): string {
  // Handle both "2025-W01" and "2025-01" formats
  if (dateStr.includes("W")) {
    return dateStr; // Weekly format
  } else {
    // Monthly format - convert to readable
    const [year, month] = dateStr.split("-");
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  }
}

export function CohortHeatmap({
  cohorts,
  showExtendedDays = false,
}: CohortHeatmapProps) {
  if (!cohorts || cohorts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No cohort data available
      </div>
    );
  }

  const retentionDays = showExtendedDays
    ? ["day0", "day1", "day7", "day14", "day30", "day60", "day90"]
    : ["day0", "day1", "day7", "day14", "day30"];

  const dayLabels: Record<string, string> = {
    day0: "D0",
    day1: "D1",
    day7: "D7",
    day14: "D14",
    day30: "D30",
    day60: "D60",
    day90: "D90",
  };

  return (
    <div className="rounded-md border overflow-x-auto">
      <TooltipProvider>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10 min-w-[120px]">
                Cohort
              </TableHead>
              <TableHead className="text-center min-w-[80px]">Size</TableHead>
              {retentionDays.map((day) => (
                <TableHead key={day} className="text-center min-w-[80px]">
                  {dayLabels[day]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {cohorts.map((cohort) => {
              const now = new Date();
              const cohortDate = new Date(cohort.cohortDate);
              const daysAgo = Math.floor(
                (now.getTime() - cohortDate.getTime()) / (1000 * 60 * 60 * 24)
              );

              return (
                <TableRow key={cohort.cohortDate}>
                  <TableCell className="sticky left-0 bg-background z-10 font-medium">
                    {formatCohortDate(cohort.cohortDate)}
                  </TableCell>
                  <TableCell className="text-center">
                    {cohort.cohortSize.toLocaleString()}
                  </TableCell>
                  {retentionDays.map((day) => {
                    const dayNumber = parseInt(day.replace("day", ""));
                    const percentage =
                      cohort.retention[day as keyof typeof cohort.retention] ||
                      0;

                    // Don't show data if cohort is too new
                    const isDataAvailable = daysAgo >= dayNumber;

                    if (!isDataAvailable) {
                      return (
                        <TableCell
                          key={day}
                          className="text-center bg-gray-100 text-gray-400"
                        >
                          -
                        </TableCell>
                      );
                    }

                    const colorClass = getRetentionColor(percentage);

                    return (
                      <Tooltip key={day}>
                        <TooltipTrigger asChild>
                          <TableCell
                            className={`text-center cursor-pointer transition-opacity hover:opacity-80 ${colorClass}`}
                          >
                            {percentage}%
                          </TableCell>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-sm">
                            <div className="font-semibold">
                              {formatCohortDate(cohort.cohortDate)} -{" "}
                              {dayLabels[day]}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Cohort Size: {cohort.cohortSize.toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Retained:{" "}
                              {Math.round(
                                (cohort.cohortSize * percentage) / 100
                              ).toLocaleString()}{" "}
                              users ({percentage}%)
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TooltipProvider>

      {/* Legend */}
      <div className="p-4 border-t bg-muted/50">
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium">Retention Rate:</span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-red-600"></div>
              <span className="text-xs text-muted-foreground">&lt;10%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-orange-500"></div>
              <span className="text-xs text-muted-foreground">10-20%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-yellow-500"></div>
              <span className="text-xs text-muted-foreground">20-30%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-green-500"></div>
              <span className="text-xs text-muted-foreground">30-40%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-green-600"></div>
              <span className="text-xs text-muted-foreground">&gt;40%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
