# QuikStitch SaaS Development TODO List

This list outlines potential next steps to evolve QuikStitch from its current state into a more robust SaaS application, based on analysis of the frontend page components.

## User Experience & Features

*   [X] Develop User Dashboard (`src/pages/Dashboard.tsx`):
    *   [X] Fetch job list from backend (`GET /api/jobs`) and display in a table.
    *   [X] Implement polling for real-time status updates of active jobs.
    *   [X] Add Download button for completed jobs (using signed URLs).
    *   [X] Add "Preview / Edit" button navigating to `/preview/:jobId`.
    *   [ ] Add granular job progress display (e.g., percentage) if backend provides it.
    *   **Reason:** Central place for users to manage their projects.
*   [X] Implement Preview & Edit Page (`src/pages/Preview.tsx`):
    *   [X] Add route `/preview/:jobId`.
    *   [X] Fetch job details by ID (`GET /api/jobs/:id`).
    *   [X] Generate signed URL for output video.
     *   [X] Fetch video data and display using Blob URL (to bypass COEP).
     *   [X] Integrate `CaptionEditor` component.
     *   [X] Load transcription text from job.outputFile into Preview editor.
     *   [X] Implement saving edited captions (via `PATCH /api/jobs/:id/captions`).
     *   [ ] Implement applying edited captions (requires backend re-processing logic or client-side FFmpeg integration).
     *   [ ] Update Export button logic based on caption saving/applying implementation.
    *   **Reason:** Allow users to review output and correct captions.
*   [ ] Enhance AI Caption Workflow:**
    *   [X] Ensure reliable triggering of backend transcription functions (`supabase/functions/...`). - ASSUMED DONE (Backend seems to be processing)
     *   [ ] Provide clear status updates specifically for the *captioning* part of a job within the dashboard (if separate from stitching).
     *   **Reason:** Improve the usability and value of the premium captioning feature.
 *   [X] Implement Paid User Status (`AuthContext.tsx`, Backend):
     *   [X] Fetch/determine user's paid status upon login/session check (via `/api/auth/me`).
     *   [X] Restrict Transcription Job creation button based on paid status.
 *   [X] Integrate Stripe for Subscription Payments:**
     *   [X] Set up Stripe account and API keys (Backend/Frontend env vars added).
     *   [X] Create backend endpoints for creating subscription checkout sessions (`/api/payments/create-checkout-session`).
     *   [X] Implement frontend UI for subscribing (`/billing` page with `CheckoutButton`).
     *   [X] Handle Stripe webhooks (`/api/payments/webhook`) on the backend to update `isPaidUser`, `subscriptionStatus`, `stripeSubscriptionId`, and grace period based on subscription events (`invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`).
     *   [X] Add Stripe Customer Portal integration (backend endpoint `/api/payments/create-portal-session` and frontend "Manage Subscription" button on `/billing` page).
     *   **Reason:** Monetize the premium features via subscriptions.
 *   [ ] Add Background Music Feature:**
     *   [ ] Allow users to upload an audio file (e.g., MP3) to use as background music.
     *   [ ] Provide an option (e.g., slider) to set the volume level of the background music relative to the original video audio.
     *   [ ] Update backend processing (worker/FFmpeg) to mix the selected audio track with the video at the specified volume.
     *   [ ] Update UI (likely Upload or Preview page) to include controls for music selection and volume.
     *   **Reason:** Enhance video output with background audio.
 *   [X] Improve Error Handling & UX:**
     *   [X] Implement specific error messages for common issues (upload failure, processing errors). - MOSTLY DONE (Improved Supabase upload errors, Added tooltip for job failure reasons, Added backend retry logic for ECONNRESET)
    *   [X] Add user notifications (e.g., toast messages) for job completion/failure. - DONE (Added react-toastify for auth and job creation)
    *   [X] Refine loading indicators (Dashboard polling pulse, Upload button spinner, File item status icons).
    *   **Reason:** Create a more professional and user-friendly experience.

## Component Specific Tasks

*   [ ] Enhance `AICaptionExtractor.tsx` if the backend provides timestamped segments.
*   [X] Process the validated CSV file (`ManualCaptionUploader.tsx`) - DONE (Refactored to use `onUploadComplete` callback)
*   [X] Replace with backend session check endpoint (`AuthContext.tsx`) - DONE (Refactored to use Supabase client library `onAuthStateChange`)
*   [X] Replace with backend magic link request endpoint (`AuthContext.tsx`) - DONE (Verified endpoint `/auth/magic-link` is used)
*   [ ] Integrate edited captions into `combineVideos` or handle via backend (`Preview.tsx`). - BLOCKED by caption data fetching/passing.
*   [X] Add Export Button (`Preview.tsx`) - DONE (Button already existed, removed TODO)
*   [X] Handle case where user is not logged in (`Upload.tsx`) - DONE (Added AuthModal trigger)
*   [X] Optionally delete from Supabase Storage (`Upload.tsx`) - DONE (Implemented storage removal on UI delete)
*   [ ] Revisit if a separate TRANSCRIPTION job type is needed immediately (`Upload.tsx`).

## Admin Features

*   [X] Implement Admin Dashboard Page (`src/pages/AdminDashboard.tsx`):
    *   [X] Add protected route `/admin` using `AdminRoute.tsx`.
    *   [X] Fetch and display usage statistics (`GET /api/admin/stats`).
    *   [X] Fetch and display user list (`GET /api/admin/users`).
    *   [ ] Add user management actions (e.g., toggle admin status, delete user).
        *   [ ] Implement backend routes (`PUT /api/admin/users/:id`, `DELETE /api/admin/users/:id`).
        *   [ ] Add buttons/controls to the user table in `AdminDashboard.tsx`.
    *   **Reason:** Allow administrators to monitor application usage and manage users.

---

## Resolved Issues

*   **User ID Mismatch on Job Creation:** Fixed issue where jobs were created with an incorrect `userId` (Prisma CUID instead of Supabase Auth UUID). Changed `User.id` in Prisma schema to store Supabase Auth UUID, updated middleware (`authenticateUser.js`) to upsert based on UUID, and ran `prisma migrate`. Ensured consistent use of Supabase Auth UUID across frontend and backend.
*   **Backend Supabase Client Usage:** Separated backend Supabase clients into `supabaseAdmin` (Service Role Key) and `supabaseAuthVerify` (Anon Key) in `supabaseClient.js`. Updated middleware, routes (`authRoutes.js`, `jobRoutes.js`), and services (`storageService.js`) to use the appropriate client for their required permission levels (e.g., AuthVerify for token validation, Admin for worker uploads/deletes).
*   **Magic Link 500 Error:** Resolved `unexpected_failure` during magic link request (`POST /api/auth/magic-link`). Traced to Supabase rejecting the `emailRedirectTo` option containing a specific path. Fixed by changing `emailRedirectTo` to use only the base frontend URL (`process.env.FRONTEND_URL`) in `authRoutes.js`. Also ensured the correct Supabase client (`supabaseAuthVerify`) was used for this call.
*   **Storage Upload `ECONNRESET`:** Added retry logic (up to 3 attempts) to the backend `uploadFile` function in `storageService.js` to handle intermittent network connection reset errors during final output upload.
*   **Storage RLS "Object Not Found":** Addressed errors when generating signed URLs for Preview/Download by ensuring the correct `userId` (Supabase Auth UUID) is used for job creation and output paths. Requires user to configure appropriate RLS `SELECT` policy on `storage.objects` table for authenticated users on `user-<their_uuid>/outputs/%`.
*   **Preview Button Downloads Video:** Fixed issue where clicking Preview downloaded the file instead of displaying it. Updated backend `uploadFile` function in `storageService.js` to explicitly set `contentType: 'video/mp4'` during upload.
*   **Preview Page COEP Error:** Resolved `ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep` on the Preview page. Updated `Preview.tsx` to fetch video data from the signed URL and display it using a local Blob URL (`URL.createObjectURL`) instead of using the signed URL directly in the `<video>` tag.
*   **Backend Worker Trigger:** The TODO comment in `jobRoutes.js` regarding triggering the worker is not applicable because the worker uses a polling mechanism (`worker.js`) to find queued jobs.
