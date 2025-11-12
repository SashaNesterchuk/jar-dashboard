import { AnalyticsCard } from "@/components/analytics-card";

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

export default async function Home() {
  const analytics = await getAnalyticsData();

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <main className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-black dark:text-zinc-50">
            Analytics Dashboard
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Key metrics for Mind Jar app
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <AnalyticsCard
            title="Daily Active Users"
            value={analytics.dau.value}
            change={analytics.dau.change}
            delta={analytics.dau.delta}
            period="vs Yesterday"
          />
          <AnalyticsCard
            title="Weekly Active Users"
            value={analytics.wau.value}
            change={analytics.wau.change}
            delta={analytics.wau.delta}
            period="vs Previous 7 days"
          />
          <AnalyticsCard
            title="Monthly Active Users"
            value={analytics.mau.value}
            change={analytics.mau.change}
            delta={analytics.mau.delta}
            period="vs Previous 30 days"
          />
        </div>
      </main>
    </div>
  );
}
