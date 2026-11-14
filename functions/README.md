# Redcover Headquarters backend

This folder contains privileged Cloud Functions. Admin SDK credentials stay on the server; do not import these files from the browser app.

## Provisioning the first owner

Use a trusted operator workstation with Google Application Default Credentials for the `red-cover` project and IAM permission to manage Firebase Authentication custom claims. Install this package's dependencies, then run `npm run provision-owner`. The script only provisions the verified `engeeo.io@gmail.com` account. The account holder must sign out and back in to refresh claims.

Never deploy a service-account key or Admin SDK credential with the frontend.

## Deploy

Install dependencies in this directory, then from the repository root deploy `firebase deploy --only functions,firestore`. Confirm the selected Firestore database is `ai-studio-redcover-ec164fd1-8554-4ddc-a224-0e1a0561d823` and the default region is `us-central1` before deploying.

The `redcoverRegistrationGate` function is an Identity Platform `beforeUserCreated` blocking trigger. Enable Firebase Authentication with Google as the only provider, upgrade the project to Identity Platform / Blaze as required by the trigger, and grant the deployer permission to create blocking functions. After deployment, verify the trigger is attached in Authentication settings. If the trigger is unavailable, the app can display the registration setting but cannot enforce it for new accounts; Google-only provider enforcement remains an Authentication Console setting.

## Bot and cost protection

All callable functions require Firebase App Check and are capped at 10 instances globally. The web app initializes App Check with reCAPTCHA Enterprise when `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` is set. Create a reCAPTCHA Enterprise site key for the production domain, register its matching secret in Firebase Console > App Check, and provide the public site key as a hosting build variable. Never put the secret in `.env`, frontend code, or source control.

Before enabling enforcement for Firestore and Storage, register the Firebase web app under App Check, deploy the client, and inspect App Check request metrics for legitimate traffic. Then enable enforcement for Cloud Firestore, Cloud Storage, and Realtime Database in App Check. Callable Cloud Functions enforcement is already enabled in this code. Contact form submissions also have a server-side limit of 5 per IP per hour. The 10-instance cap limits runaway function scaling; it does not guarantee a fixed maximum bill.

The scheduled `hqScheduledHealthCheck` requires the Cloud Scheduler API and a billing-enabled Firebase project. Until its first successful run, Headquarters reports scheduled checks as unknown. Deploying functions does not provision the first owner claim: run `npm run provision-owner` from this directory with trusted Application Default Credentials, then sign out and back in as the owner.

The overview uses Firestore count queries and live Auth, Storage and RTDB probes. Billing, App Check, Cloudflare analytics, traffic analytics and active-user aggregates are returned as unavailable until their respective integrations are configured; the UI must preserve that distinction.

## Private PDF and chat attachment access

`getBookPdfAccess` resolves a PDF from the Firestore book record after checking Firebase Authentication, account status, book publication state, and owner/admin access for unpublished books. `getChatAttachmentAccess` checks current direct-chat participants or group membership and derives the attachment object only from the stored message. Both return a 15-minute V4 signed read URL for PDF.js/media rendering. The frontend never supplies an arbitrary object path to these functions. The function runtime service account needs `storage.objects.get` and permission to sign blobs (for example, `roles/iam.serviceAccountTokenCreator` on its own service account); deploy the Functions code and verify this IAM setup before enabling the reader flow.

PDF.js also needs the bucket's CORS policy to permit `GET` from `https://redcover.app` (and the www host). `storage-cors.json` is a separate Cloud Storage bucket setting; `firebase deploy --only storage` does not apply it. After review, apply it with `gcloud storage buckets update gs://red-cover.firebasestorage.app --cors-file=storage-cors.json` and verify the bucket CORS configuration.

## Legacy Storage inventory and migration

With trusted Application Default Credentials for the configured Firebase project, run `npm run storage:report -- ./storage-inventory.json` from this directory. This is read-only and scans books/users in both the named and default Firestore databases, plus direct/group chat records in the named database; it reports record IDs, paths, object existence, reference kind, and proposed action. URL token values are omitted from the report.

Only after reviewing that report, `npm run storage:migrate` updates PDF/chat references to raw object paths and rotates old Firebase download tokens for those private objects. It preserves the objects and records prior references/tokens in the server-only `_storageMigrationLedger` collection; Firestore's default-deny rule blocks all client access to that ledger. The operation is idempotent and resumes prepared entries. `npm run storage:rollback` restores prior references and tokens, and stops on changed references rather than overwriting newer edits. Cover and profile references are inventoried but left unchanged. These commands mutate production data if ADC points at production: verify `gcloud config get-value project` / `firebase use` and review the report first. Never export, log, or expose ledger contents.

Client diagnostic events are rate limited and omit private message contents, credentials, download tokens and arbitrary client-supplied user IDs. Review retention and access policy for `hqEvents` and `hqAuditLogs` before production use.
