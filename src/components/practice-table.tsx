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
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
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
  IconCircleCheckFilled,
  IconDotsVertical,
  IconGripVertical,
  IconLayoutColumns,
  IconLoader,
  IconPlus,
  IconTrendingUp,
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
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { toast } from "sonner";
import { z } from "zod";

import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
import { ChartAreaStep } from "./ui/chart-area-step";
import { ChartPopularPractice } from "./ui/chart-popular-practice";

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

const columns: ColumnDef<z.infer<typeof schema>>[] = [
  {
    accessorKey: "id",
    header: "Event ID",
    cell: ({ row }) => <div className="w-32">{row.original.id}</div>,
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => (
      <div className="w-64 overflow-hidden text-ellipsis whitespace-nowrap">
        {row.original.title}
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => <div className="w-32">{row.original.type}</div>,
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

      setPracticeTypesData(mappedData);
    } catch (error) {
      console.error("Error fetching practice types data:", error);
      setPracticeTypesData({});
    }
  }, []);

  React.useEffect(() => {
    fetchPracticesData(timeRange);
    fetchPracticeTypesData(timeRange);
    fetchTrialConversionData(timeRange);
  }, [
    timeRange,
    fetchPracticesData,
    fetchPracticeTypesData,
    fetchTrialConversionData,
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
          </SelectContent>
        </Select>
        <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex">
          <TabsTrigger value="practices">Practices</TabsTrigger>
          <TabsTrigger value="practice-types">Practice types</TabsTrigger>
          <TabsTrigger value="trial-table">Trial Table</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
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
            pages={[
              "breathing",
              "meditation",
              "journaling",
              "self-discovery",
              "checkin",
            ]}
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
                  {trialRows.map((row) => (
                    <TableRow key={`${row.eventId}-${row.period}`}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {row.eventId}
                      </TableCell>
                      <TableCell className="truncate">{row.title}</TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell>{row.period}</TableCell>
                      <TableCell className="text-right font-medium">
                        {row.count.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
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
    </Tabs>
  );
}
