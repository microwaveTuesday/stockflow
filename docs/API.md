# API contract

Interactive Swagger: `http://127.0.0.1:5088/swagger` while Development mode is enabled. JSON specification: `/swagger/v1/swagger.json`. The React app uses `/api` through Vite's same-origin proxy. All bodies and responses are JSON except successful 204 responses, which have no body. Integers identify business records; Identity uses string employee IDs. Dates are UTC ISO-8601.

## Authentication and permissions

POST `/api/auth/login` with `{ "email": "<employee email>", "password": "<password>" }`. It sets the HttpOnly session cookie and returns `{ id, email, displayName, role }`. Send cookies with subsequent requests (`curl -c cookies.txt` then `curl -b cookies.txt`, or Axios withCredentials). **All POST, PUT and DELETE requests must include `X-StockFlow: 1`.** Swagger exposes this field and defaults it to 1. No Authorization bearer header is used. Login is public and rate-limited; all other business endpoints require authentication.

| Method and path | Role | Body / response |
|---|---|---|
| POST `/api/auth/login` | Public | Login → employee summary, 200 |
| GET `/api/auth/me` | All | Employee summary |
| POST `/api/auth/logout` | All | Signs out, 204 |
| POST `/api/auth/password` | All | `{currentPassword,newPassword}` → signs out and revokes old sessions, 204 |
| GET `/api/products?search=code&includeInactive=false` | All | Array of products with category/supplier names, quantities and prices |
| GET `/api/products/{id}` | All | Product or 404 |
| POST `/api/products` | Admin | Product fields below → `{id}`, 201 + Location |
| PUT `/api/products/{id}` | Admin | Product fields → 204; never directly sets stock |
| DELETE `/api/products/{id}` | Admin | Soft archive → 204 |
| GET `/api/categories` | All | Active categories |
| POST `/api/categories` | Admin | `{name}` → created record, 201 |
| PUT `/api/categories/{id}` | Admin | `{name}` → 204 |
| DELETE `/api/categories/{id}` | Admin | Archive if no active products use it, 204 / 409 |
| GET / POST `/api/suppliers` | Admin, Inventory | Active list / `{name,email?,phone?}` → 201 |
| PUT / DELETE `/api/suppliers/{id}` | Admin, Inventory | Update / archive; reference protection |
| GET / POST `/api/customers` | Admin, Sales | Active list / `{name,email?,phone?}` → 201 |
| PUT / DELETE `/api/customers/{id}` | Admin, Sales | Update / archive; history retained |
| GET / POST `/api/orders` | Admin, Sales | List / draft body below → `{id}`, 201 |
| GET `/api/orders/{id}` | Admin, Sales | Order including saved item details and total |
| PUT / DELETE `/api/orders/{id}` | Admin, Sales | Update draft body / delete draft; 204 or 409 |
| POST `/api/orders/{id}/confirm` | Admin, Sales | No body; atomic deduction or 409; 204 on success/repeat |
| POST `/api/orders/{id}/cancel` | Admin, Sales | No body; restore confirmed quantities once; 204 on success/repeat |
| GET `/api/inventory/movements?productId=1` | Admin, Inventory | Latest 500 movements, optional product filter |
| POST `/api/inventory/{id}/adjust` | Admin, Inventory | `{delta,reason}` → 204; zero/negative result rejected |
| GET `/api/currency?currency=USD&amount=100` | Admin, Inventory | Quote or safe 503 |
| GET / POST `/api/users` | Admin | List / `{email,displayName,password,role}` → `{id}`, 201 |
| PUT `/api/users/{id}` | Admin | `{role,active}` → 204; self-access and last-admin safeguards |

Product request:

```json
{"name":"Bamboo notebook","sku":"BN-001","categoryId":1,"supplierId":1,"price":149.00,"reorderLevel":10}
```

Draft order request:

```json
{"customerId":1,"items":[{"productId":1,"quantity":2},{"productId":2,"quantity":1}]}
```

Product codes are normalized uppercase and globally unique, including archived products. Quantities must be positive integers, with a maximum 1,000,000 per order line. At most 100 distinct product lines; duplicate lines are rejected. Price is nonnegative and has at most two decimal places. Reference IDs must identify active records. Stock adjustments range from -1,000,000 to 1,000,000, excluding zero, with a 5–300-character reason. Stored prices use decimal and PostgreSQL precision 14,2. Names and contact fields have server maximum lengths. Customers/suppliers allow blank optional contact information; nonblank email must be valid.

Example quote:

```json
{"baseCurrency":"USD","targetCurrency":"PHP","amount":100,"rate":57.25,"converted":5725.00,"rateDate":"2026-10-30","isFallback":false,"message":"Frankfurter reference rate. Estimates may differ from your bank’s rate."}
```

The numeric example is illustrative, not a fetched rate. Provider: [Frankfurter v1 documentation](https://frankfurter.dev/v1/). Supported base currencies in this release: USD, EUR, GBP, JPY, AUD, CAD, SGD. Target is PHP; amounts 0–99,999,999. Validate provider data before saving. Provider failures use a recent process-local saved rate with `isFallback: true`, otherwise 503; the UI shows its date and warning. Use `Fx__Offline=true` before starting the API for deterministic cold-outage demonstration; this never affects stock or order endpoints. A restart clears the saved-rate cache. Automated handler tests exercise live, saved, invalid and unavailable responses without depending on public network access.

## Errors

400: malformed/invalid input, 401: missing/expired/invalidated session or invalid login, 403: insufficient role, 404: missing record, 409: insufficient stock, forbidden state transition, duplicate SKU/name or relationship conflict, 429: login rate limit, 503: no external quote available. Unexpected failures return 500 with a generic message and trace ID; details stay in server logs.

Business errors: `{ "title": "Please check your request", "status": 409, "detail": "…plain-language explanation…", "traceId": "…" }`. Automatic DTO validation uses ASP.NET ValidationProblemDetails with `errors: { field: [messages] }`. 401/403 from authorization can be bodyless; the Axios client handles those by status. No raw database errors or password hashes appear in responses.

## Reconciliation and concurrency

Use `OrderService.cs` to trace all state-changing order operations. A transaction plus row lock handles same-order races; conditional quantity updates handle competing orders. See [Microsoft's EF Core guidance](https://learn.microsoft.com/en-us/ef/core/saving/execute-insert-update-delete) for why row counts and explicit transactions are both needed with ExecuteUpdate. Retrying confirm/cancel is safe for the same resulting state. Creation of drafts and manual adjustments are not idempotent: the UI disables submit while a request is pending; after an uncertain connection failure, inspect records before retrying. Automatic retries of these mutations are intentionally not enabled.
