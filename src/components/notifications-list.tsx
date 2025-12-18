"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IconTrash, IconEye, IconLoader, IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { toast } from "sonner";

interface NotificationContent {
  title: string;
  bodyShort: string;
  bodyLong: string;
}

interface Notification {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  content: Record<string, NotificationContent>;
  status: "pending" | "sending" | "completed" | "failed";
  sent_count: number;
  total_users: number;
  created_at: string;
}

interface NotificationsListProps {
  onDelete: (notification: Notification) => void;
  refreshTrigger?: number;
}

export function NotificationsList({ onDelete, refreshTrigger }: NotificationsListProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/notifications");
      const data = await response.json();
      
      if (response.ok) {
        setNotifications(data.data || []);
      } else {
        toast.error("Failed to load notifications");
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      toast.error("Failed to load notifications");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [refreshTrigger]);

  const filteredNotifications = notifications.filter((notif) => {
    if (statusFilter === "all") return true;
    return notif.status === statusFilter;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      pending: { variant: "secondary", label: "Pending" },
      sending: { variant: "default", label: "Sending" },
      completed: { variant: "default", label: "Completed" },
      failed: { variant: "destructive", label: "Failed" },
    };

    const config = variants[status] || variants.pending;
    return (
      <Badge variant={config.variant} className={
        status === "pending" ? "bg-yellow-500 hover:bg-yellow-600" :
        status === "completed" ? "bg-green-500 hover:bg-green-600" :
        status === "failed" ? "bg-red-500 hover:bg-red-600" : ""
      }>
        {config.label}
      </Badge>
    );
  };

  const getLanguagesList = (content: Record<string, any>) => {
    return Object.keys(content).map((lang) => (
      <Badge key={lang} variant="outline" className="mr-1">
        {lang.toUpperCase()}
      </Badge>
    ));
  };

  const formatDateTime = (date: string, time: string) => {
    return `${date} ${time.substring(0, 5)}`;
  };

  const toggleExpanded = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <IconLoader className="animate-spin mr-2" />
          Loading notifications...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification History</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Status Filter Tabs */}
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="failed">Failed</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Notifications Table */}
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No notifications found
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Languages</TableHead>
                  <TableHead>Title (EN)</TableHead>
                  <TableHead className="text-right">Sent / Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNotifications.map((notification) => (
                  <React.Fragment key={notification.id}>
                    <TableRow>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(notification.id)}
                        >
                          {expandedRow === notification.id ? (
                            <IconChevronUp size={16} />
                          ) : (
                            <IconChevronDown size={16} />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatDateTime(notification.scheduled_date, notification.scheduled_time)}
                      </TableCell>
                      <TableCell>{getStatusBadge(notification.status)}</TableCell>
                      <TableCell>{getLanguagesList(notification.content)}</TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {notification.content.en?.title || "N/A"}
                      </TableCell>
                      <TableCell className="text-right">
                        {notification.sent_count} / {notification.total_users || "?"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {notification.status === "pending" && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => onDelete(notification)}
                            >
                              <IconTrash size={16} />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedRow === notification.id && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/50">
                          <div className="py-4 space-y-4">
                            <div>
                              <p className="text-sm font-medium mb-2">Full Content:</p>
                              {Object.entries(notification.content).map(([lang, content]) => (
                                <div key={lang} className="mb-4 p-3 bg-background rounded border">
                                  <Badge className="mb-2">{lang.toUpperCase()}</Badge>
                                  <div className="space-y-2 text-sm">
                                    <div>
                                      <span className="font-medium">Title:</span> {content.title}
                                    </div>
                                    <div>
                                      <span className="font-medium">Body (Short):</span> {content.bodyShort}
                                    </div>
                                    <div>
                                      <span className="font-medium">Body (Long):</span> {content.bodyLong}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Created: {new Date(notification.created_at).toLocaleString()}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

