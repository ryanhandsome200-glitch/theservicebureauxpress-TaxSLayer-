# Backend contract

XpressTax’s browser talks to a separately deployed API. This repository has no `/api` directory and no database. The client is `api-client.js` and `repository.js`.

## Modes

`browserBackendOptions()` chooses the mode:

- `development-sandbox` when `VITE_DATA_MODE` is not `production` and `VITE_API_BASE_URL` is empty. Accounts and returns live in memory for that Node or browser process. This is the mode used by `npm run dev` and the Playwright server.
- `development-api` when a public API URL is set and the data mode is not `production`. Register, login, returns, checkout, filing, and tickets are sent to that URL with `credentials: 'include'`. If the network fails, nothing is written to memory.
- `production` without an API URL returns `CONFIG` and stores nothing.

`VITE_` values are public. They must not contain secrets.

## Session

The API is expected to set an `HttpOnly`, `Secure`, `SameSite` session cookie. The browser sends `credentials: 'include'` and an `Idempotency-Key` on filing. Login JSON must include a user object the client can parse:

```json
{ "ok": true, "user": { "id": "…", "email": "…", "role": "taxpayer", "name": "…", "emailVerified": true } }
```

Allowed roles are `taxpayer`, `support`, `admin`, and `rules_admin`. Any other role is rejected.

## Routes the client calls

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/v1/auth/register` | Create an account. Do not return a session until email is verified by the provider. |
| POST | `/v1/auth/verify-email` | Confirm the verification code. |
| POST | `/v1/auth/login` | Password and optional TOTP. Rate-limit failures. |
| POST | `/v1/auth/logout` | Revoke the cookie. |
| POST | `/v1/auth/forgot-password` | Start a reset. Do not reveal whether the email exists. |
| POST | `/v1/auth/reset-password` | Set a new password and revoke sessions. |
| POST | `/v1/auth/mfa` | Enroll TOTP. |
| DELETE | `/v1/auth/mfa` | Turn off TOTP after a valid code. |
| PUT | `/v1/profile` | Update the display name. |
| DELETE | `/v1/profile` | Delete the account and its returns. |
| POST | `/v1/returns` | Create a draft. |
| GET | `/v1/returns/:id` | Load one return owned by the session. |
| PUT | `/v1/returns/:id` | Save a draft. Ignore client attempts to set status `accepted`, `rejected`, `submitted`, or `filed`. |
| POST | `/v1/returns/:id/checkout` | Create a provider checkout. Do not mark it paid from this call. |
| GET | `/v1/returns/:id/payment` | Read payment status from the provider, not from a browser redirect. |
| POST | `/v1/returns/:id/filing` | Submit through an authorized e-file provider. Honor `Idempotency-Key`. |
| POST | `/v1/tickets` | Store a support request. |
| PUT | `/v1/admin/users/:id/role` | Change a role. Admin only. |
| PUT | `/v1/admin/tickets/:id` | Open or close a ticket. |
| PUT | `/v1/admin/flags` | Change a server feature flag. |
| POST | `/v1/assistant/query` | Optional model answer. The client uses it only when `liveModel` is `true`. |

The API must authorize every row by the session user. A taxpayer must not read another taxpayer’s return, document, or ticket. Admin responses must omit full identification numbers and document bytes.

Document upload is not sent from the browser in API mode. The API should accept files through a short-lived, authenticated storage URL, allow only PDF, PNG, and JPEG, and cap the size at 5 MB. Extracted fields stay unapplied until the user confirms them.

## Server environment

Set these on the API host only. Do not prefix them with `VITE_`.

| Variable | Use |
| --- | --- |
| `DATABASE_URL` | Private database connection |
| `SESSION_SECRET` | Cookie signing |
| `STRIPE_SECRET_KEY` | Payment provider secret, if Stripe is the chosen provider |
| `STRIPE_WEBHOOK_SECRET` | Verify payment webhooks |
| `EFILE_PROVIDER_ID` | Authorized transmitter identifier |
| `EFILE_CLIENT_ID` | Transmitter credential |
| `EFILE_CLIENT_SECRET` | Transmitter secret |
| `AI_API_KEY` | Model provider key, if the assistant is enabled |
| `SMTP_URL` | Transactional email |

None of these are set in this repository. Until they are, the sandbox adapters in `filing-adapter.js`, `payment-adapter.js`, `document-adapter.js`, and `assistant.js` stay in force:

- Filing: `submitted: false`, `accepted: false`, `submissionId: null`
- Payment: `paid: false`, `verified: false`, no card data
- Extraction: `applied: false`
- Assistant: local glossary unless the API returns `liveModel: true`
