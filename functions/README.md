# Redcover Headquarters backend

This folder contains privileged Cloud Functions. Admin SDK credentials stay on the server; do not import these files from the browser app.

## Provisioning the first owner

Use a trusted operator workstation with Google Application Default Credentials for the `red-cover` project and IAM permission to manage Firebase Authentication custom claims. Install this package's dependencies, then run `npm run provision-owner`. The script only provisions the verified `engeeo.io@gmail.com` account. The account holder must sign out and back in to refresh claims.

Never deploy a service-account key or Admin SDK credential with the frontend.

## Deploy

Install dependencies in this directory, then from the repository root deploy `firebase deploy --only functions,firestore`. Confirm the selected Firestore database is `ai-studio-redcover-ec164fd1-8554-4ddc-a224-0e1a0561d823` and the default region is `us-central1` before deploying.

The `redcoverRegistrationGate` function is an Identity Platform `beforeUserCreated` blocking trigger. Enable Firebase Authentication with Google as the only provider, upgrade the project to Identity Platform / Blaze as required by the trigger, and grant the deployer permission to create blocking functions. After deployment, verify the trigger is attached in Authentication settings. If the trigger is unavailable, the app can display the registration setting but cannot enforce it for new accounts; Google-only provider enforcement remains an Authentication Console setting.

The scheduled `hqScheduledHealthCheck` requires the Cloud Scheduler API and a billing-enabled Firebase project. Until its first successful run, Headquarters reports scheduled checks as unknown. Deploying functions does not provision the first owner claim: run `npm run provision-owner` from this directory with trusted Application Default Credentials, then sign out and back in as the owner.

The overview uses Firestore count queries and live Auth, Storage and RTDB probes. Billing, App Check, Cloudflare analytics, traffic analytics and active-user aggregates are returned as unavailable until their respective integrations are configured; the UI must preserve that distinction.

Client diagnostic events are rate limited and omit private message contents, credentials, download tokens and arbitrary client-supplied user IDs. Review retention and access policy for `hqEvents` and `hqAuditLogs` before production use.
