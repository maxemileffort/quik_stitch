# QuikStitch

QuikStitch is a web application designed to simplify the process of combining multiple video clips into a single video, with the option to add captions either automatically using AI or by uploading a manual caption file.

## Core Features

*   **Multi-Video Upload:** Easily upload multiple video files (supports MP4, MOV, WebM).
*   **Intuitive Ordering:** Arrange uploaded video clips in the desired sequence using a simple drag-and-drop interface.
*   **Tiered Access:**
    *   **Free Tier:** Basic video stitching, manual caption upload.
    *   **VIP Tier (Paid Subscription):** Unlocks AI-powered transcription, AI video editing tools (coming soon), faster processing, and priority support.
*   **Flexible Captioning:**
    *   **AI Captions (VIP):** Automatically generate captions from the video's audio content.
    *   **Manual Captions (Free & VIP):** Upload your own captions via a CSV file.
    *   **Skip Option (Free & VIP):** Proceed directly to stitching without adding captions.
*   **Backend Stitching:** Video clips are combined on the backend using FFmpeg via a background worker process.
*   **User Dashboard:** Manage your video processing jobs, view status updates (with polling for active jobs), download completed videos.
*   **Preview & Edit Page:** Access a dedicated page from the dashboard to preview the completed video and edit AI-generated captions (caption editing UI implemented, data loading/saving pending).
*   **Export:** Download the final processed video from the Dashboard or Preview page.
*   **Subscription Billing:** Integrates with Stripe for handling monthly VIP subscriptions via a dedicated Pricing page. Includes a customer portal for managing subscriptions.
*   **Admin Dashboard:** A protected area (`/admin`) accessible only to admin users. Displays usage statistics (users, jobs, subscriptions) and provides basic user management capabilities (viewing user list). (Requires manual setting of `isAdmin` flag in the database for designated users).

## Tech Stack

*   **Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router, React Dropzone, React Beautiful DnD
*   **Backend:** Node.js, Express.js
*   **Database:** PostgreSQL (managed via Prisma ORM)
*   **Authentication:** Supabase Auth
*   **Payments:** Stripe (Subscriptions & Customer Portal)
*   **Background Jobs:** Node.js Worker Threads (for FFmpeg processing)
*   **Video Processing:** FFmpeg (run via backend worker)
*   **(Potentially) Storage:** Supabase Storage (for video files)

## Getting Started

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd quikstitch
    ```
2.  **Setup Backend:**
    *   Navigate to the `backend` directory: `cd backend`
    *   Install dependencies: `npm install`
    *   Create a `.env` file (copy `.env.example` if available). Key variables:
        *   `DATABASE_URL`: Your PostgreSQL connection string.
        *   `SUPABASE_URL`: Your Supabase project URL.
        *   `SUPABASE_ANON_KEY`: Your Supabase project anon key.
        *   `STRIPE_TEST_SECRET_KEY` / `STRIPE_PROD_SECRET_KEY`: Your Stripe secret keys (Test/Prod).
        *   `STRIPE_WEBHOOK_SECRET`: Your Stripe webhook signing secret.
        *   `STRIPE_VIP_PRICE_ID`: The Stripe Price ID for your VIP subscription plan.
        *   `FRONTEND_URL`: The base URL of your frontend (e.g., `http://localhost:5173`).
        *   `TEST_MODE`: Set to `true` to use test keys, `false` for production keys.
    *   Run database migrations: `npx prisma migrate dev`
    *   (Optional) Seed the database if a seed script exists: `npx prisma db seed`

3.  **Setup Frontend:**
    *   Navigate to the `frontend` directory: `cd ../frontend` (if you were in `backend`) or `cd frontend` (if you are in the root).
    *   Install dependencies: `npm install`
    *   Create a `.env.local` file (copy `.env.local.example` if available). Key variables:
        *   `VITE_API_BASE_URL`: URL for your backend API (e.g., `http://localhost:3001/api`).
        *   `VITE_SUPABASE_URL`: Your Supabase project URL.
        *   `VITE_SUPABASE_ANON_KEY`: Your Supabase project anon key.
        *   `VITE_STRIPE_TEST_PUB_KEY` / `VITE_STRIPE_PROD_PUB_KEY`: Your Stripe publishable keys (Test/Prod).
        *   `VITE_TEST_MODE`: Set to `true` to use test keys, `false` for production keys (should match backend `TEST_MODE`).

4.  **Run the Application:**
    *   **Start the Backend:** In one terminal (from the `backend` directory): `npm start` (or `npm run dev` if you have a dev script like nodemon).
    *   **Start the Frontend:** In another terminal (from the `frontend` directory): `npm run dev`.
    *   The frontend will typically be available at `http://localhost:5173`.

5.  **Configure Stripe Webhook:**
    *   Ensure your backend is running and accessible (e.g., using a tool like `ngrok` for local development if testing webhooks).
    *   In your Stripe Dashboard, set up a webhook endpoint pointing to `YOUR_BACKEND_URL/api/payments/webhook`.
    *   Listen for the events: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`.
    *   Make sure the `STRIPE_WEBHOOK_SECRET` in your backend `.env` matches the signing secret provided by Stripe.

6.  **Build for production:**
    *   Frontend: `cd frontend && npm run build`
    *   Backend: Build steps depend on your deployment strategy (e.g., Dockerfile, serverless function packaging).
