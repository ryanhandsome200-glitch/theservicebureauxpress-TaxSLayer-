# Implementation status

Updated 20 October 2026 from commands run in this workspace. This is not a claim that the product is ready to file real returns.

## Completed

- Original XpressTax brand, public pages, and responsive layout
- Flat root Vite + React app, `vercel.json` SPA rewrite, `.env.example`, `.gitignore`
- Development sandbox accounts: register, verify, login, logout, password reset, TOTP, session idle and absolute expiry, login lock, protected routes
- Taxpayer dashboard driven by the signed-in user’s in-memory returns and the calculated completion ratio
- 22-step wizard with validation, save, back, and step jump
- Income types for W-2, 1099-NEC, 1099-MISC, 1099-INT, 1099-DIV, 1099-R, Schedule C, Schedule E, capital gains, unemployment, Social Security, and other income
- 2025 calculation engine with a versioned rule registry, federal form summaries, and full-year California and Illinois estimates
- Review findings that block submission while errors remain
- Sandbox checkout that stays unpaid, and sandbox filing that stays unsent
- Local glossary assistant that cannot change the return
- Role-gated admin summaries with redaction
- Document type and size checks. Extraction reports unavailable and applies nothing
- Unit, workflow, security, and Playwright tests

## Partial

- Tax rules. Brackets and the main 2025 parameters are sourced. Education credits, additional Medicare tax, NIIT, California conformity, and the Illinois dependent exemption are marked partial in `tax-rules.js`.
- Federal forms. The form set is an unofficial calculated summary, not a fileable IRS form.
- State module. California and Illinois full-year only. Every other state is blocked unless the user limits the return to federal.
- API client. Auth, returns, checkout, filing, tickets, and admin writes call `VITE_API_BASE_URL` when it is set, and they do not fall back to memory. List screens stay empty in that mode because the browser does not cache returns. No API is deployed.
- Payments, e-file, email, SMS, and OCR. Adapters exist and refuse to invent success.
- AI help. Local glossary only, unless a future API returns `liveModel: true`.

## Not implemented

- A hosted database, identity provider, or file store
- An authorized IRS e-file transmitter integration
- A payment-provider checkout whose webhook marks an order paid
- Email or SMS delivery
- OCR that fills a return
- All 50 states, part-year and nonresident returns, Form 1040-NR, estates and trusts, AMT, premium tax credit, dependent care credit, saver’s credit, and collectibles at 28%
- Official PDF forms

## Tests executed

| Command | Result |
| --- | --- |
| `npm ci` | Exit 0. 370 packages added. The first attempt failed with Windows `EBUSY` while removing `node_modules`; the retry succeeded |
| `npm run lint` | Exit 0 after the final source edits |
| `npm test` | 4 files, 33 tests, all passed |
| `npm run build` | Passed after the final source edit. JS 300.48 kB (gzip 95.08 kB), CSS 5.72 kB |
| `npm run check:flat` | Passed. Root-only check passed |
| `npx playwright test` | 3 passed (home through sandbox filing and logout, unknown route, 1280/800/390 widths) |
| `npm audit` | 5 vulnerabilities (3 moderate, 2 critical). Not force-fixed. See `SECURITY.md` |

`npm test` was run again after `npm ci` and passed, 33 tests.

## External dependencies

None of these are configured: database, identity provider, Stripe or another processor, e-file transmitter, email, SMS, OCR, model API.

## Security limitations

Sandbox memory is not durable and is not a production control. See `SECURITY.md`. No certification is claimed.

## Tax-rule verification

Version `ty2025-rp2024-40-rp2025-32`, reviewed 2026-10-20, overall status **partial**. Verified items and partial items are the `verification` object in `tax-rules.js`.

## Deployment

GitHub push: not done. Vercel deployment: not done. `vercel.json` is ready for a root-directory import.
