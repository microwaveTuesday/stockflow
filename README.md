# StockFlow

Small-business inventory and sales order management for the Integrative Programming 1 midterm. A real React + TypeScript + Axios client connects to an ASP.NET Core Web API, ASP.NET Core Identity, EF Core and PostgreSQL. No frontend business records are mocked or stored in local storage.

## Run on Windows

Install **.NET SDK 10**, **Node.js 22.12+ or 24**, **Docker Desktop with Linux containers**, and optionally Python 3.11+ for API acceptance tests. Keep Docker Desktop running. Open PowerShell in this folder:

```powershell
.\Start.ps1
```

Open [StockFlow](http://127.0.0.1:5178). First startup installs dependencies, starts PostgreSQL 17 with a persistent volume, applies committed EF migrations, and seeds four sample products and three employee roles. Initial startup can take a few minutes. The script prints the randomly generated initial password; it is also saved locally in **.local/settings.json**, which is excluded from Git.

Sign in with `admin@stockflow.local`, `sales@stockflow.local`, or `inventory@stockflow.local` and that initial password. Click your initial in the sidebar to change your password. These are fictional demonstration accounts. Set different passwords before sharing access. The initial password only applies to freshly created accounts; later starts do not reset passwords.

Use `Start.ps1 -SkipInstall` after the first successful setup. Run `Stop.ps1` to stop the application. `docker compose stop` stops the database while preserving its volume. Ports 5178, 5088 and 55432 must be available. Do not run two copies of Start.ps1. Inspect `.local/api-error.log`, `.local/api.log`, `.local/web-error.log`, and `.local/web.log` if the browser cannot connect. All script commands should be run from this directory.

### Manual setup / macOS / Linux

Create a local, untracked `.env` with `STOCKFLOW_DB_PASSWORD=<a-long-random-password>` for Docker Compose. Export that same password in your shell; Compose's `.env` is not automatically loaded into ASP.NET. Choose a separate initial password with 12+ characters, uppercase, lowercase, digits and punctuation.

```sh
docker compose up -d --wait
dotnet tool restore
dotnet restore backend
dotnet ef database update --project backend
```

Before running EF or the API, set these environment variables using your shell's syntax:

| Setting | Value |
|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Development` for local HTTP and Swagger |
| `ASPNETCORE_URLS` | `http://127.0.0.1:5088` |
| `ConnectionStrings__Database` | `Host=127.0.0.1;Port=55432;Database=stockflow;Username=stockflow;Password=<your-db-password>` |
| `Seed__Password` | Your strong initial employee password |
| `Seed__Demo` | `true` to add fictional sample business data |
| `Fx__Offline` | Optional `true` to demonstrate currency-provider outage |

Run in separate terminals:

```sh
dotnet run --project backend --no-launch-profile
npm ci --prefix frontend
npm run dev --prefix frontend
```

The API automatically migrates at startup, so the explicit database-update command is optional for local setup. To make a new schema change: `dotnet ef migrations add MeaningfulName --project backend`, inspect it, then `dotnet ef database update --project backend`. Committed migrations and model snapshot are in `backend/Migrations`; do not substitute EnsureCreated for migrations.

### Verify

```powershell
dotnet build backend
npm run build --prefix frontend
dotnet test tests/StockFlow.Tests.csproj
$env:STOCKFLOW_TEST_PASSWORD='<current initial password>'
python tests/acceptance.py
cd frontend
npx playwright install chromium
npm test
```

Start the API and frontend before running acceptance/browser tests. Python tests use the three seed accounts and assume their initial passwords have not been changed. They create `AT...` records and leave them for inspection. Use a disposable database for repeated evaluations. Browser tests use the seeded Bamboo notebook and create real stock/order records. These tests are intentionally not run against a production database.

See [verification results](docs/VERIFICATION.md), [rubric and acceptance checklist](docs/ACCEPTANCE.md), [system design and diagrams](docs/DESIGN.md), [API guide](docs/API.md), and [demo/team guide](docs/SUBMISSION.md).

## Daily workflows

- **Administrator:** add categories and suppliers, add products (zero opening stock), invite employees, assign access, maintain customers, and process orders.
- **Inventory staff:** receive stock with a positive quantity or correct stock with a negative quantity; always give a reason. Review the immutable movement history and estimate foreign supplier costs.
- **Sales staff:** maintain customers, create a draft with products and quantities, review saved prices, and confirm. If any product is unavailable, nothing is deducted. Canceling a confirmed order returns all its units exactly once.

Products, categories, customers and suppliers are archived rather than physically deleted so past records remain readable. Active product references must be reassigned before archiving a category or supplier. Only draft orders can be edited/deleted. Sales staff can manage all business orders, not just orders they created, as intended for a shared sales desk.

## Security and deployment

Passwords use ASP.NET Core Identity hashing and complexity rules. Identity has five-attempt account lockout and the login route has IP rate limiting. Sessions use signed/encrypted HttpOnly cookies, SameSite=Strict, a four-hour absolute expiry and Secure outside Development. Password and role changes invalidate existing sessions using the security stamp. API authorization checks happen on the server for every operation. A required custom `X-StockFlow: 1` header on all API mutations, with no cross-origin CORS permission, blocks cross-site form submissions. No secrets or tokens are kept in browser local storage; only the theme preference is saved there.

Local Vite proxies `/api` to the backend to keep one browser origin. Production needs an HTTPS reverse proxy serving the built `frontend/dist` and forwarding `/api` to ASP.NET on the **same origin**. Do not expose the development server publicly. Set Production mode, configure trusted proxy forwarding and TLS, persist/protect ASP.NET Data Protection keys, use a secret manager, and move migrations into a single deployment step if running several API instances. Production hosting is not configured in this repository. Swagger is enabled in Development only.

Frankfurter v1 is used intentionally as a supported compatibility API; its provider recommends v2 for new integrations. The adapter is isolated for later migration. It requests reference rates server-side with a five-second timeout. A valid saved quote may be reused for up to seven days after retrieval and is explicitly labeled with its rate date; the cache is per-process and clears on restart. A cold outage returns a controlled 503, never an invented conversion. Estimates never alter sales prices or totals.

## Scope and honest limitations

This is the approved **midterm scope**, not an accounting or payment system. It excludes payments, tax calculations, purchase fulfillment, hardware/barcodes, multiple branches, uploads and advanced analytics. Currency estimates exclude bank fees. Stock value on the overview uses current selling prices, not accounting cost. The lists currently load all active products/orders; the stock log displays the latest 500. Server pagination, formal load testing, distributed FX caching, password recovery/email invitations, MFA and production deployment remain future work. Account creation currently uses an initial password shared privately by the administrator.

The original rubric is a four-page PDF referenced in the linked ChatGPT chat; `sources/` was empty in this workspace. Requirements were checked against the available PDF attachment and the retrieved StockFlow proposal. This repository supplies technical artifacts and test evidence, but does **not** invent instructor approval, team names, GitHub contributions, oral-defense evidence or an earned rubric score. The team must supply those honestly and disclose AI assistance according to instructor policy.

Startup now reuses frontend dependencies when package-lock.json is unchanged. Use Start.ps1 -Reinstall to force a clean installation. Stop.ps1 also closes orphaned Vite/esbuild processes belonging to this checkout, preventing Windows file-lock errors during installation.
