# Epic 9 API contract: frontend expectations

Status: proposal for backend review
Frontend types: `lib/api/planningApi.ts`
Frontend data source: `features/epic-09-planning/planning-source.ts`

The Epic 9 frontend is already wired to these routes behind a switch. It stays on sample data until the backend confirms or adjusts this contract, so nothing changes for users in the meantime. Please review, reply with changes, and agree on the open questions at the end.

Conventions: JSON uses camelCase, as in the existing API. Errors use the existing `{ "detail": ... }` shape. Public routes need no authentication. Plan routes need an Observer bearer token.

## Shared values

| Name | Values |
| --- | --- |
| `areaCode` | `perhentian`, `redang`, `tioman` (matches `planning_area.area_code`) |
| `band` | `more_favourable`, `mixed`, `less_favourable`, `unavailable`, `out_of_horizon` |
| season `state` | `monsoon`, `transition`, `typical`, `unreviewed` |
| `diveSiteId` | the existing numeric `dive_site.dive_site_id` |
| dates | `YYYY-MM-DD`, Malaysia calendar day (Asia/Kuala_Lumpur) |

`unavailable` means the provider or site position is missing. `out_of_horizon` means the date is outside the forecast range. Neither should be guessed or extrapolated.

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

A month with no reviewed guidance may be omitted or sent with `"state": null`. The frontend then shows "No data" and infers nothing.

### 2. Date comparison (US9.2)

`GET /api/v1/public/planning/areas/{areaCode}/dates?from=YYYY-MM-DD&to=YYYY-MM-DD`

The window is at most 14 days. The frontend never sends a longer one.

```json
{
  "areaCode": "redang",
  "ruleVersion": "string",
  "retrievedAt": "2026-10-02T08:00:00+08:00",
  "days": [
    {
      "date": "2026-10-03",
      "band": "mixed",
      "assessableSites": 3,
      "totalSites": 4,
      "breakdown": { "moreFavourable": 1, "mixed": 1, "lessFavourable": 1 }
    }
  ]
}
```

Return one entry per requested date. The area band is the least favourable of the assessable sites. A date outside the horizon should come back as `out_of_horizon` with zero assessable sites.

### 3. Site comparison (US9.3)

`GET /api/v1/public/planning/areas/{areaCode}/sites?date=YYYY-MM-DD`

```json
{
  "areaCode": "redang",
  "date": "2026-10-03",
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

Include every configured site in the area. Use `band: "unavailable"` with null values for a site that cannot be assessed (for example, missing position). A site missing from the list is shown as unavailable.

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

The client sends only the site and date. The backend assembles the factual inputs (conditions and public reef context) itself, so the client cannot supply facts. If the AI service fails, return `status: "unavailable"` with `text: null` (not an error status) so the frontend keeps the facts visible and offers a retry. Paragraphs are separated by a blank line.

## Observer routes (US9.5)

All require an authenticated Observer. A plan must only be readable and changeable by its owner.

| Method | Route | Body | Response |
| --- | --- | --- | --- |
| GET | `/api/v1/plans` | none | array of plans, or `{ "items": [...] }` |
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

Only the intent is stored (name, area, date, sites). Forecast values are not saved; the frontend refreshes them when a plan is reopened. Please validate that every site belongs to the area and that `name` is 1 to 80 characters. Suggested errors: 404 for a plan that is not the caller's, 422 for invalid input.

## US9.6: report handoff

No backend change. The frontend sends the observer to the existing report flow with the confirmed site and date.

## Open questions for the backend

1. Are the routes and response shapes above acceptable? Which fields should change?
2. Where do forecasts come from (live Open-Meteo, or the `area_daily_conditions` history)? What is the horizon? The frontend assumes today to today + 6 in Malaysia time. Is there caching, and what is the retrieval time?
3. Which thresholds define the bands? The prototype uses waves <= 0.8 m and wind <= 12 km/h for more favourable, and waves > 1.5 m or wind > 20 km/h for less favourable. These are illustrative, not validated.
4. Is the brief produced by a real AI service? What does it return when it fails or times out?
5. Where will the plans table live, and when will a dev endpoint be available to test against?
6. How is the seasonal reference maintained and reviewed, and who owns the months with no reviewed data?

## Frontend switch

Set `NEXT_PUBLIC_E9_DATA_SOURCE=api` to use these routes. The default is `sample`. The interactive preview at `/plan-a-dive?preview=1` always uses sample data.
