# Repository Guidelines

## Project Structure & Module Organization
`src/app` contains the Next.js App Router pages, layouts, and API handlers under `src/app/api/*/route.ts`. Dashboard views live in `src/app/dashboard`, shared feature components in `src/components`, and shadcn/ui primitives in `src/components/ui`. Put integrations and cross-cutting helpers in `src/lib`, and keep domain-specific utilities in `src/utils`. Static files belong in `public/`, and Supabase SQL changes go in `supabase/migrations/`.

## Build, Test, and Development Commands
Prefer `pnpm` because `pnpm-lock.yaml` is committed.

- `pnpm install`: install dependencies.
- `pnpm dev`: run the app locally at `http://localhost:3000`.
- `pnpm lint`: run ESLint with Next.js core web vitals and TypeScript rules.
- `pnpm build`: create a production build and catch integration/type issues.
- `pnpm start`: serve the production build for a final smoke test.

## Coding Style & Naming Conventions
Use TypeScript and keep changes compatible with the repo’s strict compiler settings. Match the existing style: 2-space indentation, double quotes, semicolons, and small focused files. Use `PascalCase` for React components, `camelCase` for helpers, and `useX` for hooks. Prefer the `@/*` alias over deep relative imports. Keep route folders lowercase, for example `src/app/api/users/[userId]`.

## Testing Guidelines
No automated test runner is configured today. Until one is added, `pnpm lint` and `pnpm build` are the minimum required checks. For every change, manually verify the affected dashboard page and any touched API route, then note that coverage in the pull request. If you introduce tests, place them near the feature as `*.test.ts` or `*.test.tsx`.

## Commit & Pull Request Guidelines
Recent history mixes descriptive commits with placeholder messages like `f` and `F`. Do not continue that pattern. Use short, imperative commit subjects such as `Add notification deletion modal`. Keep each commit scoped to one logical change. PRs should include a concise summary, linked issue or context, screenshots for UI work, sample request/response details for API changes, and any migration or environment updates.

## Security & Configuration Tips
Never commit secrets. This app depends on `AUTH_SECRET`, `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTHOG_HOST`, `POSTHOG_PROJECT_ID`, and `POSTHOG_API_KEY`. Store them in local environment files and document any new variables in the PR.
