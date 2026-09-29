# Turning on accounts (Supabase)

Tokuma stores each business's data in a Supabase database once these steps are done. Until then the site runs in **local mode**: data stays in each visitor's browser.

The whole setup takes about 15 minutes.

## 1. Create the project

1. Go to <https://supabase.com> and sign up. A GitHub or Google login is fine.
2. Click **New project**.
   - **Name:** `tokuma`
   - **Database password:** click *Generate*, then save the password in your password manager. You won't need it day to day.
   - **Region:** the one closest to most of your users, for example *Canada (Central)*.
3. Wait about 2 minutes for the project to finish setting up.

## 2. Create the tables and security rules

1. In the left menu, open **SQL Editor** and click **New query**.
2. Paste the whole contents of [`supabase/migrations/001_workspaces.sql`](../supabase/migrations/001_workspaces.sql) and click **Run**. You should see "Success. No rows returned".

This creates the tables and turns on Row Level Security, so each business can read and write only its own data.

## 3. Tell Supabase where the app lives

Open **Authentication → URL Configuration** and set these:

- **Site URL:** `https://samanthascales.github.io/TokumaDashboard/`
- **Redirect URLs:** add `https://samanthascales.github.io/TokumaDashboard/`. If you'll run the app on your computer, also add `http://localhost:5173/`.

Confirmation and password-reset emails link back to these addresses.

## 4. Email sign-in

Open **Authentication → Providers → Email**. It's on by default. Keep **Confirm email** on, so people must prove they own their address.

Supabase's built-in email sender is limited to a few emails per hour and is only meant for testing. Before you invite real users, set up your own sender under **Authentication → Emails → SMTP Settings**. Resend, Postmark, SendGrid and Amazon SES all offer free or cheap plans. The sign-up and reset emails will then come from your own domain.

## 5. Connect the app

1. Open **Project Settings → API Keys** (or **Data API**).
2. Copy the **Project URL**. It looks like `https://abcdefgh.supabase.co`.
3. Copy the **anon / publishable** key.

These two values are safe to publish, because the security rules from step 2 do the protecting. They go in `.env.production` in this repo:

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

**Never share the `service_role` / secret key.** It bypasses all the security rules.

## 6. Make yourself the admin

1. Open the live site, click **Sign in → Create account**, and sign up with your own email.
2. Back in Supabase, run this in **SQL Editor**, using your email:

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```

3. Reload the app. An **Admin** item appears at the bottom of the sidebar.

To remove an admin later, run `delete from public.admins where user_id = (select id from auth.users where email = '...');`.

## How support access works

- A business's data can be opened only if that business has turned on **Settings → Account & privacy → Allow Tokuma support to view my data**. It's off by default.
- To open a business, the admin must type a reason. Each view is saved, and the business sees the date and the reason in its **Access history**.
- The support view is read-only: nothing you change while viewing is saved.
- The admin list shows business names, owner emails, counts and last-active dates. It never shows the data itself.

Before launch, add a privacy policy that explains:
- what you store
- that support access is opt-in and logged
- how people can delete their data

## Moving the project later

- **To another Supabase account or organization:** use **Project Settings → General → Transfer project**. The URL and keys stay the same.
- **To another provider:** it's a standard PostgreSQL database. **Database → Backups**, or `pg_dump` with the database password, exports everything.
