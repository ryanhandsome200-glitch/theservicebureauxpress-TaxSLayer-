# XpressTax

XpressTax is an independent tax-preparation application for a guided 2025 individual estimate. It is not affiliated with TaxSlayer, any other commercial tax brand, or the IRS.

The working local mode is an explicitly labeled **development sandbox**. It keeps accounts and returns in server memory for the browser tab’s process. It does not write taxpayer records to `localStorage` or `sessionStorage`. A refresh clears that memory. Production mode refuses to store returns unless `VITE_API_BASE_URL` points at a separately deployed API.

Figures in the app are estimates. The sandbox does not transmit a return, accept a return, or collect a card payment.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

```bash
npm ci
npm run dev
```

Open the URL Vite prints, usually `http://127.0.0.1:5173`. You can also double-click `index.html`. That file loads `app.js` from the same folder, so the page is not an empty document. Copy `.env.example` to `.env.local` only if you need to change a public setting. Leave `VITE_API_BASE_URL` empty to use the sandbox.

Useful commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite development server |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit and integration tests |
| `npm run test:e2e` | Playwright, against Vite on port 4173 |
| `npm run build` | Writes `app.js` in the project root |
| `npm run preview` | Serve the production build |
| `npm run check:flat` | Fail if a project subdirectory was added |
| `npm run check` | Lint, unit tests, production build, and the flat-root check |

Playwright needs Chromium once: `npx playwright install chromium`.

## What you can do in the sandbox

- Read the public site, pricing, help, privacy, terms, and security pages.
- Create an account. The verification code is shown on the next screen. No email is sent.
- Sign in, reset a password with a development code, and enroll an authenticator (TOTP). There is no SMS.
- Start a 2025 return and walk the filing steps: people, address, filing status, dependents, income, adjustments, deductions, credits, federal estimate, California or Illinois when supported, review, fees, and authorization.
- See a refund or amount-due estimate that recalculates from saved answers.
- Attach PDF, PNG, or JPEG metadata. Extraction is unavailable and never fills the return.
- Review an unpaid fee summary. The order stays unpaid.
- Run the sandbox filing check. The result says the return was not sent, with no submission ID and no acceptance.
- Open Administration only with a development role. Bootstrap is off unless `VITE_DEV_ALLOW_ADMIN_BOOTSTRAP=true` and the build is not production. The email must end in `@xpresstax.demo`.

## Tax year 2025

Rules are version `ty2025-rp2024-40-rp2025-32`. Sources are listed in `tax-rules.js`. The engine is **partial**:

- Federal brackets, standard deduction, additional standard deduction, EITC parameters, child tax credit, SALT cap, student-loan interest, educator expenses, QBI threshold, self-employment tax, and capital-gain thresholds were checked against the cited IRS and SSA sources.
- Ordinary tax under $100,000 uses the $50 tax-table midpoint. Income of $100,000 or more uses the rate schedule. Long-term capital gain and qualified dividends use a stacking worksheet and skip the tax table.
- Full-year California and Illinois have limited calculations. Other states are not calculated.
- Alternative minimum tax, the premium tax credit, the child and dependent care credit, the saver’s credit, IRA phaseouts, passive-loss allowances, and collectibles at the 28% rate are not calculated. Those situations are blocked or disclosed.
- Illinois dependent exemptions and the education-credit worksheet are only partly verified.

Do not treat the engine as complete for every tax situation.

## Configuration

Public variables live in `.env.example`. Anything starting with `VITE_` is visible in the browser. Never put a database URL, session secret, payment secret, e-file credential, or model API key there.

| Mode | Behavior |
| --- | --- |
| `VITE_DATA_MODE=development` and no API URL | In-memory sandbox |
| `VITE_DATA_MODE=development` and `VITE_API_BASE_URL` set | Calls that API. A network failure does not fall back to memory |
| `VITE_DATA_MODE=production` without an API URL | Storage is refused |
| `VITE_DEV_ALLOW_ADMIN_BOOTSTRAP=true` in a production build | The app refuses to start |

Privileged backend variables are listed in `BACKEND.md`.

## Deploy on Vercel

The repository root is the project. `vercel.json` builds with `npm run build`. On Vercel the publish folder is created for that host and is not kept on this computer. Rewrites send every path to `index.html` so client routes survive a refresh.

1. Push this repository to GitHub.
2. Import the repository in Vercel with the root directory as the project root.
3. Set `VITE_DATA_MODE=production` and `VITE_API_BASE_URL` to the deployed API origin. Leave the admin bootstrap variable unset or `false`.
4. Deploy the API separately. Do not add an `/api` directory to this repository.
5. Confirm the deployed site shows the configuration block when the API URL is missing, and that a sandbox filing message never appears as an IRS acceptance.

This repository has not been deployed from this workspace. A deployment URL is not claimed.

## Project shape

Application source, tests, and docs stay in the repository root. `node_modules/` is the library folder npm creates. `check-flat.js` fails the build check if another project directory appears.

## More detail

- `BACKEND.md` — API contract and server secrets
- `SECURITY.md` — controls and what is not certified
- `PRIVACY.md` — retention and access
- `IMPLEMENTATION_STATUS.md` — what is done, partial, or blocked
- `QA_REPORT.md` — tests that were actually run
