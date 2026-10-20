# Security

This describes the controls in the repository. It is not a SOC 2 report, an IRS e-file approval, or a penetration test.

## In the application

- Passwords are hashed with PBKDF2-SHA-256. The sandbox default is 20,000 iterations in the browser and 100,000 in `createAuth`. Tests use 1,000.
- Sessions expire after 20 minutes idle or 8 hours absolute. Five failed logins lock the account for 15 minutes.
- Email verification is required before login. In the sandbox the code is shown on screen and the UI says no email was sent.
- Authenticator enrollment uses TOTP (SHA-1, RFC 6238). SMS is not offered.
- Admin bootstrap runs only when `VITE_DEV_ALLOW_ADMIN_BOOTSTRAP=true`, the build is not production, and the email ends in `@xpresstax.demo`. A production build with the flag set refuses to start.
- Return payloads reject `__proto__`, `prototype`, and `constructor`, cap nesting, and strip document bytes on save.
- Users can read only their own returns. Admin lists pass through `redactReturnSummary` and hide keys that look like identification numbers, secrets, or file contents.
- Uploads must be PDF, PNG, or JPEG and at most 5 MB. Bytes are not stored.
- Filing and payment adapters cannot mark a return accepted or an order paid.
- `vercel.json` sets `nosniff`, frame denial, a referrer policy, a permissions policy, HSTS, and a content security policy for the static site.
- Public environment values are scanned for names that look like private keys, database URLs, and service secrets.

## Not done in this repository

- No production identity provider, database, encryption-at-rest configuration, or backup
- No server-side rate limit beyond the sandbox login lock
- No CSRF token. The intended API uses a same-site cookie; the API host must set that cookie and reject cross-site requests
- No dependency upgrade for the audit findings below
- No claim of IRS Authorized e-file Provider status

## Dependency audit

`npm audit` on 20 October 2026 reported 5 vulnerabilities: 3 moderate and 2 critical.

| Package | Severity | Note |
| --- | --- | --- |
| `vitest`, `@vitest/mocker` | Moderate | Path traversal in the test mocker. Dev dependency. Fix is Vitest 5, a major upgrade. |
| `tinypool` | Critical | Prototype-pollution gadget in the Vitest worker pool. Dev dependency. Same major upgrade. |
| `react-router` / `react-router-dom` 6.30 | Moderate | Open redirect via a backslash in `Link` or `useNavigate`, and a constructor injection in SSR hydration. This app uses static routes and does not hydrate on a server. The patched line is React Router 7.18. |

`npm audit fix --force` was not run. The app does not pass user-controlled URLs to `navigate` except `location.state.from`, which the protected route sets from `location.pathname`.

## Operator checklist before production

1. Deploy the API in `BACKEND.md` over HTTPS.
2. Keep secrets in the host’s secret store.
3. Turn admin bootstrap off.
4. Confirm a user cannot request another user’s return id and receive it.
5. Confirm payment status changes only from a verified webhook.
6. Confirm filing status changes only from the transmitter’s response.
7. Review the privacy items in `PRIVACY.md` with counsel.
