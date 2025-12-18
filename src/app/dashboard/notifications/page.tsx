"use client";

import * as React from "react";
import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { NotificationScheduler } from "@/components/notification-scheduler";
import { NotificationsList } from "@/components/notifications-list";
import { DeleteNotificationModal } from "@/components/delete-notification-modal";

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
  created_at: string;
}

export default function NotificationsPage() {
  const [notificationToDelete, setNotificationToDelete] = useState<Notification | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleDeleteClick = (notification: Notification) => {
    setNotificationToDelete(notification);
    setIsDeleteModalOpen(true);
  };

  const handleDeleted = () => {
    // Refresh the notifications list
    setRefreshTrigger((prev) => prev + 1);
  };

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
              <div className="px-4 lg:px-6">
                <h1 className="text-3xl font-bold mb-2">Push Notifications</h1>
                <p className="text-muted-foreground">
                  Schedule and manage push notifications for your users
                </p>
              </div>

              {/* Scheduler Section */}
              <NotificationScheduler onSuccess={handleDeleted} />

              {/* Notifications List Section */}
              <div className="px-4 lg:px-6">
                <NotificationsList refreshTrigger={refreshTrigger} onDelete={handleDeleteClick} />
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Delete Confirmation Modal */}
      <DeleteNotificationModal
        notification={notificationToDelete}
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        onDeleted={handleDeleted}
      />
    </SidebarProvider>
  );
}

