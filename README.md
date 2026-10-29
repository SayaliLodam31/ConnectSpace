# ConnectSpace - Enterprise Video Conferencing & Collaboration

ConnectSpace is a real-time video conferencing, screen sharing, live chat, secure file sharing, and interactive whiteboard application built with **Next.js 15**, **TypeScript**, **Tailwind CSS**, **WebRTC**, and **Supabase**.

---

## 🚀 Key Features

- **Mesh WebRTC Audio & Video**: Direct peer-to-peer audio and video communication using W3C Perfect Negotiation, STUN fallbacks, active speaker indicators, and automatic reconnects.
- **Ultra Low-Latency Screen Sharing**: Native browser screen capture using `navigator.mediaDevices.getDisplayMedia()` with track swapping and presenter state broadcasts.
- **Supabase Realtime Signaling**: Channel-based offer, answer, and ICE candidate exchange via Supabase Realtime broadcast channels with fallback to dedicated port 5017 WebSocket signaling.
- **Collaborative Whiteboard**: Real-time multi-user canvas supporting freehand pen, geometric shapes (rectangle, circle, line), text tool, eraser, color and stroke width selectors, undo/redo, and persistence in Supabase `whiteboard_items`.
- **Private Meeting File Vault**: End-to-end secured file sharing with private Supabase Storage bucket `meeting-files`, participant-scoped Row Level Security, upload progress, and signed temporary download URLs.
- **Meeting Chat**: Live synchronized chat with sender avatars, timestamps, message sanitization, auto-scroll, and real-time Supabase replication.
- **Live Presence & Host Controls**: Participant roster powered by Supabase Presence, live mic/camera/screen states, host participant muting, participant ejection, and meeting termination.
- **Polished Light SaaS Aesthetics**: Designed with crisp `#F8FAFC` slate backgrounds, `#2563EB` blue and `#4F46E5` indigo primary accents, rounded card structures, and accessible contrast.
- **Strict Process & Port Isolation**: Zero port conflicts with other system projects, automatically reserving dedicated ports:
  - Frontend: `3017` (fallback range `3017-3021`)
  - Optional Backend: `4017` (fallback range `4017-4021`)
  - Optional Signaling: `5017` (fallback range `5017-5021`)

---

## 🛠️ Technology Stack

- **Framework**: Next.js 15 (App Router, Server & Client Components)
- **Language**: TypeScript (strict type checking enabled)
- **Styling**: Tailwind CSS with custom brand palette & design tokens
- **Icons**: Lucide React
- **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS)
- **Realtime & Storage**: Supabase Realtime Channels, Supabase Storage
- **Media**: WebRTC (`RTCPeerConnection`, `getUserMedia`, `getDisplayMedia`)

---

## 📋 Database Schema & Architecture

The database consists of 9 relational tables secured with Row Level Security policies:

1. `profiles`: User information, avatars, job titles, timezones, and presence states.
2. `meetings`: Meeting metadata, host UUID, unique meeting codes, status (`scheduled`, `active`, `ended`), and timestamps.
3. `meeting_participants`: Live and historical participant records with roles (`host`, `cohost`, `participant`), mic/video/screen flags.
4. `meeting_invitations`: Email invitations and status (`pending`, `accepted`, `declined`).
5. `meeting_messages`: Chat messages with sender profile links, timestamps, and soft deletion (`deleted_at`).
6. `meeting_files`: File metadata, storage path references in `meeting-files`, and file sizes.
7. `whiteboards`: Whiteboard sessions associated with meetings.
8. `whiteboard_items`: Individual drawing strokes, shapes, and text items stored as JSONB for real-time collaboration.
9. `notifications`: User notification delivery.

Triggers automatically create a user profile on auth signup and maintain `updated_at` timestamps.

---

## ⚙️ Supabase Setup Instructions

### 1. Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and create or select an organization.
2. Click **New Project** and configure your database password and region.

### 2. Apply Database Migrations
1. Open the **SQL Editor** in your Supabase dashboard.
2. Open the file `supabase/migrations/20261019000001_initial_schema.sql` located in this project.
3. Paste the contents into the SQL Editor and click **Run**.
4. This will create:
   - All 9 application tables
   - Foreign keys and performance indexes
   - Automatic triggers (`handle_new_user`, `set_updated_at`, `handle_new_meeting`)
   - Complete Row Level Security (RLS) policies
   - Supabase Realtime publication configuration
   - Private storage bucket `meeting-files`

### 3. Configure Supabase Authentication
1. In the Supabase dashboard, go to **Authentication** -> **Providers** -> **Email**.
2. Ensure **Enable Email provider** is turned on.
3. For immediate local testing without email confirmation delays, you can disable **Confirm email** under **Authentication** -> **Email Auth**.

### 4. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Fill in your project credentials in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_APP_URL=http://localhost:3017
NEXT_PUBLIC_API_URL=http://localhost:4017
NEXT_PUBLIC_SIGNALING_URL=http://localhost:5017
```

---

## 🏃 Local Development & Port Isolation

### Port Diagnostics
Run the diagnostic command to check whether the dedicated ports (`3017`, `4017`, `5017`) are free:
```bash
npm run ports
```

### Starting the Application
Start the development server on the dedicated port (`3017`):
```bash
npm run dev
```

Or start with automatic port conflict avoidance (will detect occupied ports and seamlessly shift to `3018`, `3019`, etc., without killing any other running process):
```bash
npm run dev:auto
```

### Stopping the Application
Safely stop the ConnectSpace process using its project PID:
```bash
npm run stop
```
*Note: This command stops only the process recorded in `.run/dev.pid`. It never uses global kill commands and never terminates processes belonging to other projects.*

---

## 🧪 Multi-User Testing Guide (2 Browser Windows)

1. **Start the application**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3017` in your browser.

2. **Window 1 (User A - Host)**:
   - Navigate to `/signup` and create an account:
     - Name: `Alex Rivera`
     - Email: `alex@example.com`
     - Password: `Password123!`
   - On the `/dashboard`, click **Start Instant Space**.
   - Allow camera and microphone permissions when prompted by your browser.
   - Click **Share Link** in the top bar to copy the meeting invite link.

3. **Window 2 (User B - Participant - Incognito Window)**:
   - Open an **Incognito / Private Window** and navigate to `http://localhost:3017/signup`.
   - Create an account:
     - Name: `Sam Morgan`
     - Email: `sam@example.com`
     - Password: `Password123!`
   - Paste the copied meeting link or enter the meeting code in the search/join box.
   - Allow camera and microphone permissions.

4. **Verify Real-Time Collaboration Features**:
   - **Video & Audio Mesh**: Verify both participants' video feeds and active mic indicators are live.
   - **Screen Sharing**: In Window 1, click the **Screen Share** icon on the toolbar. Select a window to share. Verify Window 2 displays the live screen stream immediately.
   - **Real-Time Chat**: Open the chat panel in Window 1 and send "Hello team!". Verify Window 2 receives the message instantly without refreshing.
   - **Collaborative Whiteboard**: Open the whiteboard in Window 1. Select a color and draw a stroke. In Window 2, open the whiteboard and verify the stroke appears simultaneously. Draw a rectangle from Window 2 and verify it renders in Window 1.
   - **File Sharing**: Upload a PDF or image in the files panel. Verify the second user sees the file and can download it via the signed URL.
   - **Leave Meeting**: Click **Leave**. Verify presence and participant rosters update dynamically.

---

## 🔒 Security Architecture

- **Row Level Security (RLS)**: Enforced across every single table so that users cannot access records outside authorized scopes.
- **No Secret Exposure**: The Supabase service role key is strictly excluded from frontend code.
- **Signed Storage URLs**: File downloads generate short-lived signed URLs (60-second expiration) accessible only by verified participants.
- **Input Sanitization**: Meeting messages and user inputs are sanitized against cross-site scripting (XSS).
- **Graceful Hardware Fallbacks**: If a user lacks a camera or denies permission, the app automatically falls back to audio-only and displays a branded avatar tile without crashing.

---

## 🚢 Deployment (Vercel)

1. Push your repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com), click **Import Project**.
3. Add the environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` (your production URL)
4. Deploy! Next.js will build the optimized production bundle automatically.
