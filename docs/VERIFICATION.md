# Verification record

Verified **1 November 2026, Asia/Manila**, in this Windows workspace. This records executed checks, not an earned rubric score.

## Environment

.NET SDK 10.0.401 / ASP.NET Core + EF Core 10.0.13, Npgsql EF provider 10.0.3, Node.js 24.21.0, Vite 7.3.7, Docker Desktop, PostgreSQL **17** from the supplied Compose service. Earlier development checks also ran on a disposable PostgreSQL 16 container. Final acceptance ran on the fresh PostgreSQL 17 schema and generated local account passwords.

| Check | Observed result |
|---|---|
| Backend compile | Success, zero warnings/errors |
| Frontend TypeScript + production bundle | Success; bundled fonts, no runtime font-server dependency |
| .NET currency adapter tests | **5 passed**, zero failed/skipped |
| Python/PostgreSQL API acceptance suite | **9 passed**, 2.853 seconds in final recorded run |
| Playwright real browser workflow | **1 passed**, 6.3 seconds including runner startup in final recorded run |
| npm dependency audit at install | Zero reported vulnerabilities at time of installation; not a formal security audit |
| Fresh database setup | Start.ps1 created PostgreSQL 17 persistent volume, migrated schema and seeded real records/accounts |
| Stop/start and persistence | Scripts stopped/restarted app; database retained 11 orders, including seven canceled orders, from acceptance/browser runs |
| Swagger | JSON generated and retrieved; endpoint contracts include request-header fields and statuses; snapshot at docs/openapi.json |
| Live Frankfurter call | HTTP 200: USD→PHP rate **63.68**, rate date **2026-10-30**, USD 100 → PHP **6,368.00**, isFallback=false |
| Offline service instance | Fx__Offline=true yielded controlled **503** without a saved rate; same instance GET products returned **200** |

Live rate above is historical test evidence, not a present-day financial quote.

## What the tests exercised

**API / real PostgreSQL:** unauthenticated 401, role 403, custom CSRF-header enforcement, blank/trimmed-name and fractional-price validation, bad IDs/negative values/duplicate lines, case-normalized duplicate SKU conflict, draft edit/delete, nonnegative adjustments, two competing four-unit orders against five units of stock, repeated confirmations, four concurrent cancellations, exactly one deduction/return movement, all-line rollback on insufficient stock, price snapshots, archive/reference checks, employee role revocation, self-access safeguard, logout, password-change revocation across sessions, currency input handling and Swagger presence.

**Currency adapter / deterministic handlers:** valid response and decimal calculation, outage after valid response with dated/labeled cache fallback, cold unavailable response, invalid/stale provider response, unsupported currency and negative amount. These are controlled HttpClient handler tests, not fake runtime UI data.

**Browser / real server and database:** Admin login, dashboard/data rendering, theme change surviving reload, product dialog Escape/focus restoration, actual stock receipt, actual sales draft creation, confirmation, cancellation, mobile navigation and 390px page-width check. No browser page exceptions occurred. Screenshots capture the running application with its real demonstration/test data:

- [Light overview](screenshots/overview-light.png)
- [Dark overview](screenshots/overview-dark.png)
- [Mobile products](screenshots/products-mobile.png)

## Issues found and corrected

An external Google Fonts request delayed reload, so fonts are now bundled from Fontsource. React development effect replay affected dialog focus restoration; the trigger is now captured before opening. The browser test initially read product options before the dialog had rendered; it now waits for the picker. Hidden accessibility labels escaped a wide table's scroll area on mobile; their positioning is now contained. Mobile closed navigation is hidden from sight and keyboard navigation. Windows stale PID-zero socket records caused false port conflicts after stopping; startup ignores those records and checks actual HTTP readiness.

The initial npm install needed Node's system certificate store in this environment (`NODE_USE_SYSTEM_CA=1`), without disabling TLS verification. NuGet restore completed after a slow initial package download. No synced reference files were modified.

## Limits of these results

No claim of production deployment readiness, formal penetration testing, full WCAG/screen-reader certification, multi-browser coverage or a measured 1,000-product performance target. Persistent warm FX cache is process-local; unit tests validate its fallback semantics. Team GitHub history, instructor approval and oral defense require genuine student work. See README for omitted final-project features and production requirements. Existing .local credentials/database state are intentionally excluded from the source archive.
