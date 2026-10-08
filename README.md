# ReefCare MY — Iteration 3 frontend

This repository is the Iteration 3 starting point for the ReefCare MY
frontend, carrying forward the Iteration 1 and 2 baseline. Iteration 3 work
will add reef-aware dive planning, AI-assisted report and review suggestions,
conservation follow-up, observer feedback and reef-site history. AI suggestions
remain subject to observer or coordinator confirmation.

## Live Website Link

[Iteration 3 website](https://reef-care-my-frontend-iteration3.vercel.app/)


## Run locally

Requirements: Node.js 20.9 or newer and npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

On Windows PowerShell, replace the copy command with:

```powershell
Copy-Item .env.example .env.local
```

Open `http://localhost:3000`. Keep `.env.local` on your own machine; it is ignored
by Git and must not be committed.

## Quality checks

```bash
npm run check      # lint, TypeScript and automated tests
npm run build      # production build
```

Run both commands before opening a pull request.

## Project structure

- `app/` — Next.js routes and layouts.
- `features/` — feature UI, state and tests grouped by epic.
- `components/` — shared navigation, layout and form components.
- `config/` — shared application configuration.
- `lib/api/` — typed backend request functions and API models.
- `public/` — static images and other public assets.
- `docs/` — technical handoff material, including the Iteration 2 backend
  baseline to update as Iteration 3 APIs are integrated.

Route-group folders in parentheses do not appear in the URL. For example,
`app/(observer)/my-reports/page.tsx` is served at `/my-reports`.


