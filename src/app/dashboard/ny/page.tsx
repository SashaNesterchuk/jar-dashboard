"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
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
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { z } from "zod";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { CardBlock } from "@/components/custom/card-block";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// API Response Types
interface NYEventData {
  totalParticipants: number;
  totalPracticesStarted: number;
  totalPracticesFinished: number;
  dailyActivity: Array<{
    day: string;
    users: number;
  }>;
  dailyPracticeActivity: Array<{
    day: string;
    practices: number;
  }>;
  users: Array<{
    id: string;
    name: string;
    practicesStarted: number;
    practicesFinished: number;
    sessions: number;
  }>;
  practiceTypes: {
    breathing: number;
    meditation: number;
    journaling: number;
    "self-discovery": number;
    checkin: number;
  };
  practices: Array<{
    id: string;
    name: string;
    type: string;
    day: number | null;
    started: number;
    finished: number;
  }>;
}

// User Schema
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  practicesStarted: z.number(),
  practicesFinished: z.number(),
  sessions: z.number(),
});

// Practice Schema
export const practiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  day: z.number().nullable(),
  started: z.number(),
  finished: z.number(),
});

const chartConfig = {
  users: {
    label: "Users",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

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

// User Table Columns
const userColumns: ColumnDef<z.infer<typeof userSchema>>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <SortableHeader column={column}>Name</SortableHeader>
    ),
    cell: ({ row }) => (
      <div className="w-48 font-medium">{row.original.name}</div>
    ),
  },
  {
    accessorKey: "practicesStarted",
    header: ({ column }) => (
      <SortableHeader column={column}>Practices Started</SortableHeader>
    ),
    cell: ({ row }) => (
      <div className="w-32">{row.original.practicesStarted}</div>
    ),
  },
  {
    accessorKey: "practicesFinished",
    header: ({ column }) => (
      <SortableHeader column={column}>Practices Finished</SortableHeader>
    ),
    cell: ({ row }) => (
      <div className="w-32">{row.original.practicesFinished}</div>
    ),
  },
  {
    accessorKey: "sessions",
    header: ({ column }) => (
      <SortableHeader column={column}>Sessions</SortableHeader>
    ),
    cell: ({ row }) => <div className="w-32">{row.original.sessions}</div>,
  },
];

// Practice Table Columns
const practiceColumns: ColumnDef<z.infer<typeof practiceSchema>>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <SortableHeader column={column}>Practice Name</SortableHeader>
    ),
    cell: ({ row }) => (
      <div className="w-64 font-medium">{row.original.name}</div>
    ),
  },
  {
    accessorKey: "type",
    header: ({ column }) => (
      <SortableHeader column={column}>Type</SortableHeader>
    ),
    cell: ({ row }) => <div className="w-32">{row.original.type}</div>,
  },
  {
    accessorKey: "day",
    header: ({ column }) => (
      <SortableHeader column={column}>Day</SortableHeader>
    ),
    cell: ({ row }) => (
      <div className="w-20">
        {row.original.day ? `Day ${row.original.day}` : "-"}
      </div>
    ),
  },
  {
    accessorKey: "started",
    header: ({ column }) => (
      <SortableHeader column={column}>Started</SortableHeader>
    ),
    cell: ({ row }) => <div className="w-32">{row.original.started}</div>,
  },
  {
    accessorKey: "finished",
    header: ({ column }) => (
      <SortableHeader column={column}>Finished</SortableHeader>
    ),
    cell: ({ row }) => <div className="w-32">{row.original.finished}</div>,
  },
];

export default function NYEventPage() {
  // Data State
  const [nyEventData, setNyEventData] = React.useState<NYEventData | null>(
    null
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [userNames, setUserNames] = React.useState<Record<string, string>>({});

  // User Table State
  const [userSorting, setUserSorting] = React.useState<SortingState>([
    { id: "practicesFinished", desc: true },
  ]);
  const [userPagination, setUserPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // Practice Table State
  const [practiceSorting, setPracticeSorting] = React.useState<SortingState>([
    { id: "started", desc: true },
  ]);
  const [practicePagination, setPracticePagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // Fetch NY Event Data
  const fetchNYEventData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ny-event", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch NY event data");
      }

      const data = await response.json();
      setNyEventData(data);
    } catch (err) {
      console.error("Error fetching NY event data:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch User Names
  const fetchUserNames = React.useCallback(async () => {
    try {
      const response = await fetch("/api/user-names", {
        cache: "no-store",
      });

      if (response.ok) {
        const names = await response.json();
        setUserNames(names);
      }
    } catch (err) {
      console.error("Error fetching user names:", err);
    }
  }, []);

  React.useEffect(() => {
    fetchNYEventData();
    fetchUserNames();
  }, [fetchNYEventData, fetchUserNames]);

  // Enrich users with names
  const enrichedUsers = React.useMemo(() => {
    if (!nyEventData) return [];
    return nyEventData.users.map((user) => ({
      ...user,
      name: userNames[user.id] || user.name,
    }));
  }, [nyEventData, userNames]);

  const userTable = useReactTable({
    data: enrichedUsers,
    columns: userColumns,
    state: {
      sorting: userSorting,
      pagination: userPagination,
    },
    enableSorting: true,
    enableMultiSort: false,
    getRowId: (row) => row.id,
    onSortingChange: setUserSorting,
    onPaginationChange: setUserPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const practiceTable = useReactTable({
    data: nyEventData?.practices || [],
    columns: practiceColumns,
    state: {
      sorting: practiceSorting,
      pagination: practicePagination,
    },
    enableSorting: true,
    enableMultiSort: false,
    getRowId: (row) => row.id,
    onSortingChange: setPracticeSorting,
    onPaginationChange: setPracticePagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              {/* Header */}
              <div className="px-4 lg:px-6">
                <h1 className="text-3xl font-bold">NY Event Statistics</h1>
                <p className="text-muted-foreground mt-2">
                  Overview of user participation in the New Year event (11 days)
                </p>
              </div>

              {/* Summary Cards */}
              <div className="px-4 lg:px-6">
                <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
                  <CardBlock
                    title="Total Participants"
                    value={
                      isLoading ? "..." : nyEventData?.totalParticipants || 0
                    }
                    period="Unique users who started"
                  />
                  <CardBlock
                    title="Practices Started"
                    value={
                      isLoading
                        ? "..."
                        : nyEventData?.totalPracticesStarted || 0
                    }
                    period="Total practice attempts"
                  />
                  <CardBlock
                    title="Practices Finished"
                    value={
                      isLoading
                        ? "..."
                        : nyEventData?.totalPracticesFinished || 0
                    }
                    period="Total completions (≥80%)"
                  />
                </div>
              </div>

              {/* Daily User Activity Chart */}
              <div className="px-4 lg:px-6">
                <Card className="@container/card">
                  <CardHeader>
                    <CardTitle>Daily User Activity</CardTitle>
                    <CardDescription>
                      Unique users who completed at least one practice each day
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                    {isLoading ? (
                      <div className="flex h-[250px] items-center justify-center">
                        <IconLoader className="h-8 w-8 animate-spin" />
                      </div>
                    ) : error ? (
                      <div className="flex h-[250px] items-center justify-center">
                        <p className="text-sm text-muted-foreground">
                          Failed to load chart data
                        </p>
                      </div>
                    ) : (
                      <ChartContainer
                        config={chartConfig}
                        className="aspect-auto h-[250px] w-full"
                      >
                        <AreaChart data={nyEventData?.dailyActivity || []}>
                          <defs>
                            <linearGradient
                              id="fillUsers"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="var(--color-users)"
                                stopOpacity={0.8}
                              />
                              <stop
                                offset="95%"
                                stopColor="var(--color-users)"
                                stopOpacity={0.1}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} />
                          <XAxis
                            dataKey="day"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tickFormatter={(value) => value.toLocaleString()}
                          />
                          <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent indicator="dot" />}
                          />
                          <Area
                            dataKey="users"
                            type="natural"
                            fill="url(#fillUsers)"
                            stroke="var(--color-users)"
                          />
                        </AreaChart>
                      </ChartContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Daily Practice Activity Chart */}
              <div className="px-4 lg:px-6">
                <Card className="@container/card">
                  <CardHeader>
                    <CardTitle>Daily Practice Activity</CardTitle>
                    <CardDescription>
                      Total number of practices completed each day
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                    {isLoading ? (
                      <div className="flex h-[250px] items-center justify-center">
                        <IconLoader className="h-8 w-8 animate-spin" />
                      </div>
                    ) : error ? (
                      <div className="flex h-[250px] items-center justify-center">
                        <p className="text-sm text-muted-foreground">
                          Failed to load chart data
                        </p>
                      </div>
                    ) : (
                      <ChartContainer
                        config={{
                          practices: {
                            label: "Practices",
                            color: "hsl(var(--chart-2))",
                          },
                        }}
                        className="aspect-auto h-[250px] w-full"
                      >
                        <AreaChart
                          data={nyEventData?.dailyPracticeActivity || []}
                        >
                          <defs>
                            <linearGradient
                              id="fillPractices"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="hsl(var(--chart-2))"
                                stopOpacity={0.8}
                              />
                              <stop
                                offset="95%"
                                stopColor="hsl(var(--chart-2))"
                                stopOpacity={0.1}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} />
                          <XAxis
                            dataKey="day"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tickFormatter={(value) => value.toLocaleString()}
                          />
                          <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent indicator="dot" />}
                          />
                          <Area
                            dataKey="practices"
                            type="natural"
                            fill="url(#fillPractices)"
                            stroke="hsl(var(--chart-2))"
                          />
                        </AreaChart>
                      </ChartContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Users Participation Table */}
              <div className="px-4 lg:px-6">
                <h2 className="text-2xl font-bold">User Participation</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Practice attempts per user (one user completing the same
                  practice counts as one attempt)
                </p>
              </div>
              <div className="px-4 lg:px-6">
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted sticky top-0 z-10">
                      {userTable.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <TableHead key={header.id} colSpan={header.colSpan}>
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
                      {isLoading ? (
                        <TableRow>
                          <TableCell
                            colSpan={userColumns.length}
                            className="h-24 text-center"
                          >
                            <div className="flex items-center justify-center gap-2">
                              <IconLoader className="h-4 w-4 animate-spin" />
                              Loading users...
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : error ? (
                        <TableRow>
                          <TableCell
                            colSpan={userColumns.length}
                            className="h-24 text-center"
                          >
                            <p className="text-sm text-muted-foreground">
                              Failed to load user data
                            </p>
                          </TableCell>
                        </TableRow>
                      ) : userTable.getRowModel().rows?.length ? (
                        userTable.getRowModel().rows.map((row) => (
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
                            colSpan={userColumns.length}
                            className="h-24 text-center"
                          >
                            No results.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between px-4 py-4">
                  <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
                    {userTable.getFilteredRowModel().rows.length} users
                  </div>
                  <div className="flex w-full items-center gap-8 lg:w-fit">
                    <div className="hidden items-center gap-2 lg:flex">
                      <Label
                        htmlFor="user-rows-per-page"
                        className="text-sm font-medium"
                      >
                        Rows per page
                      </Label>
                      <Select
                        value={`${userTable.getState().pagination.pageSize}`}
                        onValueChange={(value) => {
                          userTable.setPageSize(Number(value));
                        }}
                      >
                        <SelectTrigger
                          size="sm"
                          className="w-20"
                          id="user-rows-per-page"
                        >
                          <SelectValue
                            placeholder={
                              userTable.getState().pagination.pageSize
                            }
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
                      Page {userTable.getState().pagination.pageIndex + 1} of{" "}
                      {userTable.getPageCount()}
                    </div>
                    <div className="ml-auto flex items-center gap-2 lg:ml-0">
                      <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 lg:flex"
                        onClick={() => userTable.setPageIndex(0)}
                        disabled={!userTable.getCanPreviousPage()}
                      >
                        <span className="sr-only">Go to first page</span>
                        <IconChevronsLeft />
                      </Button>
                      <Button
                        variant="outline"
                        className="size-8"
                        size="icon"
                        onClick={() => userTable.previousPage()}
                        disabled={!userTable.getCanPreviousPage()}
                      >
                        <span className="sr-only">Go to previous page</span>
                        <IconChevronLeft />
                      </Button>
                      <Button
                        variant="outline"
                        className="size-8"
                        size="icon"
                        onClick={() => userTable.nextPage()}
                        disabled={!userTable.getCanNextPage()}
                      >
                        <span className="sr-only">Go to next page</span>
                        <IconChevronRight />
                      </Button>
                      <Button
                        variant="outline"
                        className="hidden size-8 lg:flex"
                        size="icon"
                        onClick={() =>
                          userTable.setPageIndex(userTable.getPageCount() - 1)
                        }
                        disabled={!userTable.getCanNextPage()}
                      >
                        <span className="sr-only">Go to last page</span>
                        <IconChevronsRight />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Practice Type Analysis */}
              <h2 className="text-2xl font-bold px-4 lg:px-6">
                Practice Analysis
              </h2>
              <Tabs
                defaultValue="chart"
                className="w-full flex-col justify-start gap-6 px-4 lg:px-6"
              >
                <div className="flex items-center justify-between">
                  <Label htmlFor="practice-selector" className="sr-only">
                    View
                  </Label>
                  <Select defaultValue="chart">
                    <SelectTrigger
                      className="flex w-fit @4xl/main:hidden"
                      size="sm"
                      id="practice-selector"
                    >
                      <SelectValue placeholder="Select a view" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chart">Chart View</SelectItem>
                      <SelectItem value="table">Table View</SelectItem>
                    </SelectContent>
                  </Select>
                  <TabsList className="hidden @4xl/main:flex">
                    <TabsTrigger value="chart">Chart View</TabsTrigger>
                    <TabsTrigger value="table">Table View</TabsTrigger>
                  </TabsList>
                </div>

                {/* Chart Tab */}
                <TabsContent value="chart" className="flex flex-col">
                  <Card className="w-full">
                    <CardHeader>
                      <CardTitle>Practice Types by Started Count</CardTitle>
                      <CardDescription>
                        Showing popular practices for NY Event
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="w-full px-0">
                      {isLoading ? (
                        <div className="flex h-[200px] items-center justify-center">
                          <IconLoader className="h-8 w-8 animate-spin" />
                        </div>
                      ) : error ? (
                        <div className="flex h-[200px] items-center justify-center">
                          <p className="text-sm text-muted-foreground">
                            Failed to load chart data
                          </p>
                        </div>
                      ) : (
                        <ChartContainer
                          config={chartConfig}
                          className="h-[250px] w-full"
                        >
                          <AreaChart
                            accessibilityLayer
                            data={[
                              {
                                type: "Breath",
                                value:
                                  nyEventData?.practiceTypes.breathing || 0,
                              },
                              {
                                type: "Medit",
                                value:
                                  nyEventData?.practiceTypes.meditation || 0,
                              },
                              {
                                type: "Journal",
                                value:
                                  nyEventData?.practiceTypes.journaling || 0,
                              },
                              {
                                type: "Self-disc",
                                value:
                                  nyEventData?.practiceTypes[
                                    "self-discovery"
                                  ] || 0,
                              },
                              {
                                type: "Check-in",
                                value: nyEventData?.practiceTypes.checkin || 0,
                              },
                            ]}
                            margin={{
                              left: 12,
                              right: 12,
                              bottom: 30,
                            }}
                          >
                            <CartesianGrid vertical={false} />
                            <XAxis
                              dataKey="type"
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                              angle={-45}
                              textAnchor="end"
                              height={60}
                              tick={{ fontSize: 12 }}
                            />
                            <ChartTooltip
                              cursor={false}
                              content={<ChartTooltipContent hideLabel />}
                              formatter={(value: number) => [
                                `${value}`,
                                "Started",
                              ]}
                            />
                            <Area
                              dataKey="value"
                              type="step"
                              fill="var(--color-users)"
                              fillOpacity={0.4}
                              stroke="var(--color-users)"
                            />
                          </AreaChart>
                        </ChartContainer>
                      )}
                    </CardContent>
                    <CardFooter>
                      <div className="flex w-full items-start gap-2 text-sm">
                        <div className="grid gap-2">
                          <div className="flex items-center gap-2 leading-none font-medium">
                            {nyEventData &&
                              (() => {
                                const types = nyEventData.practiceTypes;
                                const entries = Object.entries(types);
                                const max = entries.reduce((a, b) =>
                                  a[1] > b[1] ? a : b
                                );
                                const typeName =
                                  max[0].charAt(0).toUpperCase() +
                                  max[0].slice(1).replace("-", " ");
                                return (
                                  <>
                                    Most popular: {typeName} (
                                    {max[1].toLocaleString()} started)
                                  </>
                                );
                              })()}
                          </div>
                        </div>
                      </div>
                    </CardFooter>
                  </Card>
                </TabsContent>

                {/* Table Tab */}
                <TabsContent value="table" className="flex flex-col">
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader className="bg-muted sticky top-0 z-10">
                        {practiceTable.getHeaderGroups().map((headerGroup) => (
                          <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                              <TableHead
                                key={header.id}
                                colSpan={header.colSpan}
                              >
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
                        {isLoading ? (
                          <TableRow>
                            <TableCell
                              colSpan={practiceColumns.length}
                              className="h-24 text-center"
                            >
                              <div className="flex items-center justify-center gap-2">
                                <IconLoader className="h-4 w-4 animate-spin" />
                                Loading practices...
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : error ? (
                          <TableRow>
                            <TableCell
                              colSpan={practiceColumns.length}
                              className="h-24 text-center"
                            >
                              <p className="text-sm text-muted-foreground">
                                Failed to load practice data
                              </p>
                            </TableCell>
                          </TableRow>
                        ) : practiceTable.getRowModel().rows?.length ? (
                          practiceTable.getRowModel().rows.map((row) => (
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
                              colSpan={practiceColumns.length}
                              className="h-24 text-center"
                            >
                              No results.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-center justify-between px-4 py-4">
                    <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
                      {practiceTable.getFilteredRowModel().rows.length}{" "}
                      practices
                    </div>
                    <div className="flex w-full items-center gap-8 lg:w-fit">
                      <div className="hidden items-center gap-2 lg:flex">
                        <Label
                          htmlFor="practice-rows-per-page"
                          className="text-sm font-medium"
                        >
                          Rows per page
                        </Label>
                        <Select
                          value={`${
                            practiceTable.getState().pagination.pageSize
                          }`}
                          onValueChange={(value) => {
                            practiceTable.setPageSize(Number(value));
                          }}
                        >
                          <SelectTrigger
                            size="sm"
                            className="w-20"
                            id="practice-rows-per-page"
                          >
                            <SelectValue
                              placeholder={
                                practiceTable.getState().pagination.pageSize
                              }
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
                        Page {practiceTable.getState().pagination.pageIndex + 1}{" "}
                        of {practiceTable.getPageCount()}
                      </div>
                      <div className="ml-auto flex items-center gap-2 lg:ml-0">
                        <Button
                          variant="outline"
                          className="hidden h-8 w-8 p-0 lg:flex"
                          onClick={() => practiceTable.setPageIndex(0)}
                          disabled={!practiceTable.getCanPreviousPage()}
                        >
                          <span className="sr-only">Go to first page</span>
                          <IconChevronsLeft />
                        </Button>
                        <Button
                          variant="outline"
                          className="size-8"
                          size="icon"
                          onClick={() => practiceTable.previousPage()}
                          disabled={!practiceTable.getCanPreviousPage()}
                        >
                          <span className="sr-only">Go to previous page</span>
                          <IconChevronLeft />
                        </Button>
                        <Button
                          variant="outline"
                          className="size-8"
                          size="icon"
                          onClick={() => practiceTable.nextPage()}
                          disabled={!practiceTable.getCanNextPage()}
                        >
                          <span className="sr-only">Go to next page</span>
                          <IconChevronRight />
                        </Button>
                        <Button
                          variant="outline"
                          className="hidden size-8 lg:flex"
                          size="icon"
                          onClick={() =>
                            practiceTable.setPageIndex(
                              practiceTable.getPageCount() - 1
                            )
                          }
                          disabled={!practiceTable.getCanNextPage()}
                        >
                          <span className="sr-only">Go to last page</span>
                          <IconChevronsRight />
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
