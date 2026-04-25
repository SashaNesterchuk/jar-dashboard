import { NextResponse } from "next/server";

/**
 * SSOT F.5.2 local-first guard:
 * user-facing memory flows should run via client hooks and on-device
 * storage. Server-side memory transport routes remain smoke-only and
 * must be explicitly enabled.
 */
export function guardServerSmokeRoute() {
  const enabled = process.env.MEMORY_ENABLE_SERVER_SMOKE_ROUTES === "true";
  if (enabled) return null;
  return NextResponse.json(
    {
      error:
        "Server memory transport is disabled (local-first mode). Use client hooks under /dashboard/* simulators.",
      hint: "Set MEMORY_ENABLE_SERVER_SMOKE_ROUTES=true to re-enable smoke API routes.",
    },
    { status: 410 },
  );
}
