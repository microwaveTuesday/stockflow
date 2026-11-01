# Midterm rubric and acceptance evidence

Based on the original Integrative Programming 1 midterm PDF, sections 3–7. This is a coverage checklist, not a guaranteed grade. Automated test results are in VERIFICATION.md; the instructor scores observed implementation and individual understanding.

| Criterion | Weight | Evidence and acceptance |
|---|---:|---|
| A Problem, requirements, design | 10 | DESIGN.md proposal, FR01–14, scope, architecture/use cases/sequence/ERD; team adds real names and approval |
| B Architecture and organization | 10 | React presentation, controller contracts, OrderService transaction rules, CurrencyService adapter, StockDb mappings; team explains boundaries |
| C Database and CRUD | 15 | EF migrations + PostgreSQL; products/categories/suppliers/customers/drafts CRUD; FK/check/unique constraints; acceptance tests 02–06 |
| D Authentication/authorization | 15 | Identity hashing, protected cookie sessions, role policies, lockout and stamp revocation; tests 01 and 07 |
| E REST / frontend integration | 15 | Real Axios requests, React/TS production build, Swagger, methods/statuses; browser workflow and test 08 |
| F External API | 10 | Relevant supplier-to-PHP estimate, real HttpClient, timed requests, labeled cache/no-rate behavior; CurrencyTests + direct live check |
| G Validation/errors | 10 | Form constraints and server DTOs, business rules and controlled errors; direct invalid API test 02; failure/rollback tests |
| H Git collaboration | 5 | CONTRIBUTING.md and task log template; actual shared GitHub history/reviews/contributions still supplied by team |
| I Documentation/reproducibility | 5 | README, Start/Stop, environment guidance, migrations, seed, API guide, limitations and verification record |
| J Demo/individual defense | 5 | SUBMISSION.md demonstration script and defense prompts; actual presentation required |

## Explicit acceptance scenarios

1. **Fresh setup:** follow README on an empty database. Migrations create Identity and domain tables; seed login works; refresh/restart retains records. Passwords are hashed in AspNetUsers. Inspect database without exposing hashes in presentation screenshots.
2. **Frontend integration:** sign in; add a category, supplier, customer and product. Browser Network shows Axios requests to `/api`. Refresh shows persisted data. Add product starts at zero stock.
3. **CRUD and history:** edit all four directories and product price. Archive a product/customer; active choices remove it, but historical orders remain readable. Categories/suppliers used by active products reject archive until reassigned. Create/edit/delete a draft.
4. **Authentication:** without a cookie, GET products returns 401. Invalid login fails. Logout removes the cookie. Five bad attempts lock an account; IP burst limit returns 429. Password changes end existing sessions. Do not lock the sole admin during a live demo.
5. **Roles:** Sales direct POST stock adjustment and GET users return 403; Inventory direct order creation returns 403. Admin performs each permitted operation. Sales cannot access supplier/FX data. Changed/disabled employee access invalidates its old cookie.
6. **Server validation:** bypass HTML and send blank names, bad email, negative price, fractional price beyond two decimals, invalid IDs, empty item list, negative quantity, duplicate lines and duplicate SKU. Expect 400 or duplicate conflict 409; no partial data changes or raw exception details.
7. **Stock movements:** receive +10 with a reason, correct -2 with a reason, see actor/time/delta. Reject zero and adjustment below zero. No endpoint permits direct product-stock overwrite.
8. **Successful order:** create 2-unit draft; no quantity deduction yet. Review saved total. Confirm; all stock and movements update atomically. Current prices changing later do not alter the confirmed order's price snapshot.
9. **Oversell:** stock=5; create two different 4-unit drafts; confirm simultaneously. Exactly one succeeds, one returns 409, stock=1. Automated API test 04 performs the real PostgreSQL race.
10. **Atomicity:** confirm a two-line order with enough stock on its first product and insufficient stock on its second. Expect 409, unchanged quantities, no new movements and draft status. Test 05 checks this.
11. **Exactly-once transitions:** repeat confirm; stock does not change twice. Send four cancellation requests concurrently; stock returns once and one return movement exists. Reconfirm canceled order fails. Editing/deleting confirmed orders fails.
12. **External integration:** request USD 100 estimate, show provider, base/target currencies, decimal calculation, rate date and indicative label. Provider data is never hard-coded as live data.
13. **External failure:** set Fx__Offline=true, restart, request estimate: 503 with a clear message and no fabricated number; catalog/orders still operate. Handler tests prove warm saved-rate fallback is dated and labeled, and malformed/stale provider responses are rejected.
14. **Usability:** complete browser order workflow; no console page errors. Toggle theme and refresh; preference persists. Tab through controls; Escape closes a dialog and focus returns to its trigger. At 390px, navigation opens, content fits, tables scroll inside panels. Empty, loading, error and saved states are understandable.
15. **Reproducibility and defense:** another teammate follows setup, then explains API requests, database relationships, authorization, transaction/guarded-update reasoning and external failure handling. Provide truthful GitHub evidence and AI disclosure according to policy.

## Manual checks still appropriate

Full screen-reader audit, contrast measurement of every control/state, multi-browser accessibility checks, long-name/localized-content review, production TLS/proxy configuration and the 1,000-product performance target are not automatically implied by the functional test suite. Record them separately if performed. Scope exclusions appear in README.
