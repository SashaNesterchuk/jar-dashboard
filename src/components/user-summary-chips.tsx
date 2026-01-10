"use client";

import * as React from "react";
import { CardBlock } from "./custom/card-block";

interface UserSummaryChipsProps {
  userId: string;
  onUserNameLoad?: (userName: string | null) => void;
}

interface SummaryData {
  userName: string | null;
  totalSessions: number;
  totalPractices: number;
  totalCheckins: number;
}

export function UserSummaryChips({ userId, onUserNameLoad }: UserSummaryChipsProps) {
  const [data, setData] = React.useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchSummary = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/users/${encodeURIComponent(userId)}/summary`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch user summary");
        }

        const result = await response.json();
        const summaryData = {
          userName: result.userName || null,
          totalSessions: result.totalSessions || 0,
          totalPractices: result.totalPractices || 0,
          totalCheckins: result.totalCheckins || 0,
        };
        
        setData(summaryData);
        
        // Call callback with userName
        if (onUserNameLoad) {
          onUserNameLoad(summaryData.userName);
        }
      } catch (err) {
        console.error("Error fetching user summary:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setData({
          userName: null,
          totalSessions: 0,
          totalPractices: 0,
          totalCheckins: 0,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [userId, onUserNameLoad]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm font-medium text-destructive">
          Error loading summary: {error}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <CardBlock
        title="Total Sessions"
        value={isLoading ? "..." : (data?.totalSessions || 0).toLocaleString()}
        period=""
      />
      <CardBlock
        title="Total Practices Started"
        value={isLoading ? "..." : (data?.totalPractices || 0).toLocaleString()}
        period=""
      />
      <CardBlock
        title="Total Check-ins"
        value={isLoading ? "..." : (data?.totalCheckins || 0).toLocaleString()}
        period=""
      />
    </div>
  );
}

