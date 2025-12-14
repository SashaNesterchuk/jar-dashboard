"use client";

import * as React from "react";
import { IconCalendar, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onDateRangeChange: (startDate: Date, endDate: Date) => void;
}

type PresetValue = "today" | "yesterday" | "2days" | "custom";

export function DateRangePicker({
  startDate,
  endDate,
  onDateRangeChange,
}: DateRangePickerProps) {
  const [preset, setPreset] = React.useState<PresetValue>("today");
  const [customStartDate, setCustomStartDate] = React.useState(
    startDate.toISOString().split("T")[0]
  );
  const [customEndDate, setCustomEndDate] = React.useState(
    endDate.toISOString().split("T")[0]
  );

  // Get the current selected day from startDate
  const getCurrentDay = () => {
    const day = new Date(startDate);
    day.setHours(0, 0, 0, 0);
    return day;
  };

  const setDayRange = (day: Date) => {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 999);
    onDateRangeChange(start, end);
  };

  const handlePresetChange = (value: PresetValue) => {
    setPreset(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (value) {
      case "today":
        setDayRange(today);
        break;
      case "yesterday":
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        setDayRange(yesterday);
        break;
      case "2days":
        const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
        setDayRange(twoDaysAgo);
        break;
      case "custom":
        // Don't change date for custom
        break;
    }
  };

  const handlePreviousDay = () => {
    const currentDay = getCurrentDay();
    const previousDay = new Date(currentDay.getTime() - 24 * 60 * 60 * 1000);
    setDayRange(previousDay);
    // Don't change preset - keep current selection
  };

  const handleNextDay = () => {
    const currentDay = getCurrentDay();
    const nextDay = new Date(currentDay.getTime() + 24 * 60 * 60 * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Don't go beyond today
    if (nextDay <= today) {
      setDayRange(nextDay);
      // Don't change preset - keep current selection
    }
  };

  const handleCustomDateChange = () => {
    const start = new Date(customStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(customEndDate);
    end.setHours(23, 59, 59, 999);
    
    // Validate that start is before or equal to end
    if (start <= end) {
      onDateRangeChange(start, end);
    }
  };

  const formatDisplayDate = () => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    
    // Check if it's a single day or range
    if (start.getTime() === end.getTime()) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      
      if (start.getTime() === today.getTime()) {
        return "Today";
      } else if (start.getTime() === yesterday.getTime()) {
        return "Yesterday";
      } else {
        return new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }).format(start);
      }
    } else {
      // It's a range
      const formatter = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      });
      return `${formatter.format(start)} - ${formatter.format(end)}`;
    }
  };

  const isToday = () => {
    const currentDay = getCurrentDay();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return currentDay.getTime() === today.getTime();
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <IconCalendar className="h-5 w-5 text-muted-foreground" />
        <Label className="text-sm font-medium">Date Navigation</Label>
      </div>

      <div className="flex flex-col gap-4">
        {/* Quick presets */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={preset} onValueChange={handlePresetChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="2days">2 days ago</SelectItem>
              <SelectItem value="custom">Custom period</SelectItem>
            </SelectContent>
          </Select>

          {preset === "custom" && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="custom-start-date" className="text-sm shrink-0">
                  From:
                </Label>
                <input
                  id="custom-start-date"
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="custom-end-date" className="text-sm shrink-0">
                  To:
                </Label>
                <input
                  id="custom-end-date"
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <Button onClick={handleCustomDateChange} size="sm">
                Apply
              </Button>
            </div>
          )}
        </div>

        {/* Day navigation */}
        <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/50 p-3">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePreviousDay}
            className="h-8 w-8 shrink-0"
            disabled={preset === "custom"}
          >
            <IconChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous day</span>
          </Button>

          <div className="flex-1 text-center">
            <p className="text-sm font-medium">{formatDisplayDate()}</p>
            <p className="text-xs text-muted-foreground">
              {startDate.toLocaleDateString("en-US", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              })}
              {startDate.toDateString() !== endDate.toDateString() && 
                ` - ${endDate.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                })}`
              }
            </p>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNextDay}
            disabled={isToday() || preset === "custom"}
            className="h-8 w-8 shrink-0"
          >
            <IconChevronRight className="h-4 w-4" />
            <span className="sr-only">Next day</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

