"use client";

import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CardBlock } from "./custom/card-block";
import { useState, useEffect } from "react";

interface AnalyticsData {
  dau: {
    value: number;
    previous: number;
    delta: number;
    change: string;
  };
  wau: {
    value: number;
    previous: number;
    delta: number;
    change: string;
  };
  mau: {
    value: number;
    previous: number;
    delta: number;
    change: string;
  };
}

async function getAnalyticsData(): Promise<AnalyticsData> {
  try {
    const response = await fetch("/api/analytics", {
      cache: "no-store", // Always fetch fresh data
    });

    if (!response.ok) {
      throw new Error("Failed to fetch analytics data");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching analytics:", error);
    // Return zero values on error
    return {
      dau: { value: 0, previous: 0, delta: 0, change: "+0.0%" },
      wau: { value: 0, previous: 0, delta: 0, change: "+0.0%" },
      mau: { value: 0, previous: 0, delta: 0, change: "+0.0%" },
    };
  }
}

export function SectionCards() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>({
    dau: { value: 0, previous: 0, delta: 0, change: "+0.0%" },
    wau: { value: 0, previous: 0, delta: 0, change: "+0.0%" },
    mau: { value: 0, previous: 0, delta: 0, change: "+0.0%" },
  });
  const [isLoading, setIsLoading] = useState(true);
  const fetchAnalytics = async () => {
    console.log("Fetching analytics data...");
    setIsLoading(true);
    try {
      const data = await getAnalyticsData();
      console.log("Analytics data received:", data);
      setAnalytics(data);
    } catch (error) {
      console.error("Error in fetchAnalytics:", error);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchAnalytics();
  }, []);
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <CardBlock
        title="Daily Active Users"
        value={analytics?.dau.value || 0}
        change={analytics?.dau.change || "+0.0%"}
        period="vs Yesterday"
        delta={analytics?.dau.delta}
        previous={analytics?.dau.previous}
      />
      <CardBlock
        title="Weekly Active Users"
        value={analytics?.wau.value || 0}
        change={analytics?.wau.change || "+0.0%"}
        period="vs Previous 7 days"
        delta={analytics?.wau.delta}
        previous={analytics?.wau.previous}
      />
      <CardBlock
        title="Monthly Active Users"
        value={analytics?.mau.value || 0}
        change={analytics?.mau.change || "+0.0%"}
        period="vs Previous 30 days"
        delta={analytics?.mau.delta}
        previous={analytics?.mau.previous}
      />
    </div>
  );
}
