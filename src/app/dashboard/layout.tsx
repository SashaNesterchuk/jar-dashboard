/**
 * Dashboard shell for the memory layer smoke tests.
 *
 * EPIC 3 DoD: every route under `/dashboard` renders inside
 * `<MemoryProvider>` so memory hooks (context, subscription, storage)
 * work regardless of page. The portal `<PremiumToggle />` gate is kept as
 * a no-op while memory tester flows live inline in `/dashboard/ai-test`.
 *
 * This layout is intentionally minimal — downstream pages (existing
 * analytics, AI-test, etc.) keep their own `SidebarProvider` /
 * `SiteHeader`.
 */

import * as React from "react";
import { MemoryProvider } from "@/lib/memory/hooks/useMemoryContext";
import { PremiumToggleGate } from "./_shell/premium-toggle-gate";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MemoryProvider>
      <PremiumToggleGate />
      {children}
    </MemoryProvider>
  );
}
