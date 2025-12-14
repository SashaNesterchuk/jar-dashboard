"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  IconLoader,
  IconBrain,
  IconEye,
  IconBulb,
  IconQuestionMark,
} from "@tabler/icons-react";

interface AnalysisData {
  whatISee: string;
  conclusions: string;
  assumptions: string;
  rawResponse: string;
}

interface AIReviewSectionProps {
  analysis: AnalysisData | null;
  isLoading: boolean;
  error: string | null;
  totalEvents: number;
}

export function AIReviewSection({
  analysis,
  isLoading,
  error,
  totalEvents,
}: AIReviewSectionProps) {
  if (isLoading) {
    return (
      <Card className="border-purple-500/20 bg-purple-500/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-3 py-8">
            <IconLoader className="h-6 w-6 animate-spin text-purple-600" />
            <div className="text-center">
              <p className="text-sm font-medium text-purple-900 dark:text-purple-300">
                AI аналізує поведінку користувача...
              </p>
              <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">
                Це може зайняти 10-30 секунд
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-500/20 bg-red-500/5">
        <CardContent className="pt-6">
          <div className="text-center py-4">
            <p className="text-sm font-medium text-red-900 dark:text-red-300">
              Помилка AI аналізу
            </p>
            <p className="text-xs text-red-700 dark:text-red-400 mt-1">
              {error}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return null;
  }

  return (
    <Card className="border-purple-500/20 bg-linear-to-br from-purple-500/5 to-blue-500/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconBrain className="h-6 w-6 text-purple-600" />
            <CardTitle>AI Аналіз Поведінки</CardTitle>
          </div>
          <Badge
            variant="outline"
            className="bg-purple-500/10 border-purple-500/20"
          >
            {totalEvents} подій
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* What I See Section */}
        {analysis.whatISee && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <IconEye className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300">
                Що бачу
              </h3>
            </div>
            <div className="rounded-lg bg-blue-500/10 p-4 border border-blue-500/20">
              <p className="text-sm text-foreground/90 whitespace-pre-line">
                {analysis.whatISee}
              </p>
            </div>
          </div>
        )}

        <Separator />

        {/* Conclusions Section */}
        {analysis.conclusions && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <IconBulb className="h-5 w-5 text-yellow-600" />
              <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-300">
                Висновки
              </h3>
            </div>
            <div className="rounded-lg bg-yellow-500/10 p-4 border border-yellow-500/20">
              <p className="text-sm text-foreground/90 whitespace-pre-line">
                {analysis.conclusions}
              </p>
            </div>
          </div>
        )}

        <Separator />

        {/* Assumptions Section */}
        {analysis.assumptions && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <IconQuestionMark className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-300">
                Припущення
              </h3>
            </div>
            <div className="rounded-lg bg-green-500/10 p-4 border border-green-500/20">
              <p className="text-sm text-foreground/90 whitespace-pre-line">
                {analysis.assumptions}
              </p>
            </div>
          </div>
        )}

        <div className="pt-2">
          <p className="text-xs text-muted-foreground text-center">
            Аналіз створений за допомогою GPT-4o-mini на основі подій
            користувача
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
