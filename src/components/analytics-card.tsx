import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AnalyticsCardProps {
  title: string;
  value: number;
  change: string;
  delta: number;
  period: string;
}

export function AnalyticsCard({
  title,
  value,
  change,
  delta,
  period,
}: AnalyticsCardProps) {
  const isPositive = delta >= 0;
  const changeColor = isPositive
    ? "text-green-600 dark:text-green-400"
    : "text-red-600 dark:text-red-400";

  const formattedValue = new Intl.NumberFormat("en-US").format(value);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          {period}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <div className="flex flex-col gap-1">
            <div className="text-3xl font-bold tracking-tight">
              {formattedValue}
            </div>
            <div className={`text-sm font-medium ${changeColor}`}>{change}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
