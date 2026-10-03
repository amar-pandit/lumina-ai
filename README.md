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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
