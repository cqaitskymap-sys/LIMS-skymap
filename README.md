# SkyMap LIMS

Enterprise pharmaceutical Laboratory Information Management System built with Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, and Firebase.

## Features

- Firebase Authentication with role-based access (Admin, QA, QC, Reviewer, Analyst, Viewer)
- Master data modules (12)
- Sample management with barcode/QR, attachments, analyst assignment
- Testing workflow with results, retest, review, approval, e-signature
- COA / report generation with PDF/Excel/CSV export
- Activity logs and audit trail
- Global search, notifications, dark/light mode, responsive layout

## Setup

1. Install dependencies:

```bash
npm install
```

2. Firebase config is in `.env.local` (already filled from your project keys).

3. In Firebase Console (`lims-skymap`):
   - Enable **Email/Password** authentication
   - Create Firestore database
   - Enable Storage
   - Deploy rules:

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use lims-skymap
npx -y firebase-tools@latest deploy --only firestore:rules,storage
```

4. Create your first user in Firebase Authentication (Email/Password). On first login, an Admin profile is auto-provisioned in `users/{uid}`.

5. Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — start production server
- `npm run lint` — ESLint

## Collections

`users`, `departments`, `laboratories`, `products`, `customers`, `materials`, `sampleTypes`, `storageConditions`, `units`, `methods`, `instruments`, `specifications`, `testMasters`, `samples`, `tests`, `reports`, `activities`, `auditTrail`, `notifications`, `counters`
