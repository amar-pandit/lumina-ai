This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Demo authentication

Demo credentials are verified by the server. Authenticated sessions use a signed, HttpOnly cookie; browser localStorage is not used to grant a role. Configure `LUMINA_AUTH_SECRET` with at least 32 random bytes in production. Development uses a temporary process-local key, so restarting the development server invalidates existing sessions.

## Demo authentication

Email & Password remains available as a fallback. After a successful password login, a user without a face identity can register Face ID. Returning Face ID login opens the webcam and compares three browser-generated face descriptors against encrypted server-side enrollment data; the matched immutable account ID determines the signed, HttpOnly session and role-specific dashboard. HOD and Admin remain distinct roles.

Face detection and recognition run locally in the browser using the MIT-licensed `@vladmandic/face-api` models stored in `public/face-models`. Live images are not uploaded or retained. The three 128-number face descriptors are biometric data: the server encrypts them with AES-256-GCM in `.data/face-identities.json`; `.data/face-encryption.key` is used only for local development. In production, set `LUMINA_AUTH_SECRET` to at least 32 random bytes and use persistent, private server storage for `.data`. The face endpoints require HTTPS in production, and the face identity API never returns stored descriptors.

Face ID captures three live descriptors and performs identity matching with a confidence threshold, rejecting close competing matches. Browser-based face matching cannot reliably distinguish a live person from a photo/video spoof; it is not a certified or spoof-proof biometric authenticator and should not be used as the sole factor for sensitive production accounts without a vetted liveness/anti-spoofing system. Users can always choose Email & Password instead. Demo credentials are defined in `lib/auth/demo-account-credentials.ts`.

## PDF reports

Faculty tools export attendance, gradebook, curriculum, remedial, intervention, and dashboard reports from the current `lumina-demo-state`. The Mentor dashboard and shared Mentor tools produce mentee-scoped reports; the HOD workspace exports department summary, risk, and accreditation reports; Admin pages export institution summary, attendance, risk, department comparison, escalation, accreditation, and simulated parent-gateway reports. HOD and Admin report access is independently checked against the signed server session.

PDFs are generated as portrait A4 documents with tables, repeating headers, fixed page footers, pagination, and an in-app preview. Saved history stores only user-scoped report metadata in browser localStorage; it does not copy report rows. History actions rebuild a PDF from the currently available shared demo data. Current page filters are included in report metadata and affect the export where the page supplies filtered rows. Since the existing demo state is browser-local, report generation and report history use the same browser-local storage context.

## Academic email alert engine

Gmail SMTP delivery is implemented server-side in `lib/email-service.ts`; it is not imported by React components. Configure these variables in the server environment:

```dotenv
EMAIL_FROM=ap3083222@gmail.com
HOD_EMAIL=amarkumarpandit263@gmail.com
MENTOR_EMAIL=amarprajapati564@gmail.com
ADMIN_EMAIL=amar1573@xavier.edu.np
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=465
EMAIL_SMTP_USER=ap3083222@gmail.com
EMAIL_SMTP_PASSWORD=YOUR_GMAIL_APP_PASSWORD
```

Use a Gmail App Password (with Google 2-Step Verification enabled), not the account password. Keep local environment files private; SMTP credentials must never use a `NEXT_PUBLIC_` name. `POST /api/email/test` sends the specified test email only in development and only for the authenticated Admin session. Admin-only `GET /api/email/history` returns status-only history (never SMTP credentials). When PostgreSQL is configured, history is persisted in `EmailHistory`; development without a database uses `.data/academic-email-history.jsonl` as a fallback.

`getRecipientForRole` routes HOD, Mentor, and Admin to their dedicated environment-configured addresses. `sendHourlyDigest` builds distinct department, assigned-student/class, or institution content for HOD, Mentor, and Admin respectively; `sendCriticalAlert` routes immediate alerts through the same mapping. SMTP retries are bounded to three attempts and only retry explicit temporary SMTP (4xx) responses to avoid duplicate delivery on ambiguous network failures.

In development, saving the Faculty demo attendance grid calls `POST /api/email/demo-attendance`. The selected course is scoped to the authenticated Faculty demo assignment; attendance is stored separately per course. Mentor mail contains only attendance statuses and names for the mapped assigned students, HOD mail contains the configured department summary, and Admin mail contains institution and department summaries. Faculty has a course-specific data selector/template but is not an email recipient. The demo has no exam participation source, so leadership email identifies exam data as unavailable rather than inventing records. These demo emails are disabled in production.

## PostgreSQL academic data migration

Prisma with PostgreSQL is the only ORM/database layer. `prisma/schema.prisma` defines users and normalized roles, departments, faculty, mentors and assignments, classes, courses, enrollments, attendance sessions/records and imported attendance baselines, exams/participation, grades, risk snapshots/configuration, interventions, parent follow-ups, notification events, digest snapshots, and email history.

Configure `DATABASE_URL` in `.env.local` or `.env` (the Prisma CLI reads both through `prisma.config.ts`), then run:

```bash
npm run db:generate
npm run db:migrate:dev
npm run db:seed
```

Production deploys should use `npm run db:migrate` and run the same explicit controlled seed only when intended. The seed marks imported roster/account data as demo, maps the HOD to the existing `HOD_DEPARTMENT`, imports the existing demo marks, attendance baseline/statuses, risk-engine snapshots, and interventions, and never copies browser localStorage. No exams or parent follow-ups are seeded because the current app has no canonical source records for them. The current signed-in Mentor has no matching assignment in the demo roster, so the seed does not grant that account unrelated students.

The first authenticated server APIs are `GET /api/students`, `GET|POST /api/attendance`, `GET|POST /api/marks`, `GET|POST /api/exams`, `GET /api/risk`, `GET|POST /api/interventions`, `GET|POST /api/parent-followups`, `GET /api/departments`, `GET /api/notification-events`, and Admin-only `GET /api/email/history`. Authorization uses the signed Lumina session plus matching active database user/role and server-side assignment/department/course relations; request bodies cannot select a role. Attendance/marks writes and the resulting deterministic risk snapshot are transactional. Risk snapshots are calculated by the existing deterministic risk engine from database attendance baselines/events and grades.

This is a staged migration, not yet a completed UI cutover. Existing dashboards still read/write their current browser-local demo state; they have not been switched to the APIs because no `DATABASE_URL` was provided to migrate/verify the database first. The APIs return 503 while database storage is unconfigured. The initial data model for exams and parent follow-ups is ready, but their actual institutional records/schema and imports must be supplied. Real scheduled academic email sending is not activated: there is not yet a database-verified digest scheduler or event dispatcher. Do not enable academic email delivery until database migrations, seed/import, role assignments, API tests, and UI cutover are verified against the target PostgreSQL instance.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
