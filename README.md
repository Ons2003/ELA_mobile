
Restore or remove the missing Blog import and fix JoinForm’s undefined onNavigate to keep builds green.*

Decide on a single enrollment submission pathway (edge wrapper vs direct fetch) and replace alert usage with inline notices for consistency.
->Unification work is done in src/components/EnrollmentModal.tsx:33-103. The modal now submits exclusively through enrollmentsAPI.create, clears old direct fetch usage, and removes the redundant handleSubmitOld path. Error handling feeds into the existing inline banner; on success we keep the modal’s success screen and auto-close timer without using alert.

I didn’t rerun the build—worth doing cmd /c npm run build or npm run dev to confirm everything still compiles.
-> Refactored the athlete dashboard to lift data-handling out of the component: added src/hooks/useDashboardData.ts and rewired src/components/Dashboard.tsx to consume it, pushing the heavy Supabase fetch/transform logic and calendar derivations into a testable hook. While doing that, I extracted the event modal into its own helper inside the component so UI concerns are isolated, and kept Tailwind structure intact. Production build (cmd /c npm run build) passes.

Next steps: repeat this pattern for AdminDashboard.tsx (a dedicated hook plus smaller tab components) and split the strength-assessment flows into a hook plus form/result subcomponents so they’re easier to test.
->Extracted the admin dashboard’s data/logic into src/hooks/useAdminDashboard.ts, mirroring the athlete dashboard refactor. The hook now owns all Supabase queries, filtering, stats, and admin actions (approve/delete/update enrollments, user detail fetch, sign out) and exposes them back to the component. src/components/AdminDashboard.tsx now just consumes that hook, keeping the JSX but dropping the bulky state/effect blocks. Production build (cmd /c npm run build) passes.

If you want to finish cleaning up, you could wire an actual “Add Program” modal to the new hook or port other admin tools (broadcasts, exports) into smaller subcomponents.

Break down the dashboards and strength assessment into smaller hooks/components to improve maintainability and testing.

Review Supabase edge functions for real email delivery (send-credentials) and ensure environment secrets are configured across environments before deploying

## Security configuration

Copy `.env.example` to `.env` and provide project-specific values:

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` for Supabase connectivity
- `VITE_ADMIN_EMAIL` to lock down the admin console to a single account
- `ALLOWED_ORIGINS` to keep the Edge Functions CORS allow-list strict

## Web app (Vite)

Setup:
- Ensure `.env` includes `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Install dependencies: `cmd /c npm install`

Run:
- `cmd /c npm run dev`
- `cmd /c npm run build`
- `cmd /c npm run preview`

## Mobile app (Capacitor)

Prereqs:
- Build the web bundle: `cmd /c npm run build`
- If you still have the Expo `android/` folder, rename or remove it before adding Capacitor.

Initialize:
- `cmd /c npx cap add android`
- `cmd /c npx cap add ios`

Sync + open:
- `cmd /c npm run cap:sync`
- `cmd /c npm run cap:open:android`
- `cmd /c npm run cap:open:ios`
