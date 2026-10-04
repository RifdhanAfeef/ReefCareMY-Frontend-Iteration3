# Epic 9 API contract: frontend expectations

Status: frozen E9 frontend/backend contract, confirmed by the backend owner on 4 Oct 2026.
Frontend types: `lib/api/planningApi.ts` (public planning) and `lib/api/plansApi.ts` (saved plans)
Frontend data source: `features/epic-09-planning/planning-source.ts`

The Epic 9 frontend is wired to these routes behind a switch. It stays on sample data until the backend endpoints are available.

Conventions: JSON uses camelCase, as in the existing API. Errors use the existing `{ "detail": ... }` shape. Public routes need no authentication. Plan routes need an Observer bearer token.

## Shared values

| Name | Values |
| --- | --- |
| `areaCode` | `perhentian`, `redang`, `tioman` (matches `planning_area.area_code`) |
| `band` | `more_favourable`, `mixed`, `less_favourable`, `unavailable`, `not_assessable`, `out_of_horizon` |
| season `state` | `monsoon`, `transition`, `typical`, `unreviewed` |
| `diveSiteId` | the existing numeric `dive_site.dive_site_id` |
| dates | `YYYY-MM-DD`, Malaysia calendar day (Asia/Kuala_Lumpur) |

`not_assessable` means the site has no usable planning position (US9.3). `unavailable` means the site is configured but forecast or provider data is unavailable. `out_of_horizon` means the date is outside the forecast range. None of these should be guessed or extrapolated.

Forecast source: live Open-Meteo. `area_daily_conditions` is historical context only and is never used as a forecast. Public horizon: today through today + 6 days, Asia/Kuala_Lumpur. Assessment thresholds are not fixed here; the backend applies one deterministic, versioned rule set (`ruleVersion`) once the team freezes the thresholds.

## Public routes

### 1. Seasonal calendar (US9.1)

`GET /api/v1/public/planning/areas/{areaCode}/seasonality`

```json
{
  "areaCode": "redang",
  "source": "string or null",
  "basis": "string or null",
  "reviewedAt": "2026-09-01",
  "months": [
    { "month": 1, "state": "monsoon", "headline": "string", "detail": "string" }
  ]
}
```

Always return all 12 months. A month with no reviewed guidance is sent with `"state": "unreviewed"`, never omitted and never null. The frontend infers nothing for it.

### 2. Date comparison (US9.2)

`GET /api/v1/public/planning/areas/{areaCode}/dates?from=YYYY-MM-DD&to=YYYY-MM-DD`

The window is at most 14 days. The frontend never sends a longer one.

```json
{
  "areaCode": "redang",
  "source": "string",
  "ruleVersion": "string",
  "retrievedAt": "2026-10-02T08:00:00+08:00",
  "days": [
    {
      "date": "2026-10-03",
      "band": "mixed",
      "assessableSites": 3,
      "totalSites": 4,
      "breakdown": { "moreFavourable": 1, "mixed": 1, "lessFavourable": 1 },
      "signals": {
        "waveHeightMaxM": 1.0,
        "windSpeedMaxKmh": 14.0,
        "precipitationProbabilityMaxPct": 30.0
      },
      "reasons": [
        "The area is classified as mixed from 3 of 4 configured site(s). The least favourable assessable site determines the area band."
      ]
    }
  ]
}
```

Return one entry per requested date. Each date carries rule-based `reasons` (`string[]`) and one aggregated `signals` object (or `null`), not per-site values. Individual site values come from the site comparison route. `source`, `retrievedAt` and `ruleVersion` keep the assessment explainable. The area band is the least favourable of the assessable sites. A date outside the horizon should come back as `out_of_horizon` with zero assessable sites.

### 3. Site comparison (US9.3)

`GET /api/v1/public/planning/areas/{areaCode}/sites?date=YYYY-MM-DD`

```json
{
  "areaCode": "redang",
  "date": "2026-10-03",
  "source": "string",
  "ruleVersion": "string",
  "retrievedAt": "2026-10-02T08:00:00+08:00",
  "sites": [
    {
      "diveSiteId": 23,
      "band": "more_favourable",
      "waveHeightMaxM": 0.6,
      "windSpeedMaxKmh": 9,
      "reason": "Human-readable rule explanation"
    }
  ]
}
```

Include every configured site in the area. Use `band: "not_assessable"` with null values for a site with no usable planning position, and `band: "unavailable"` for a configured site whose forecast or provider data is missing. A site missing from the list is shown as unavailable.

### 4. Public reef context (US9.4)

No new route. The frontend uses the existing `GET /api/v1/public/dive-sites/{diveSiteId}/activity`, which already returns `hasActivity`, `items[]` and `message`.

### 5. Planning brief (US9.4)

`POST /api/v1/public/planning/brief`

```json
{ "siteId": 23, "plannedDate": "2026-10-03" }
```

```json
{
  "siteId": 23,
  "plannedDate": "2026-10-03",
  "status": "generated",
  "text": "Paragraph one.\n\nParagraph two.",
  "generatedAt": "2026-10-02T08:00:00+08:00"
}
```

The client sends only the site and date. The backend assembles the factual inputs (conditions and public reef context) itself, so the client cannot supply facts. The response has no separate fact-context field. The frontend shows the facts from the date comparison, site comparison and public activity routes, so the generated prose is never the only representation of them. On failure `generatedAt` is also `null`. If the AI service fails, return `status: "unavailable"` with `text: null` (not an error status) so the frontend keeps the facts visible and offers a retry. Paragraphs are separated by a blank line.

## Observer routes (US9.5)

All require an authenticated Observer. A plan must only be readable and changeable by its owner.

| Method | Route | Body | Response |
| --- | --- | --- | --- |
| GET | `/api/v1/plans` | none | always `{ "items": [...] }` |
| GET | `/api/v1/plans/{planId}` | none | the plan |
| POST | `/api/v1/plans` | plan write | created plan |
| PATCH | `/api/v1/plans/{planId}` | plan write | updated plan |
| DELETE | `/api/v1/plans/{planId}` | none | 204 |

Plan write:

```json
{
  "name": "Redang dive plan",
  "areaCode": "redang",
  "plannedDate": "2026-10-03",
  "diveSiteIds": [23, 21]
}
```

Plan response:

```json
{
  "planId": "string",
  "name": "string",
  "areaCode": "redang",
  "plannedDate": "2026-10-03",
  "diveSiteIds": [23, 21],
  "updatedAt": "2026-10-02T08:00:00Z"
}
```

`planId` is a JSON number (the API model is `int`; IDs stay far below `Number.MAX_SAFE_INTEGER`). Only the intent is stored (`name`, `areaCode`, `plannedDate`, `diveSiteIds`). Forecasts, bands, reasons and AI briefs are never saved. When a plan is reopened the frontend loads it from `/plans/{planId}`, requests the current `/public/planning/.../dates` and `/sites` data, and shows the refreshed assessment separately from the saved intent. The backend validates that every site belongs to the area and that `name` is 1 to 80 characters. Errors: 422 for invalid input. A plan that does not exist and a plan owned by another Observer both return 404 with `{ "detail": "Plan not found", "code": "not_found" }`, so the API never confirms that another Observer's plan exists.

## US9.6: report handoff

No backend endpoint. The saved plan provides frontend planning intent only. The selected dive site may prefill the reporting flow, while `plannedDate` stays contextual and is never submitted as `observedAt` automatically: the report form shows it as a suggestion the observer can apply and edit. Final submission uses the existing Observer-owned Dive Session and Report APIs.

## Confirmed with the backend (4 Oct 2026)

1. Routes and public/private split accepted, with the changes above.
2. Forecasts come from live Open-Meteo; horizon is today to today + 6 in Malaysia time.
3. Thresholds are not locked. A versioned rule set (`ruleVersion`) applies after the team freezes them.
4. Brief failure returns HTTP 200 with `status: "unavailable"` and `text: null`.
5. Saved plans: `saved_plan` tables are being added to the shared database; `planning_area.area_code` is the area key.
6. Seasonal reference: no reviewed table exists yet, so all months return `unreviewed` until curated guidance is added.

## Integration status

The public planning routes and the saved-plan CRUD routes are implemented on the backend (suite green: 251 passed, 1 skipped). Saved plans need the agreed DB tables in the target environment before end-to-end testing. The backend owner will say when to switch `NEXT_PUBLIC_E9_DATA_SOURCE` to `api`.

Open outside this contract: an explicit `planning_area` to `dive_site` mapping (the backend currently matches `area_label = public_area_label` exactly).

## Frontend switch

Set `NEXT_PUBLIC_E9_DATA_SOURCE=api` to use these routes, including saved plans. The default is `sample`, where plans stay in browser storage. The interactive preview at `/plan-a-dive?preview=1` always uses sample data.
