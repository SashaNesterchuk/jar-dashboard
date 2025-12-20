"use client";

import * as React from "react";
import {
  IconCamera,
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconFolder,
  IconHelp,
  IconInnerShadowTop,
  IconListDetails,
  IconReport,
  IconSearch,
  IconSettings,
  IconUsers,
  IconBell,
  IconFlask,
} from "@tabler/icons-react";

import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: <IconDashboard className="w-5 h-5" />,
    },
    {
      title: "Notifications",
      url: "/dashboard/notifications",
      icon: <IconBell className="w-5 h-5" />,
    },
    {
      title: "AI Test",
      url: "/dashboard/ai-test",
      icon: <IconFlask className="w-5 h-5" />,
    },
    {
      title: "Mind Jar",
      url: "#",
      icon: <img src="./app_icon_52.png" alt="Mind Jar" className="w-6 h-6" />,
    },
    {
      title: "Affirmation Next App(soon)",
      url: "#",
      icon: <img src="./app_icon_52.png" alt="Mind Jar" className="w-6 h-6" />,
    },
    {
      title: "Journaling Next App(soon)",
      url: "#",
      icon: <img src="./app_icon_52.png" alt="Mind Jar" className="w-6 h-6" />,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <span className="text-base font-semibold">MAIN PORTAL</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        {/* <NavDocuments items={data.documents} /> */}
        {/* <NavSecondary items={data.navSecondary} className="mt-auto" /> */}
      </SidebarContent>
      {/* <SidebarFooter> */}
      {/* <NavUser user={data.user} /> */}
      {/* </SidebarFooter> */}
    </Sidebar>
  );
}
