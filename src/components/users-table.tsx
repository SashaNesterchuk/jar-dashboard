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

// Schemas
export const countrySummarySchema = z.object({
  country: z.string(),
  userCount: z.number(),
});

export const userDetailSchema = z.object({
  userId: z.string(),
  country: z.string(),
  sessionCount: z.number(),
  lastSession: z.string().nullable(),
  sessionDuration: z.number(),
  checkinCount: z.number(),
  breathingCount: z.number(),
  meditationCount: z.number(),
  journalCount: z.number(),
  selfDiscoveryCount: z.number(),
});

// Helper functions
function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) {
    return "🏳️";
  }

  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function formatDate(isoString: string | null): string {
  if (!isoString) return "Never";

  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "Invalid date";

    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch (e) {
    return "Invalid date";
  }
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return "0s";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

const CopyableTooltip = ({ text }: { text: string }) => {
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
            {text}
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

// Country Summary Table Columns
const countrySummaryColumns: ColumnDef<z.infer<typeof countrySummarySchema>>[] =
  [
    {
      accessorKey: "country",
      header: ({ column }) => (
        <SortableHeader column={column}>Country</SortableHeader>
      ),
      cell: ({ row }) => {
        const country = row.original.country;
        const flag = getCountryFlag(country);
        return (
          <div className="flex items-center gap-2 w-48">
            <span className="text-2xl">{flag}</span>
            <span className="font-medium">{country}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "userCount",
      header: ({ column }) => (
        <SortableHeader column={column}>Users</SortableHeader>
      ),
      cell: ({ row }) => (
        <div className="w-32 font-medium">
          {row.original.userCount.toLocaleString()}
        </div>
      ),
    },
  ];

// User Detail Table Columns
const userDetailColumns: ColumnDef<z.infer<typeof userDetailSchema>>[] = [
  {
    accessorKey: "userId",
    header: ({ column }) => (
      <SortableHeader column={column}>User ID</SortableHeader>
    ),
    cell: ({ row }) => (
      <div className="w-32">
        <CopyableTooltip text={row.original.userId} />
      </div>
    ),
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
  },
  {
    accessorKey: "sessionCount",
    header: ({ column }) => (
      <SortableHeader column={column}>Sessions</SortableHeader>
    ),
    cell: ({ row }) => (
      <div className="w-24">{row.original.sessionCount.toLocaleString()}</div>
    ),
  },
  {
    accessorKey: "lastSession",
    header: ({ column }) => (
      <SortableHeader column={column}>Last Session</SortableHeader>
    ),
    cell: ({ row }) => (
      <div className="w-40">{formatDate(row.original.lastSession)}</div>
    ),
  },
  {
    accessorKey: "sessionDuration",
    header: ({ column }) => (
      <SortableHeader column={column}>Duration</SortableHeader>
    ),
    cell: ({ row }) => (
      <div className="w-24">{formatDuration(row.original.sessionDuration)}</div>
    ),
  },
  {
    accessorKey: "checkinCount",
    header: ({ column }) => (
      <SortableHeader column={column}>Check-ins</SortableHeader>
    ),
    cell: ({ row }) => (
      <div className="w-24">{row.original.checkinCount.toLocaleString()}</div>
    ),
  },
  {
    accessorKey: "breathingCount",
    header: ({ column }) => (
      <SortableHeader column={column}>Breathings</SortableHeader>
    ),
    cell: ({ row }) => (
      <div className="w-24">{row.original.breathingCount.toLocaleString()}</div>
    ),
  },
  {
    accessorKey: "meditationCount",
    header: ({ column }) => (
      <SortableHeader column={column}>Meditations</SortableHeader>
    ),
    cell: ({ row }) => (
      <div className="w-24">
        {row.original.meditationCount.toLocaleString()}
      </div>
    ),
  },
  {
    accessorKey: "journalCount",
    header: ({ column }) => (
      <SortableHeader column={column}>Journals</SortableHeader>
    ),
    cell: ({ row }) => (
      <div className="w-24">{row.original.journalCount.toLocaleString()}</div>
    ),
  },
  {
    accessorKey: "selfDiscoveryCount",
    header: ({ column }) => (
      <SortableHeader column={column}>Self-discoveries</SortableHeader>
    ),
    cell: ({ row }) => (
      <div className="w-32">
        {row.original.selfDiscoveryCount.toLocaleString()}
      </div>
    ),
  },
];

function DraggableRow({
  row,
  type,
}: {
  row: Row<any>;
  type: "country" | "user";
}) {
  const { transform, transition, setNodeRef } = useSortable({
    id: type === "country" ? row.original.country : row.original.userId,
  });

  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      ref={setNodeRef}
      className="relative z-0"
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

export function UsersTable() {
  const [timeRange, setTimeRange] = React.useState("7d");
  const [countrySummaryData, setCountrySummaryData] = React.useState<
    z.infer<typeof countrySummarySchema>[]
  >([]);
  const [userDetailData, setUserDetailData] = React.useState<
    z.infer<typeof userDetailSchema>[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Country Summary Table State
  const [countrySorting, setCountrySorting] = React.useState<SortingState>([
    { id: "userCount", desc: true },
  ]);
  const [countryPagination, setCountryPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // User Detail Table State
  const [userSorting, setUserSorting] = React.useState<SortingState>([
    { id: "sessionCount", desc: true },
  ]);
  const [userPagination, setUserPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [userColumnVisibility, setUserColumnVisibility] =
    React.useState<VisibilityState>({});
  const [userColumnFilters, setUserColumnFilters] =
    React.useState<ColumnFiltersState>([]);

  const fetchUsersData = React.useCallback(async (range: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users?timeRange=${range}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch users data");
      }

      const apiData = await response.json();

      setCountrySummaryData(apiData.countrySummary || []);
      setUserDetailData(apiData.users || []);
    } catch (error) {
      console.error("Error fetching users data:", error);
      setCountrySummaryData([]);
      setUserDetailData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchUsersData(timeRange);
  }, [timeRange, fetchUsersData]);

  const sortableId = React.useId();
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  const countryDataIds = React.useMemo<UniqueIdentifier[]>(
    () => countrySummaryData?.map(({ country }) => country) || [],
    [countrySummaryData]
  );

  const userDataIds = React.useMemo<UniqueIdentifier[]>(
    () => userDetailData?.map(({ userId }) => userId) || [],
    [userDetailData]
  );

  const countryTable = useReactTable({
    data: countrySummaryData,
    columns: countrySummaryColumns,
    state: {
      sorting: countrySorting,
      pagination: countryPagination,
    },
    enableSorting: true,
    enableMultiSort: false,
    getRowId: (row) => row.country,
    onSortingChange: setCountrySorting,
    onPaginationChange: setCountryPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const userTable = useReactTable({
    data: userDetailData,
    columns: userDetailColumns,
    state: {
      sorting: userSorting,
      columnVisibility: userColumnVisibility,
      columnFilters: userColumnFilters,
      pagination: userPagination,
    },
    enableSorting: true,
    enableMultiSort: false,
    getRowId: (row) => row.userId,
    onSortingChange: setUserSorting,
    onColumnFiltersChange: setUserColumnFilters,
    onColumnVisibilityChange: setUserColumnVisibility,
    onPaginationChange: setUserPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  return (
    <Tabs
      defaultValue="country-summary"
      className="w-full flex-col justify-start gap-6"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <Select defaultValue="country-summary">
          <SelectTrigger
            className="flex w-fit @4xl/main:hidden"
            size="sm"
            id="view-selector"
          >
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="country-summary">Country Summary</SelectItem>
            <SelectItem value="user-details">User Details</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex">
          <TabsTrigger value="country-summary">Country Summary</TabsTrigger>
          <TabsTrigger value="user-details">User Details</TabsTrigger>
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

      {/* Country Summary Tab */}
      <TabsContent
        value="country-summary"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="overflow-hidden rounded-lg border">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            sensors={sensors}
            id={sortableId + "-country"}
          >
            <Table>
              <TableHeader className="bg-muted sticky top-0 z-10">
                {countryTable.getHeaderGroups().map((headerGroup) => (
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
                      colSpan={countrySummaryColumns.length}
                      className="h-24 text-center"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <IconLoader className="h-4 w-4 animate-spin" />
                        Loading countries...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : countryTable.getRowModel().rows?.length ? (
                  <SortableContext
                    items={countryDataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {countryTable.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} type="country" />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={countrySummaryColumns.length}
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
            {countryTable.getFilteredRowModel().rows.length} countries
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label
                htmlFor="country-rows-per-page"
                className="text-sm font-medium"
              >
                Rows per page
              </Label>
              <Select
                value={`${countryTable.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  countryTable.setPageSize(Number(value));
                }}
              >
                <SelectTrigger
                  size="sm"
                  className="w-20"
                  id="country-rows-per-page"
                >
                  <SelectValue
                    placeholder={countryTable.getState().pagination.pageSize}
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
              Page {countryTable.getState().pagination.pageIndex + 1} of{" "}
              {countryTable.getPageCount()}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => countryTable.setPageIndex(0)}
                disabled={!countryTable.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <IconChevronsLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => countryTable.previousPage()}
                disabled={!countryTable.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <IconChevronLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => countryTable.nextPage()}
                disabled={!countryTable.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <IconChevronRight />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() =>
                  countryTable.setPageIndex(countryTable.getPageCount() - 1)
                }
                disabled={!countryTable.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <IconChevronsRight />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>

      {/* User Details Tab */}
      <TabsContent
        value="user-details"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="overflow-hidden rounded-lg border">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            sensors={sensors}
            id={sortableId + "-user"}
          >
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
                      colSpan={userDetailColumns.length}
                      className="h-24 text-center"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <IconLoader className="h-4 w-4 animate-spin" />
                        Loading users...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : userTable.getRowModel().rows?.length ? (
                  <SortableContext
                    items={userDataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {userTable.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} type="user" />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={userDetailColumns.length}
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
                    placeholder={userTable.getState().pagination.pageSize}
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
      </TabsContent>
    </Tabs>
  );
}
