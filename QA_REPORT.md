# QA report

Date: 20 October 2026. Brand under test: XpressTax. Tax year: 2025.

Severity: P0 security, data loss, or tax integrity. P1 core workflow. P2 important gap. P3 minor.

## Summary

Locally testable workflows pass after the fixes below. The application is not release-ready for real filing because the production API, payment provider, and e-file transmitter are not configured. Those are external blockers, not passing tests.

## Results

| Requirement | Test | Expected | Actual | Status | Severity | Fix | Regression | Blocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2025 single tax table | `tests.tax-engine.test.js` wages 60000 | Taxable income 44250, tax 5075, due 75 | Matched | Pass | — | — | Same test | None |
| Worksheet vs table boundary | Same file, 100000 and 99950 | Worksheet 16914, table 99950 tax 16909 | Matched | Pass | — | — | Same test | None |
| Age-65 standard deduction | Same file | Unmarried additional amount applies | First run threw `Invalid dollar amount` because a missing blind flag became `NaN` | Pass | P0, fixed | Count age and blindness with explicit 1/0 flags | Same test | None |
| QBI below the threshold | Same file, Schedule C 40000 | Half of SE tax 2826, QBI 4285, taxable income 17139 | First expectation used 283. The engine’s 2826 matches 40000 × 0.9235 | Pass | P1, test corrected | Expectation updated. Engine left as calculated | Same test | QBI above the wage limit is not invented |
| SALT, SE tax, EITC, CTC/ACTC, student loan, capital loss, collectibles block, IL, CA, unsupported state | Same file, 18 tests | Official or sourced expected dollars, or a blocker | All passed on the rerun | Pass | — | CTC phaseout subtracts $50 per step | Same file | Partial items listed in `tax-rules.js` |
| Step and return validation | `tests.validation.test.js` 4 tests | Errors block submit. Signature must match the taxpayer | Passed | Pass | — | — | Same file | None |
| Session lock and idle expiry | `tests.workflows.test.js` | Lock after repeated failures. Idle session ends | Passed | Pass | — | — | Same test | None |
| Save, edit, recalculate | Same file, withholding 8000 | Refund 2925. No browser storage | Passed | Pass | — | — | Same test | Sandbox memory is lost on refresh |
| Isolation and redaction | Same file | Other user cannot read the return. Admin summary hides the TIN | Passed | Pass | — | — | Same test | Production API must enforce this again |
| Sandbox filing and payment | Same file | `submitted` false, `accepted` false, id null, unpaid, idempotent retry | Passed | Pass | — | — | Same test | No transmitter or processor |
| API must not fall back to memory | Same file, plus create-return after a failed fetch | `NETWORK` or `CONFIG`. User count 0. Return count 0 | Passed | Pass | P1, fixed | Remote reads and writes no longer use the memory maps | Same test | API itself is not deployed |
| TOTP RFC 6238 | `tests.security.test.js` secret at T=59 | Code 287082 | First run failed because `SubtleCrypto.sign` rejected the buffer in jsdom | Pass | P1, fixed | Sign a `Uint8Array`. Tests use Node webcrypto | Same test | None |
| MFA login | Workflows test | Missing code fails. Current code succeeds | Passed after the TOTP fix | Pass | — | Same TOTP fix | Same test | None |
| Public env secrets | Security test | Private-looking `VITE_` values are rejected | Passed | Pass | — | — | Same test | None |
| Clean install | `npm ci` | Lockfile installs | Exit 0, 370 packages. First attempt failed with Windows `EBUSY` while deleting `node_modules`; the retry succeeded. `npm test` then passed again, 33 tests | Pass | — | Retried after the lock cleared | `npm ci` | None |
| Lint | `npx eslint .` | Exit 0 | Exit 0. JSX identifiers are marked used via `react/jsx-uses-vars` | Pass | P2, fixed | ESLint rule and unused document-byte bindings renamed | Lint script | None |
| Production build | `npx vite build` | `dist/` emitted | JS 300.48 kB (gzip 95.08 kB), CSS 5.72 kB, after the final source edit | Pass | — | — | `npm run build` | None |
| Flat root | `node check-flat.js` | No project directories | “Root-only check passed.” | Pass | — | — | `npm run check:flat` | None |
| End-to-end filing path | `e2e.spec.js` public pages, a return, and logout | Signup, verify, wizard, unpaid checkout, “was not sent”, logout, dashboard blocked | Passed in 4.4s on the last run | Pass | P1, fixed | Step count included Fees. Labels no longer wrap selects, so “State” and “Filing status” are unique. Continue stays disabled while the step has errors | `npx playwright test` | Sandbox only |
| Unknown route | Same file | Helpful not-found heading | Passed | Pass | — | — | Same test | None |
| Responsive widths | Same file, 1280, 800, 390 | Horizontal overflow ≤ 1px. Mobile menu opens Help | Passed | Pass | P3, fixed | Header and nav wrap | Same test | Color contrast was not measured with an automated contrast tool |
| Dependency audit | `npm audit` | No unreviewed critical findings | 5 findings: Vitest path traversal, tinypool prototype pollution, React Router open redirect and SSR constructor injection | Fail | P2 open | Not force-upgraded. Router finding does not match this SPA’s static links. Vitest findings are dev-only | Re-run `npm audit` after an upgrade | Major upgrades not applied |
| GitHub and Vercel | Not run | A real push and a live URL | Not performed | Not run | External | — | — | No remote publish from this workspace |

## Defects fixed in this cycle

1. Additional standard deduction crashed when blindness was unset.
2. Child tax credit phaseout added the reduction instead of subtracting it. Corrected before the passing run.
3. TOTP signing failed under jsdom. Node webcrypto plus a `Uint8Array` counter matches the RFC vector.
4. ESLint treated JSX components as unused. `react/jsx-uses-vars` is enabled.
5. End-to-end navigation stopped before Fees, and the step menu’s label text collided with “State” and “Filing status”.
6. A configured API could still satisfy some calls from memory. Those paths now stay on the API or return a clear unavailable error.

## Open items

- P2: dependency advisories above. No safe non-major fix was applied.
- P2: tax engine remains partial for the items marked in `tax-rules.js`. Returns with those facts are blocked or disclosed, not silently completed.
- P2: dashboard and admin lists do not render API data. They stay empty so the browser does not cache returns. The write calls are proxied.
- External: identity provider, database, email, payments, e-file, OCR, and a live model are not configured. The UI does not claim those actions succeeded.

No open P0 or P1 defect remains in the sandbox paths covered by the tests above. The product is still not release-ready.
