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
  value: number;
  change?: string;
  period: string;
}
export function CardBlock({ title, value, change, period }: CardBlockProps) {
  const isPositive = change?.startsWith("+");
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
        <CardAction>
          {change && (
            <Badge variant="outline">
              {isPositive ? <IconTrendingUp /> : <IconTrendingDown />}
              {change}
            </Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">{period}</div>
      </CardFooter>
    </Card>
  );
}
