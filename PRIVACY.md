# Privacy and retention

This note describes how XpressTax is built. It is not a legal opinion, a privacy-policy filing, or a certification.

## What the sandbox stores

In development sandbox mode, the browser process holds:

- Name, email, password hash, role, and optional authenticator secret
- Return answers, including last-four identification digits if the user types them
- Document name, type, and size. File bytes are not kept
- Support ticket text
- Redacted audit events

A refresh or process restart drops that memory. The application does not write those records to `localStorage` or `sessionStorage`.

Do not type a real Social Security number, bank account, or card number into the sandbox. The taxpayer form asks only for an optional last four digits, and the interface says not to enter a real number.

## What production must do

Production storage belongs in the external database behind the API in `BACKEND.md`. The browser receives session cookies and return JSON for the signed-in user. It must not receive another user’s rows, service credentials, or document bytes in an admin summary.

Before any public launch, a lawyer or privacy counsel should review:

- The in-app privacy and terms pages, which are placeholders
- The lawful basis and notices for tax data
- Retention periods for returns, documents, logs, and backups
- Account deletion, including backups and the e-file archive a transmitter may be required to keep
- Whether an AI provider is allowed to receive tax questions, and which fields must be redacted first
- State and federal rules for tax-preparer data, if the operator becomes a preparer

## Retention in the current build

The sandbox keeps at most five saved versions of a return and twenty activity lines, then drops older copies from memory. There is no backup. Account deletion removes that user’s sandbox returns and sessions.

Production retention is not implemented here. The API should define a retention schedule, encrypt backups, and restrict restore access. This repository does not claim a retention period has been approved.

## Access

| Actor | Intended access |
| --- | --- |
| Taxpayer | Own profile, returns, documents, and tickets |
| Support | Redacted tickets and payment status. Not full identification numbers or document bytes |
| Rules admin | Tax-rule version and feature flags, plus redacted return summaries |
| Admin | User roles, redacted audit, and the same redacted summaries |

The sandbox enforces those roles in `security.js`. The production API must enforce them again in the database. A browser check is not the control.

## Sharing

The sandbox does not send email, SMS, analytics events, or return data to a model provider. Guided help uses a local glossary. If `VITE_API_BASE_URL` is set, a question can be posted to `/v1/assistant/query` with the step id and tax year, not the taxpayer’s identification number. The client ignores a model reply unless the API sets `liveModel: true`, and it never applies that reply to the return.
