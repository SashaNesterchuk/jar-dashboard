"use client";

import * as React from "react";
import { useState } from "react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconAlertTriangle } from "@tabler/icons-react";
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
  status: string;
  sent_count: number;
  total_users: number;
}

interface DeleteNotificationModalProps {
  notification: Notification | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

export function DeleteNotificationModal({
  notification,
  open,
  onOpenChange,
  onDeleted,
}: DeleteNotificationModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!notification) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/notifications?id=${notification.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Notification deleted successfully");
        onDeleted();
        onOpenChange(false);
      } else {
        toast.error(data.error || "Failed to delete notification");
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast.error("Failed to delete notification");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!notification) return null;

  const languages = Object.keys(notification.content);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <IconAlertTriangle className="text-yellow-500" size={24} />
            Delete Notification
          </DrawerTitle>
          <DrawerDescription>
            Are you sure you want to delete this scheduled notification? This action
            cannot be undone.
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 py-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Scheduled for:
            </p>
            <p className="text-base font-semibold">
              {notification.scheduled_date} at {notification.scheduled_time.substring(0, 5)}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Languages:
            </p>
            <div className="flex flex-wrap gap-1">
              {languages.map((lang) => (
                <Badge key={lang} variant="outline">
                  {lang.toUpperCase()}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Title (English):
            </p>
            <p className="text-base">{notification.content.en?.title || "N/A"}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Body (English):
            </p>
            <p className="text-sm text-muted-foreground">
              {notification.content.en?.bodyShort || "N/A"}
            </p>
          </div>
        </div>

        <DrawerFooter>
          <div className="flex gap-2 w-full">
            <DrawerClose asChild>
              <Button variant="outline" className="flex-1" disabled={isDeleting}>
                Cancel
              </Button>
            </DrawerClose>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Notification"}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

