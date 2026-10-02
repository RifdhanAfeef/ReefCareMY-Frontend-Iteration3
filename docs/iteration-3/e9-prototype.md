# Epic 9 interactive frontend prototype

Entry: `/plan-a-dive`. The default view uses the shared site theme and hides development controls. For presentation-only demo workspaces and service-state controls, use `/plan-a-dive?preview=1`. Public and Observer navigation include **Plan a dive**. The existing Explore site panel passes its selected site into the planner.

This version is for product-discovery demonstration and UI review. Forecasts, seasonality, public reef activity and AI prose are explicitly labelled synthetic fixtures. It does not contact an E9 provider, AI service or plans backend. Existing login, registration and reporting remain real application flows and require the existing backend.

## Run and demonstrate

```sh
npm install
npm run dev -- --port 3109
```

1. Open `http://localhost:3109/plan-a-dive?preview=1` for the demo steps below.
2. Choose Perhentian, Redang or Tioman. Compare a date range of up to 14 days. The rolling sample forecast covers today through today + 6 in Malaysia time.
3. Select a date and inspect the source values, units and rules for individual sites. Use the + controls to add multiple sites.
4. Open a reef-aware brief and generate the sample text. Facts and generated prose remain separate.
5. Save the plan. For an entirely offline presentation, choose **Continue in demo workspace**, then Save again. This is not an authenticated account and grants no reporting privileges.
6. In My dive plans, reopen, rename, change sites/date, or delete a plan. A demo workspace contains a clearly labelled past-plan example.
7. Open the past example, confirm the actual site/date, and continue to the existing authenticated report flow. The report form offers a deliberate **Use suggested date** action; Dive Session and location confirmation are still required.
8. Open Seasonal calendar and choose a month. October demonstrates missing reviewed reference data.
9. Use Demo settings to show provider failure, unavailable AI, missing public context or missing first-site position. Choose a date outside the seven-day horizon to demonstrate an out-of-range state.

No credentials are needed for public planning. The isolated demo workspace is available only in explicit preview mode; the normal save flow requires an Observer account. Saved plans are local browser data, scoped by an authenticated Observer ID or a randomly generated demo workspace ID. This separation is only prototype organisation, not production authorization. The demo session ends when its tab session ends or the user exits the workspace; stored prototype plans can be removed through browser storage settings.

## Story coverage

| Story | Prototype surface |
| --- | --- |
| US9.1 | Twelve-month calendar, source/basis and fixture review date, explicit missing month |
| US9.2 | Date range, per-date bands and site breakdown, deterministic sample rules, seven-day horizon, provider failure |
| US9.3 | All configured profile sites in the selected area, source values and linked existing site information, shared grid examples, missing-position state |
| US9.4 | Separate factual condition and public reef summaries; simulated AI prose; missing-data and AI-failure states |
| US9.5 | Login boundary, local demo option, multi-site saves, list/reopen/edit/delete, recalculated sample conditions, past-plan label |
| US9.6 | Editable actual site/date confirmation and handoff to existing authenticated E4 entry |

The user stories specify US9.5–9.6 as MUST; the Proposal calls them SHOULD. This prototype includes both. Only E9 and the necessary navigation/authentication/reporting entry integrations were changed; E7/E8 management interfaces are not implemented here.

## Backend integration boundary

The supplied Backend Design & Integration Standard v0.1 marks these contracts as proposed. Replace `planning-data.ts` sample adapters with the agreed responses; do not treat illustrative thresholds as validated operational rules.

| UI | Proposed route |
| --- | --- |
| Seasonal calendar | GET `/api/v1/public/planning/areas/{areaCode}/seasonality` |
| Date comparison | GET `/api/v1/public/planning/areas/{areaCode}/dates?from=...&to=...` |
| Site comparison | GET `/api/v1/public/planning/areas/{areaCode}/sites?date=...` |
| Public reef context | GET `/api/v1/public/dive-sites/{diveSiteId}/context` |
| Brief | POST `/api/v1/public/planning/brief` with `siteId` and `plannedDate` only |
| Private plans | GET/POST `/api/v1/plans`; GET/PATCH/DELETE `/api/v1/plans/{planId}` |

The brief's factual inputs must ultimately be assembled by the backend, not supplied as client-authoritative facts. Production plans need server-enforced owner access. Agree area codes, complete response shapes, forecast rules/provider/horizon/cache policy and account plan persistence with the backend owner. Existing numeric `backendDiveSiteId` values are retained through the shared site catalogue.

## Connecting to the backend

Set `NEXT_PUBLIC_E9_DATA_SOURCE=api` (see `.env.example`) to replace the sample adapters with the routes above. The default is `sample`, and `/plan-a-dive?preview=1` always stays on sample data so the demo states keep working.

- `lib/api/planningApi.ts` holds the typed calls for each route. The response shapes are the frontend's expectation of the proposed contract; adjust the DTOs there once the backend owner agrees them.
- `features/epic-09-planning/planning-source.ts` is the single place that chooses between sample and API data. It maps backend dive site ids to the shared site catalogue (`backendDiveSiteId`) and area codes (`perhentian`, `redang`, `tioman`) to the UI areas.
- Public reef context uses the existing `GET /api/v1/public/dive-sites/{id}/activity` route, which already exists in the backend, instead of the proposed `/context` route.
- In API mode, saved plans are read and written through `/api/v1/plans` and require an Observer login; the browser-storage workspace is not used.
- Loading and failure states are shown for the date comparison, site conditions, seasonal calendar and reef context, each with a retry action.

## Verification

`npm run check` runs lint, TypeScript and tests. The planning tests cover deterministic threshold boundaries, Malaysia dates, forecast horizons, missing positions/provider failure, local workspace separation and safe authentication returns. Browser checks cover saving, reopening, past-plan handoff, brief generation, failure states, seasonal reference and mobile overflow.
