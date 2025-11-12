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
    // In server components, we can use relative URLs
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
      }/api/analytics`,
      {
        cache: "no-store", // Always fetch fresh data
      }
    );

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

export async function SectionCards() {
  const analytics = await getAnalyticsData();
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <CardBlock
        title="Daily Active Users"
        value={analytics.dau.value}
        change={analytics.dau.change}
        period="vs Yesterday"
      />
      <CardBlock
        title="Weekly Active Users"
        value={analytics.wau.value}
        change={analytics.wau.change}
        period="vs Previous 7 days"
      />
      <CardBlock
        title="Monthly Active Users"
        value={analytics.mau.value}
        change={analytics.mau.change}
        period="vs Previous 30 days"
      />
    </div>
  );
}
