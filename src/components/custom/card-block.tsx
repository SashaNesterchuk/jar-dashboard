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

interface CardBlockProps {
  title: string;
  value: number | string;
  change?: string;
  period: string;
  delta?: number;
  previous?: number;
}
export function CardBlock({
  title,
  value,
  change,
  period,
  delta,
  previous,
}: CardBlockProps) {
  const isPositive = delta !== undefined ? delta >= 0 : change?.startsWith("+");

  // Calculate absolute difference
  const absoluteDiff =
    delta !== undefined && previous !== undefined
      ? Math.abs((value as number) - previous)
      : null;

  // Determine card color based on delta
  const cardClassName = isPositive
    ? "@container/card border-green-500/50 bg-green-500/5"
    : "@container/card border-red-500/50 bg-red-500/5";

  return (
    <Card className={cardClassName}>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
        <CardAction>
          {absoluteDiff !== null ? (
            <Badge
              variant="outline"
              className={
                isPositive
                  ? "border-green-500/50 text-green-600 dark:text-green-400"
                  : "border-red-500/50 text-red-600 dark:text-red-400"
              }
            >
              {isPositive ? <IconTrendingUp /> : <IconTrendingDown />}
              {`${isPositive ? "+" : "-"}${absoluteDiff.toLocaleString()}`}
            </Badge>
          ) : change ? (
            <Badge variant="outline">
              {isPositive ? <IconTrendingUp /> : <IconTrendingDown />}
              {change}
            </Badge>
          ) : null}
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">{period}</div>
      </CardFooter>
    </Card>
  );
}
