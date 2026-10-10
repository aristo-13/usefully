# General-Purpose Content & Resource Discovery Platform

This is the foundational repository for a modern, production-ready web platform that will feature:
- Blog articles
- Tutorials and guides
- External resources/links
- Downloadable resources
- Redirects/short links
- Categories, tags, and search
- An admin dashboard/CMS

## Tech Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Database/Auth/Storage**: Supabase
- **Icons**: Lucide React
- **Tooling**: ESLint, Prettier

## Project Structure

```
src/
├── app/
│   ├── (public)/    # Public-facing routes (homepage, articles, resources)
│   ├── admin/       # Protected admin dashboard and CMS routes
│   ├── auth/        # Authentication routes (login)
│   ├── api/         # API routes
│   └── layout.tsx   # Root layout
├── components/      # Reusable UI components
├── lib/
│   ├── supabase/    # Supabase clients (browser, server, middleware)
│   └── utils/       # Utility functions
└── ...
```

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a new Supabase project.
2. Copy `.env.local.example` to `.env.local`.
3. Add your Supabase `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

```bash
cp .env.local.example .env.local
```

*Note: Database schema and storage buckets will be configured in subsequent development phases. Refer to `docs/database-plan.md` and `docs/storage-plan.md` for architectural planning.*

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the public site.
Open [http://localhost:3000/admin](http://localhost:3000/admin) to view the admin dashboard placeholder.

## Architecture Decisions & Notes

- **App Router**: Uses Next.js App Router route groups `(public)` to separate public layout from the `admin` layout without affecting the URL path.
- **Supabase Integration**: Next.js middleware is configured to handle Supabase Auth session refresh and protect `/admin` routes.
- **Components**: UI components use Server Components by default, dropping down to Client Components only for interactivity.
