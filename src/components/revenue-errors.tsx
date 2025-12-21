"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { IconLoader, IconDownload } from "@tabler/icons-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RevenueError } from "@/app/api/revenue-errors/route";

type TimeRange = "24h" | "7d" | "30d";

function getCountryFlag(countryCode: string | null): string {
  if (!countryCode || countryCode.length !== 2) {
    return "🏳️";
  }

  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function getTimeRangeLabel(range: TimeRange): string {
  switch (range) {
    case "24h":
      return "Last 24 hours";
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
  }
}

function getDateRange(range: TimeRange): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const dateTo = now.toISOString();

  let dateFrom: Date;
  switch (range) {
    case "24h":
      dateFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  return {
    dateFrom: dateFrom.toISOString(),
    dateTo,
  };
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Europe/Warsaw",
      timeZoneName: "short",
    }).format(date);
  } catch {
    return timestamp;
  }
}

function getErrorTypeBadgeVariant(errorType: string): "destructive" | "default" {
  return "destructive";
}

const CopyableTooltip = ({
  text,
  children,
}: {
  text: string;
  children?: React.ReactNode;
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div className="cursor-help overflow-hidden text-ellipsis whitespace-nowrap">
            {children || text}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-md cursor-pointer select-text"
          onClick={handleCopy}
        >
          <div className="wrap-break-word">
            {text}
            {copied && (
              <span className="ml-2 text-xs text-green-500">✓ Copied!</span>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

function exportToCSV(errors: RevenueError[], timeRange: string) {
  // Define CSV headers
  const headers = [
    "Timestamp",
    "User ID",
    "Country",
    "Error Type",
    "Error Message",
    "Context",
    "Platform",
    "Error Code",
    "Specific Error Type",
    "Reason",
    "Duration (ms)",
    "User Message",
    "Is User Cancelled",
    "Is Network Error",
    "Is Store Error",
  ];

  // Convert errors to CSV rows
  const rows = errors.map((error) => [
    error.timestamp,
    error.userId || "",
    error.country || "",
    error.errorType,
    error.errorMessage,
    error.context || "",
    error.platform || "",
    error.errorCode || "",
    error.specificErrorType || "",
    error.reason || "",
    error.duration?.toString() || "",
    error.userMessage || "",
    error.isUserCancelled?.toString() || "",
    error.isNetworkError?.toString() || "",
    error.isStoreError?.toString() || "",
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  // Create blob and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `revenue-errors-${timeRange}-${new Date().toISOString().split("T")[0]}.csv`
  );
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function RevenueErrors() {
  const [errors, setErrors] = useState<RevenueError[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");

  const fetchErrors = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { dateFrom, dateTo } = getDateRange(timeRange);
      const params = new URLSearchParams({ dateFrom, dateTo });
      const response = await fetch(`/api/revenue-errors?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch revenue errors: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setErrors(data.data || []);
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (err) {
      console.error("Error fetching revenue errors:", err);
      setError(err instanceof Error ? err.message : "Failed to load revenue errors");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();
  }, [timeRange]);

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-semibold">Revenue Errors</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(errors, timeRange)}
              disabled={isLoading || errors.length === 0}
            >
              <IconDownload className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Select
              value={timeRange}
              onValueChange={(value) => setTimeRange(value as TimeRange)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading revenue errors...
              </span>
            </div>
          )}

          {error && !isLoading && (
            <div className="rounded-md bg-destructive/10 p-4 text-center">
              <p className="text-sm font-medium text-destructive">{error}</p>
            </div>
          )}

          {!isLoading && !error && errors.length === 0 && (
            <div className="rounded-md bg-muted/50 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No revenue errors found for {getTimeRangeLabel(timeRange).toLowerCase()}
              </p>
            </div>
          )}

          {!isLoading && !error && errors.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[120px]">User ID</TableHead>
                    <TableHead className="w-[100px]">Country</TableHead>
                    <TableHead className="w-[220px]">Error Type</TableHead>
                    <TableHead>Error Message</TableHead>
                    <TableHead className="w-[120px]">Context</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errors.map((error, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-xs">
                        {formatTimestamp(error.timestamp)}
                      </TableCell>
                      <TableCell>
                        {error.userId ? (
                          <div className="w-28">
                            <CopyableTooltip text={error.userId}>
                              {error.userId.substring(0, 8)}...
                            </CopyableTooltip>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {error.country ? (
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getCountryFlag(error.country)}</span>
                            <span className="text-sm">{error.country}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getErrorTypeBadgeVariant(error.errorType)}>
                          {error.errorType}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="truncate" title={error.errorMessage}>
                          {error.errorMessage}
                        </div>
                        {(error.userMessage || error.reason || error.errorCode) && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {error.userMessage && (
                              <div className="truncate">User: {error.userMessage}</div>
                            )}
                            {error.reason && (
                              <div className="truncate">Reason: {error.reason}</div>
                            )}
                            {error.errorCode && (
                              <div className="truncate">Code: {error.errorCode}</div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {error.context ? (
                          <Badge variant="outline">{error.context}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Showing {errors.length} error{errors.length !== 1 ? "s" : ""} from{" "}
                  {getTimeRangeLabel(timeRange).toLowerCase()}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

