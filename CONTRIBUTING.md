# Contributing to the ReefCare MY frontend

1. Pull the latest shared branch before starting.
2. Create a short-lived feature branch for the assigned Iteration 3 story.
3. Build page-specific UI in the matching `features/epic-*` folder and keep the route's `page.tsx` focused on composing that UI.
4. Reuse the application shell and shared tokens. Do not copy the header or footer into an epic folder.
5. Keep API calls and API types in `lib/api`. Do not hard-code backend URLs in components.
6. Treat AI output as a suggestion: keep review, correction and confirmation controls in the user flow.
7. Do not expose exact locations, private evidence or internal coordinator notes in public screens or logs.
8. Ask the team before installing a dependency or changing shared configuration, navigation, tokens or route names.
9. Run `npm run check` and `npm run build` before requesting integration.

The route-group layouts provide role-specific views. They do not replace backend authentication, authorisation or ownership checks.
