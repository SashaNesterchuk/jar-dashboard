"use client";

import * as React from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconLoader,
  IconArrowUp,
  IconArrowDown,
  IconSelector,
} from "@tabler/icons-react";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  Row,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { z } from "zod";

import { Button } from "@/components/ui/button";

import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@radix-ui/react-toggle-group";
import { ChartPopularPractice } from "./ui/chart-popular-practice";
import {
  meditations,
  breathes,
  questionsNe,
  journeysNew,
  questionJournalsNew,
  emptyJournal,
  morningReflection,
  moonReflection,
  onboardingDiary,
  onboardingQuestions,
  happyOnboarding,
  sadOnboarding,
} from "@/utils";

export const schema = z.object({
  id: z.string(), // event_id as string
  title: z.string(), // practice name if available
  type: z.string(), // practice type if available
  started: z.number(), // count of started
  finished: z.number(), // completions count
});

export const trialSchema = z.object({
  eventId: z.string(),
  title: z.string(),
  type: z.string(),
  period: z.string(),
  count: z.number(),
});

export const sessionSchema = z.object({
  sessionId: z.string(),
  practiceId: z.string(),
  practiceName: z.string(),
  practiceType: z.string(),
  userId: z.string(),
  userName: z.string().optional(),
  timestamp: z.string(),
  completed: z.boolean(),
  country: z.string(),
});

function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode === "Unknown" || countryCode.length !== 2) {
    return "🏳️";
  }

  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function formatPracticeType(value?: string | null) {
  if (!value) {
    return "Practice";
  }

  const normalized = value.toLowerCase();
  const typeLabels: Record<string, string> = {
    breathing: "Breathing",
    journaling: "Journal",
    journal: "Journal",
    meditation: "Meditation",
    question: "Self-discovery",
    "self-discovery": "Self-discovery",
    checkin: "Check-in",
    "check-in": "Check-in",
    mood: "Mood",
    practice: "Practice",
  };

  if (typeLabels[normalized]) {
    return typeLabels[normalized];
  }

  return normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatPeriodLabel(value?: string) {
  if (!value) {
    return "Unknown";
  }

  const normalized = value.toLowerCase();
  if (normalized === "monthly") {
    return "Monthly";
  }
  if (normalized === "annual" || normalized === "yearly") {
    return "Annual";
  }
  if (normalized === "unknown") {
    return "Unknown";
  }

  return normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function findPracticeById(id: string): { type: string } | null {
  // Combine all practice arrays to search through
  const allPractices = [
    ...meditations,
    ...breathes,
    ...questionsNe,
    ...journeysNew,
    ...questionJournalsNew,
    emptyJournal,
    morningReflection,
    moonReflection,
    onboardingDiary,
    onboardingQuestions,
    happyOnboarding,
    sadOnboarding,
  ];

  // Find practice by ID
  const practice = allPractices.find((p) => p.id === id);

  return practice ? { type: practice.type } : null;
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

// Sortable Header Component
function SortableHeader({
  column,
  children,
}: {
  column: any;
  children: React.ReactNode;
}) {
  const isSorted = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => {
        if (isSorted === "asc") {
          column.toggleSorting(true);
        } else if (isSorted === "desc") {
          column.clearSorting();
        } else {
          column.toggleSorting(false);
        }
      }}
    >
      <span>{children}</span>
      {isSorted === "asc" ? (
        <IconArrowUp className="ml-2 h-4 w-4" />
      ) : isSorted === "desc" ? (
        <IconArrowDown className="ml-2 h-4 w-4" />
      ) : (
        <IconSelector className="ml-2 h-4 w-4" />
      )}
    </Button>
  );
}

const columns: ColumnDef<z.infer<typeof schema>>[] = [
  {
    accessorKey: "id",
    header: "Event ID",
    cell: ({ row }) => (
      <div className="w-32">
        <CopyableTooltip text={row.original.id} />
      </div>
    ),
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => {
      const cleanTitle = stripHtmlTags(row.original.title);
      return (
        <div className="w-64">
          <CopyableTooltip text={cleanTitle} />
        </div>
      );
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      let displayType = row.original.type;

      // If type is "Practice", try to look up the actual type by ID
      if (displayType === "Practice") {
        const practice = findPracticeById(row.original.id);
        if (practice) {
          displayType = formatPracticeType(practice.type);
        } else {
          displayType = "Not Found";
        }
      }

      return <div className="w-32">{displayType}</div>;
    },
  },
  {
    accessorKey: "started",
    header: "Started",
    cell: ({ row }) => <div className="w-32">{row.original.started}</div>,
  },
  {
    accessorKey: "finished",
    header: "Finished",
    cell: ({ row }) => <div className="w-32">{row.original.finished}</div>,
  },
];

const sessionColumns: ColumnDef<z.infer<typeof sessionSchema>>[] = [
  {
    accessorKey: "practiceId",
    header: "Practice ID",
    cell: ({ row }) => (
      <div className="w-32">
        <CopyableTooltip text={row.original.practiceId} />
      </div>
    ),
  },
  {
    accessorKey: "practiceName",
    header: ({ column }) => (
      <SortableHeader column={column}>Practice Name</SortableHeader>
    ),
    cell: ({ row }) => {
      const cleanName = stripHtmlTags(row.original.practiceName);
      return (
        <div className="w-64">
          <CopyableTooltip text={cleanName} />
        </div>
      );
    },
  },
  {
    accessorKey: "practiceType",
    header: ({ column }) => (
      <SortableHeader column={column}>Type</SortableHeader>
    ),
    cell: ({ row }) => {
      let displayType = row.original.practiceType;
      if (displayType === "Practice") {
        const practice = findPracticeById(row.original.practiceId);
        if (practice) {
          displayType = formatPracticeType(practice.type);
        } else {
          displayType = "Not Found";
        }
      } else {
        displayType = formatPracticeType(displayType);
      }
      return <div className="w-32">{displayType}</div>;
    },
  },
  {
    accessorKey: "userId",
    header: "User ID",
    cell: ({ row }) => {
      const displayName = row.original.userName || row.original.userId;
      return (
        <div className="w-32">
          <CopyableTooltip text={row.original.userId}>
            {displayName}
          </CopyableTooltip>
        </div>
      );
    },
  },
  {
    accessorKey: "country",
    header: ({ column }) => (
      <SortableHeader column={column}>Country</SortableHeader>
    ),
    cell: ({ row }) => {
      const country = row.original.country;
      const flag = getCountryFlag(country);
      return (
        <div className="flex items-center gap-2 w-24">
          <span className="text-xl">{flag}</span>
          <span>{country}</span>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "timestamp",
    header: ({ column }) => (
      <SortableHeader column={column}>Date</SortableHeader>
    ),
    cell: ({ row }) => {
      const date = new Date(row.original.timestamp);
      return (
        <div className="w-40">
          {date.toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      );
    },
  },
  {
    accessorKey: "completed",
    header: ({ column }) => (
      <SortableHeader column={column}>Completed</SortableHeader>
    ),
    cell: ({ row }) => (
      <div className="w-24">
        {row.original.completed ? (
          <span className="text-green-600">✓ Yes</span>
        ) : (
          <span className="text-muted-foreground">✗ No</span>
        )}
      </div>
    ),
  },
];

function DraggableRow({ row }: { row: Row<z.infer<typeof schema>> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  });

  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      ref={setNodeRef}
      className="relative z-0 "
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

export function PracticeTable({}: {}) {
  const [timeRange, setTimeRange] = React.useState("7d");
  const [data, setData] = React.useState<z.infer<typeof schema>[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [trialRows, setTrialRows] = React.useState<
    z.infer<typeof trialSchema>[]
  >([]);
  const [isTrialLoading, setIsTrialLoading] = React.useState(true);
  const [trialError, setTrialError] = React.useState<string | null>(null);
  const [practiceTypesData, setPracticeTypesData] = React.useState<
    Record<string, number>
  >({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "finished", desc: true },
  ]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // Session state
  const [sessionData, setSessionData] = React.useState<
    z.infer<typeof sessionSchema>[]
  >([]);
  const [isSessionLoading, setIsSessionLoading] = React.useState(true);
  const [sessionSorting, setSessionSorting] = React.useState<SortingState>([
    { id: "timestamp", desc: true },
  ]);
  const [sessionPagination, setSessionPagination] = React.useState({
    pageIndex: 0,
    pageSize: 20,
  });
  const [sessionColumnFilters, setSessionColumnFilters] =
    React.useState<ColumnFiltersState>([]);
  const [uaeFilterEnabled, setUaeFilterEnabled] = React.useState(false);

  const fetchPracticesData = React.useCallback(async (range: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/practices?timeRange=${range}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch practices data");
      }

      const apiData = await response.json();

      // Transform API response to match schema
      const transformedData: z.infer<typeof schema>[] = apiData.map(
        (item: {
          event_id: string;
          completions: number;
          started: number;
          practice_name?: string | null;
          practice_type?: string | null;
        }) => {
          const title =
            (item.practice_name && item.practice_name.trim()) || item.event_id;

          return {
            id: item.event_id,
            title,
            type: formatPracticeType(item.practice_type),
            started: item.started,
            finished: item.completions,
          };
        }
      );

      setData(transformedData);
    } catch (error) {
      console.error("Error fetching practices data:", error);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTrialConversionData = React.useCallback(async (range: string) => {
    setIsTrialLoading(true);
    setTrialError(null);
    try {
      const response = await fetch(
        `/api/practices?type=trial-conversions&timeRange=${range}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch trial conversion data");
      }

      const apiData = (await response.json()) as Array<{
        eventId: string;
        title: string;
        type: string;
        period: string;
        count: number;
      }>;

      const normalizedData = apiData
        .map((item) => {
          const eventId = (item.eventId || "").trim();
          if (!eventId) {
            return null;
          }

          return {
            eventId,
            title: item.title?.trim() || eventId,
            type: formatPracticeType(item.type),
            period: formatPeriodLabel(item.period),
            count: Number(item.count) || 0,
          };
        })
        .filter((value): value is z.infer<typeof trialSchema> => value !== null)
        .sort((a, b) => b.count - a.count);

      setTrialRows(normalizedData);
    } catch (error) {
      console.error("Error fetching trial conversion data:", error);
      setTrialRows([]);
      setTrialError(
        error instanceof Error ? error.message : "Unknown error fetching trials"
      );
    } finally {
      setIsTrialLoading(false);
    }
  }, []);

  const fetchPracticeTypesData = React.useCallback(async (range: string) => {
    try {
      const response = await fetch(
        `/api/practices?type=types&timeRange=${range}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch practice types data");
      }

      const apiData = await response.json();

      // Map API response keys to display labels
      // question -> self-discovery, mood -> checkin
      const mappedData: Record<string, number> = {
        breathing: apiData.breathing || 0,
        meditation: apiData.meditation || 0,
        journaling: apiData.journaling || 0,
        "self-discovery": apiData.question || 0,
        checkin: apiData.mood || 0,
      };

      // Handle any other types from API (like "practice" or unknown types)
      Object.keys(apiData).forEach((key) => {
        const lowerKey = key.toLowerCase();
        // Skip already mapped keys
        if (
          lowerKey === "breathing" ||
          lowerKey === "meditation" ||
          lowerKey === "journaling" ||
          lowerKey === "question" ||
          lowerKey === "mood"
        ) {
          return;
        }
        // Add other types with formatted names
        const formattedKey = formatPracticeType(lowerKey);
        if (!mappedData[formattedKey]) {
          mappedData[formattedKey] = apiData[key] || 0;
        }
      });

      setPracticeTypesData(mappedData);
    } catch (error) {
      console.error("Error fetching practice types data:", error);
      setPracticeTypesData({});
    }
  }, []);

  const fetchSessionsData = React.useCallback(async (range: string) => {
    setIsSessionLoading(true);
    try {
      const [sessionsResponse, namesResponse] = await Promise.all([
        fetch(`/api/practices/sessions?timeRange=${range}`, {
          cache: "no-store",
        }),
        fetch("/api/user-names", {
          cache: "no-store",
        }),
      ]);

      if (!sessionsResponse.ok) {
        throw new Error("Failed to fetch sessions data");
      }

      const apiData = await sessionsResponse.json();
      const userNames: Record<string, string> = namesResponse.ok
        ? await namesResponse.json()
        : {};

      // Добавляем имена пользователей к данным сессий
      const sessionsWithNames = apiData.map(
        (session: z.infer<typeof sessionSchema>) => ({
          ...session,
          userName: userNames[session.userId] || undefined,
        })
      );

      setSessionData(sessionsWithNames);
    } catch (error) {
      console.error("Error fetching sessions data:", error);
      setSessionData([]);
    } finally {
      setIsSessionLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchPracticesData(timeRange);
    fetchPracticeTypesData(timeRange);
    fetchTrialConversionData(timeRange);
    fetchSessionsData(timeRange);
  }, [
    timeRange,
    fetchPracticesData,
    fetchPracticeTypesData,
    fetchTrialConversionData,
    fetchSessionsData,
  ]);
  const sortableId = React.useId();
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const sessionTable = useReactTable({
    data: sessionData,
    columns: sessionColumns,
    state: {
      sorting: sessionSorting,
      pagination: sessionPagination,
      columnFilters: sessionColumnFilters,
    },
    getRowId: (row) => row.sessionId,
    onSortingChange: setSessionSorting,
    onPaginationChange: setSessionPagination,
    onColumnFiltersChange: setSessionColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  // Update filter when UAE toggle changes
  React.useEffect(() => {
    if (uaeFilterEnabled) {
      sessionTable.getColumn("country")?.setFilterValue(["AE"]);
    } else {
      sessionTable.getColumn("country")?.setFilterValue(undefined);
    }
  }, [uaeFilterEnabled, sessionTable]);

  return (
    <Tabs
      defaultValue="practices"
      className="w-full flex-col justify-start gap-6"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <Select defaultValue="practices">
          <SelectTrigger
            className="flex w-fit @4xl/main:hidden"
            size="sm"
            id="view-selector"
          >
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="practices">Practices</SelectItem>
            <SelectItem value="practice-types">Practice types</SelectItem>
            <SelectItem value="trial-table">Trial Table</SelectItem>
            <SelectItem value="all-sessions">All Sessions</SelectItem>
            <SelectItem value="habits">Habits</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex">
          <TabsTrigger value="practices">Practices</TabsTrigger>
          <TabsTrigger value="practice-types">Practice types</TabsTrigger>
          <TabsTrigger value="trial-table">Trial Table</TabsTrigger>
          <TabsTrigger value="all-sessions">All Sessions</TabsTrigger>
          <TabsTrigger value="habits">Habits</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <TabsContent
        value="practices"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="overflow-hidden rounded-lg border">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader className="bg-muted sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className="**:data-[slot=table-cell]:first:w-8">
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <IconLoader className="h-4 w-4 animate-spin" />
                        Loading practices...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows?.length ? (
                  <SortableContext
                    items={dataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                  <SelectValue
                    placeholder={table.getState().pagination.pageSize}
                  />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <IconChevronsLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <IconChevronLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <IconChevronRight />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <IconChevronsRight />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
      <TabsContent
        value="practice-types"
        className="flex flex-col px-4 lg:px-6"
      >
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed">
          <ChartPopularPractice
            title="Popular by type"
            pages={React.useMemo(() => {
              // Start with standard types in preferred order
              const standardTypes = [
                "breathing",
                "meditation",
                "journaling",
                "self-discovery",
                "checkin",
              ];

              // Add any additional types from the data
              const additionalTypes = Object.keys(practiceTypesData).filter(
                (type) => !standardTypes.includes(type)
              );

              return [...standardTypes, ...additionalTypes];
            }, [practiceTypesData])}
            pageData={practiceTypesData}
            timeRange={timeRange}
          />
        </div>
      </TabsContent>
      <TabsContent value="trial-table" className="flex flex-col px-4 lg:px-6">
        <div className="flex flex-1 flex-col gap-4">
          <div className="overflow-hidden rounded-lg border">
            {isTrialLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconLoader className="h-4 w-4 animate-spin" />
                  Loading trial conversions...
                </div>
              </div>
            ) : trialRows.length > 0 ? (
              <Table>
                <TableHeader className="bg-muted sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-32">Event ID</TableHead>
                    <TableHead className="w-64">Title</TableHead>
                    <TableHead className="w-32">Type</TableHead>
                    <TableHead className="w-32">Period</TableHead>
                    <TableHead className="w-32 text-right">
                      Trials Started
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trialRows.map((row) => {
                    const cleanTitle = stripHtmlTags(row.title);

                    // Check if type needs to be looked up by ID
                    let displayType = row.type;
                    if (displayType === "Practice") {
                      const practice = findPracticeById(row.eventId);
                      if (practice) {
                        displayType = formatPracticeType(practice.type);
                      } else {
                        displayType = "Not Found";
                      }
                    }

                    return (
                      <TableRow key={`${row.eventId}-${row.period}`}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          <CopyableTooltip text={row.eventId} />
                        </TableCell>
                        <TableCell>
                          <CopyableTooltip text={cleanTitle} />
                        </TableCell>
                        <TableCell>{displayType}</TableCell>
                        <TableCell>{row.period}</TableCell>
                        <TableCell className="text-right font-medium">
                          {row.count.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <div className="text-sm text-muted-foreground">
                  No trial conversion data for this range.
                </div>
              </div>
            )}
          </div>
          {trialError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {trialError}
            </div>
          ) : null}
        </div>
      </TabsContent>
      <TabsContent
        value="all-sessions"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="flex items-center gap-4 mb-2">
          <Button
            variant={uaeFilterEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setUaeFilterEnabled(!uaeFilterEnabled)}
          >
            {uaeFilterEnabled ? "🇦🇪 UAE Only" : "Show UAE Only"}
          </Button>
          {uaeFilterEnabled && (
            <span className="text-sm text-muted-foreground">
              Showing {sessionTable.getFilteredRowModel().rows.length} of{" "}
              {sessionData.length} sessions
            </span>
          )}
        </div>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-10">
              {sessionTable.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isSessionLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={sessionColumns.length}
                    className="h-24 text-center"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <IconLoader className="h-4 w-4 animate-spin" />
                      Loading sessions...
                    </div>
                  </TableCell>
                </TableRow>
              ) : sessionTable.getRowModel().rows?.length ? (
                sessionTable.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={sessionColumns.length}
                    className="h-24 text-center"
                  >
                    No sessions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
            Showing {sessionTable.getRowModel().rows.length} of{" "}
            {sessionTable.getFilteredRowModel().rows.length} session(s).
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label
                htmlFor="sessions-rows-per-page"
                className="text-sm font-medium"
              >
                Rows per page
              </Label>
              <Select
                value={`${sessionTable.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  sessionTable.setPageSize(Number(value));
                }}
              >
                <SelectTrigger
                  size="sm"
                  className="w-20"
                  id="sessions-rows-per-page"
                >
                  <SelectValue
                    placeholder={sessionTable.getState().pagination.pageSize}
                  />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {sessionTable.getState().pagination.pageIndex + 1} of{" "}
              {sessionTable.getPageCount()}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => sessionTable.setPageIndex(0)}
                disabled={!sessionTable.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <IconChevronsLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => sessionTable.previousPage()}
                disabled={!sessionTable.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <IconChevronLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => sessionTable.nextPage()}
                disabled={!sessionTable.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <IconChevronRight />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() =>
                  sessionTable.setPageIndex(sessionTable.getPageCount() - 1)
                }
                disabled={!sessionTable.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <IconChevronsRight />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="habits" className="flex flex-col px-4 lg:px-6">
        <PracticeHabitsTab timeRange={timeRange} />
      </TabsContent>
    </Tabs>
  );
}

function PracticeHabitsTab({ timeRange }: { timeRange: string }) {
  const [data, setData] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchHabits = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/practices/habits?timeRange=${timeRange}`,
          { cache: "no-store" }
        );
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error("Error fetching practice habits:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHabits();
  }, [timeRange]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading habits data...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No habits data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Streak Statistics */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Practice Streaks</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4">
            <div className="text-3xl font-bold">
              {data.summary.usersWithStreak3Plus.value}
            </div>
            <div className="text-sm text-muted-foreground">
              Users with 3+ day streaks
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {data.summary.usersWithStreak3Plus.percentage.toFixed(1)}% of
              active users
            </div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="text-3xl font-bold">
              {data.summary.usersWithStreak7Plus.value}
            </div>
            <div className="text-sm text-muted-foreground">
              Users with 7+ day streaks
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {data.summary.usersWithStreak7Plus.percentage.toFixed(1)}% of
              active users
            </div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="text-3xl font-bold">
              {data.summary.usersWithStreak14Plus.value}
            </div>
            <div className="text-sm text-muted-foreground">
              Users with 14+ day streaks
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {data.summary.usersWithStreak14Plus.percentage.toFixed(1)}% of
              active users
            </div>
          </div>
        </div>
      </div>

      {/* ARPPA */}
      {Object.keys(data.arppa).length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">
            Average Practices per Active User (ARPPA)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(data.arppa).map(([type, value]) => (
              <div key={type} className="border rounded-lg p-4">
                <div className="text-2xl font-bold">
                  {(value as number).toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground capitalize">
                  {type}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Streaks */}
      {data.topStreaks.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Top Practice Streaks</h3>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Days with Practice</TableHead>
                  <TableHead>Practice Types</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topStreaks.map((streak: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">#{index + 1}</TableCell>
                    <TableCell>{streak.daysWithPractice}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {streak.practiceTypes.map((type: string) => (
                          <span
                            key={type}
                            className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
