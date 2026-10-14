# EZ-WAY — Render + Supabase copy

Full application source, adapted from your uploaded `EZ-WAY-main.zip` (October 8, 2026). This is a separate copy, not a migration of your running app or a fetch-source bootstrap. The latest GitHub revision has not been compared with this archive.

- **Render:** React frontend and Node/Express backend in one web service.
- **Supabase:** PostgreSQL records, email/password authentication, and private media storage.
- **Access:** owner-managed workspace. Only Supabase user IDs listed in `OWNER_USER_IDS` can manage it. Client share links work without an owner login.
- **Data:** starts empty. Existing AWS data, files, users and passwords are not transferred.

## 1. Set up a new Supabase project

1. Create a dedicated project. Save its database password.
2. Open **SQL Editor**, paste the entire `supabase/setup.sql` file, and run it once. It creates the app tables and a private `ezway-media` bucket. Use a new project; do not run this against an unrelated database.
3. Open **Authentication → Users → Add user**. Create your owner account with your email and password, with email confirmed. Copy that user's UUID.
4. Disable public sign-ups in Authentication settings. Only users explicitly allowed by Render's `OWNER_USER_IDS` can access the owner workspace, even if another user exists.
5. Find your project URL, public anon/publishable key, and server `service_role` key under project API settings. The service-role key is a backend secret. Never put it in a `VITE_` variable.
6. Open **Connect → Session pooler** and copy the PostgreSQL connection URI, using port **5432**. Replace the password placeholder; URL-encode special characters in the password.
7. In Storage, confirm `ezway-media` is private. Set its permitted upload size within your Supabase plan's limits. The app's category limits do not override your provider's limit.

## 2. Put the copy in a new GitHub repository

Unzip this download. Upload the **contents** of the app folder into a new private repository, for example `EZ-WAY-Render-Supabase`. `package.json` and `render.yaml` must appear at the repository root.

Do not upload `.env`, live keys, `node_modules`, or `dist`. The included `.gitignore` excludes them. Old deployment workflows are archived as text under `docs/legacy` so pushing this copy does not trigger the old cloud deployments.

## 3. Deploy on Render

Use **New → Blueprint**, choose the new repository, and let Render read `render.yaml`. Review the selected service plan before creating it; the Blueprint does not request a Render database. Supabase supplies the database.

Enter these variables when prompted:

| Variable | What to enter |
| --- | --- |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your secret service-role key; server only |
| `DATABASE_URL` | Session pooler PostgreSQL URI with your database password |
| `OWNER_USER_IDS` | UUID of the owner user created in Supabase; comma-separated if multiple trusted owners share this workspace |
| `VITE_SUPABASE_URL` | Same project URL as `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | Public anon or publishable key; never the service-role key |

The Blueprint already sets `MEDIA_BUCKET=ezway-media`, `VITE_EZWAY_API_URL=/api/data`, `NODE_ENV=production`, and Node 22.

If creating a **Web Service** manually instead, use:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Root directory | Leave blank when package.json is at repo root |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check | `/api/health` |

Add all Blueprint environment variables when deploying manually. This is a Web Service, not a Static Site. Render supplies `PORT` automatically.

When Render gives you the HTTPS address, add it as Supabase Authentication's Site URL. Sign in using the account you created. There is no self-registration form in this copy. Manage password resets/users through Supabase Authentication.

Changes to `VITE_` variables require a rebuild. Server variable changes require a restart/redeploy. No extra CORS setup is needed between the frontend and its data API because they share one origin.

## 4. Verify your deployment

1. Open `/api/health`: expect `{"status":"ok"}`. This checks the web process, not the database.
2. Sign in. Confirm the dashboard loads without data errors. `GET /api/data/diagnostics` with your signed-in bearer token checks table access.
3. Upload a short MP3; refresh and verify that it remains and plays.
4. Create a client, playlist and client share link. Open that link in a private browser window; play the track and submit feedback.
5. Reload the owner dashboard and confirm feedback appears.
6. Test an attachment and artwork upload, then sign out. Private owner routes should reject unauthenticated access.

The server verifies Supabase tokens and the owner allowlist. Tables have RLS enabled with no direct browser grants; the server accesses PostgreSQL. Media uses temporary signed URLs and the private bucket. Client links are bearer access links: anyone holding an active link can use it. This is a shared owner workspace, not a multi-tenant SaaS.

## Run locally

Use Node 22 or newer:

```bash
npm ci
cp .env.example .env
# Fill .env with the same Supabase configuration.
npm run dev
```

Open `http://localhost:3000`. This local app still uses your configured Supabase project. To test production mode: `npm run build`, then `npm start`.

## Existing optional tools

The existing app screens are retained. This deployment covers the core catalog, playlists, clients, profiles, messages, sharing and media. It does not deploy every external AI/media service automatically.

- Existing Gemini-backed endpoints need `GEMINI_API_KEY` on Render. The original provider/model choices were not redesigned in this copy.
- YouTube connection needs `VITE_GOOGLE_CLIENT_ID` and the Render origin configured in Google OAuth.
- Album Cover Studio needs its separately deployed backend URL in `VITE_ALBUM_COVER_API_URL`.
- Cloud audio analysis/tools need their separate `VITE_MUSIC_INTELLIGENCE_API_URL` / `VITE_AUDIO_TOOLS_URL` services. Their older AWS deployment folders remain reference material; the core Supabase app does not use them.
- Local Lyrics Service remains a separate Python service on the user's machine.
- Original provider features with simulation/offline fallback behavior were retained; a running dashboard is not proof that an external video or AI provider is configured.

## Troubleshooting

- **Sign-in not configured:** check both public Supabase variables and rebuild.
- **Owner access required / 403:** `OWNER_USER_IDS` must contain the Auth user's UUID, not their email or project ID.
- **Authentication service unavailable:** check the server project URL and service-role key.
- **Data request failed:** confirm setup.sql succeeded and DATABASE_URL uses the matching project's session pooler and password.
- **TLS certificate error:** obtain the database CA certificate from Supabase and set server variable `DATABASE_CA_CERT` to the PEM text. Escaped `\n` or actual newlines are supported. Certificate verification is intentionally enabled; do not disable it.
- **Upload rejected:** check bucket existence, private-bucket settings, content type and Supabase upload limits. Large uploads may need a higher provider limit; resumable uploads are not implemented.
- **Existing data missing:** this is a fresh database; migration from AWS is a separate step.

## Validation and provenance

The included `VALIDATION.md` records local checks and remaining live checks. Dependencies are locked in `package-lock.json`. No real credentials are included.

Official setup references:
- https://render.com/docs/blueprint-spec
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl
- https://supabase.com/docs/reference/javascript/auth-getuser
