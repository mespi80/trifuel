@AGENTS.md
• Project Overview: TriFuel is an AI-powered triathlon training + nutrition platform. PWA, vegan-first, bilingual (EN/ES). Freemium model.
• Tech Stack: Next.js 15 (App Router), TypeScript strict, Tailwind CSS, Drizzle ORM + PostgreSQL, Redis, next-intl for i18n, NextAuth.js for auth, Recharts for charts, Radix UI for accessible primitives.
• Code Conventions: Functional components only. No default exports except pages. Use ‘use server’ / ‘use client’ directives explicitly. Collocate component + test + styles. Name files in kebab-case. API routes in /src/app/api/. Server actions for mutations.
• Domain Rules: Carbohydrate targets vary by training day type (3–12 g/kg). Protein: 1.6–2.2 g/kg/day split across 3–4 meals. Vegan micronutrient tracking: B12, iron, zinc, omega-3, calcium, vitamin D. Training zones: 5-zone HR model, FTP-based power, CSS-based swim pace.
• Testing: Vitest for unit/integration tests. Playwright for E2E. Minimum 80% coverage on /src/lib and /src/ai modules. Test file naming: \*.test.ts collocated with source.
• i18n: All user-facing strings go through next-intl. Message files in /src/messages/{en,es}.json. Never hardcode user-facing text.
• Git: Conventional commits (feat:, fix:, chore:, docs:). Branch naming: feature/TF-{number}-{description}, fix/TF-{number}-{description}.
