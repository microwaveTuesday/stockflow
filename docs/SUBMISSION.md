# Demo and submission guide

## 13–17 minute demonstration

1. **Problem and users (1–2 min):** explain a small retailer's notebooks, stock errors and supplier cost uncertainty. Show the three roles and practical scope boundaries.
2. **Design (2 min):** open DESIGN.md architecture and ERD. Explain normalized categories/suppliers/customer records, historical item snapshots and audited stock changes.
3. **Complete workflow (4–6 min):** Admin creates a product and customer. Inventory receives 10 units with a reason. Sales creates a two-unit draft, reviews and confirms. Stock falls from 10 to 8 and a movement references the order. Refresh and query PostgreSQL to demonstrate persistence. Cancel and show stock returns to 10 only once.
4. **Security, validation, failures (2–3 min):** in Swagger, log in with Sales and show a 403 stock change, then show negative-quantity server rejection. Explain that hiding buttons is only usability, not authorization. Show current currency data or honestly identify a provider outage; use offline configuration for the failure case and confirm inventory still works. Show the automated concurrent-order test.
5. **Collaboration (2 min):** show actual issues, pull requests, review comments, commits and each member's work. Never present generated scaffolding or this document as evidence of team participation.
6. **Limitations and continuity (1–2 min):** no payments/tax/POS, current list scaling limits, per-process FX cache, future hosting/reports/uploads. Every teammate answers a code/design question.

## Defense prompts

- Where does a React button produce an Axios request, and what controller/service/data action follows?
- Why does a transaction alone not prevent two orders overselling? What condition does the database update check?
- Why lock the order before confirmation/cancellation? Why process product IDs in a fixed order?
- Why can a draft be edited but a confirmed order cannot? When do prices become snapshots?
- How does Identity store passwords? How do role and password changes revoke old sessions?
- How does the custom request header with same-origin/no-CORS permissions prevent cross-site form submission?
- What is displayed if the external API times out with a saved rate? Without one? Why is there a rate date?
- Which constraints are enforced in PostgreSQL and which rules are enforced by services?
- What did you personally implement/review/test, and what assistance did you use?

## Submission checklist

- Working source, committed migrations, lockfiles, README and configuration guidance.
- Requirements/scope, four diagrams, API contract and documented failure behavior.
- Verified test output with environment/date and clear limits.
- Shared GitHub URL with genuine team history; real team names and instructor approval.
- Screenshots from the actual database-backed application.
- Demo recording/presentation and individual defense as required by instructor.
- Remove local settings, cookies, database dumps, build outputs and passwords from any submission archive.
- Disclose AI assistance according to institutional policy. Students remain responsible for verifying and understanding the result.

## Actual work log (team fills in)

| Date | Member | Issue / PR | Implemented or reviewed | Evidence / test |
|---|---|---|---|---|

No names, approvals or contributions have been fabricated. This implementation was AI-assisted in Codex. Team adaptation, review, testing and disclosure are required before presenting it as the team's work.
