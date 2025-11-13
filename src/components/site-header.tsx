import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Palette,
  Cat,
  Triangle,
  Apple,
  Database,
  LineChart,
  Rocket,
  Lamp,
} from "lucide-react";

const externalLinks = [
  {
    href: "https://www.figma.com/design/1C1JEVu6Z6VT7XrZ9vcK8P/Screens?t=EXWatOE0ogDWfOa5-0",
    label: "Figma",
    Icon: Palette,
  },
  {
    href: "https://app.revenuecat.com/projects/41c84da0/overview",
    label: "RevenueCat",
    Icon: Cat,
  },
  {
    href: "https://drive.google.com/drive/folders/1wI7x5mfWq9dU-TvAMCDkSVltTc7mNu8V?usp=drive_link",
    label: "Google Drive",
    Icon: Triangle,
  },
  {
    href: "https://appstoreconnect.apple.com/apps/6743328692/distribution",
    label: "Apple Dev Center",
    Icon: Apple,
  },
  {
    href: "https://supabase.com/dashboard/project/zgxzlynhkawkuicmariy",
    label: "Supabase",
    Icon: Database,
  },
  {
    href: "https://eu.posthog.com/project/50390/dashboard/138377",
    label: "PostHog",
    Icon: LineChart,
  },
  { href: "https://expo.dev/accounts/mindjar", label: "Expo", Icon: Rocket },
  { href: "https://mind-jar.com/", label: "Mind-Jar", Icon: Lamp },
];

export function SiteHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <div className="flex flex-1 items-center gap-2">
          <h1 className="hidden text-base font-medium sm:block">Mind Jar</h1>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {externalLinks.map(({ href, label, Icon }) => (
              <Button
                key={href}
                variant="ghost"
                asChild
                size="sm"
                className="hidden sm:flex"
              >
                <a
                  href={href}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="dark:text-foreground"
                >
                  <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
                  {label}
                </a>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
