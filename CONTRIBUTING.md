# Working together

Use one shared GitHub repository with a protected main branch. Create a feature branch for each meaningful task, describe the problem/result and test evidence in a pull request, and ask a teammate to review it. Keep secrets in local configuration and never commit .local, .env, cookies or database dumps. Track real contribution evidence in docs/SUBMISSION.md.

Suggested feature ownership: auth/access, catalog/stock/database, customers/orders, frontend/accessibility, integrations/tests/docs. Everyone should understand and be able to demonstrate the complete browser-to-database flow. Commit substance matters more than count. Do not generate fictional commit authors or backdated team history.

Before review: run backend/frontend builds, currency tests, PostgreSQL acceptance checks and relevant browser tests. Review migrations and authorization for every new route. For stock/order edits, preserve conditional updates, shared transaction boundaries, order locks and idempotent status transitions. A frontend restriction alone never grants or denies backend permissions.
