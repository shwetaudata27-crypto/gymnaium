# US Gymnasium — Backend (in-repo)

Express + SQLite + Nodemailer. Lives inside the same project as the frontend.
No separate repository.

## Run

From the project root:

```bash
npm install
# 1. backend only
npm run server
# 2. frontend only
npm run dev
# 3. both at the same time
npm run dev:all
```

The backend listens on `http://127.0.0.1:5000` and stores data in
`server/data/gym.db` (auto-created on first run).

## Built-in accounts

Seeded automatically on every start (passwords are re-applied):

- Admin login (`/adminlogin`): username `gymnasium` / password `usbv7173`
- Gate / user login (`/userlogin`): username `shubham` / password `gym@1521`

## Email (optional)

Copy `server/.env.example` to `server/.env` and fill SMTP credentials.
If SMTP is not configured the API still works — only outgoing emails are
skipped.

### Gmail setup

If you use Gmail, `SMTP_PASS` must be a Google app password, not your normal
Gmail login password. In your Google account, enable 2-Step Verification, create
an app password for Mail, paste that password into `server/.env`, and restart
the backend.

Example:

```env
SMTP_SERVICE=gmail
SMTP_USER=your-gmail-address@gmail.com
SMTP_PASS=your-16-character-google-app-password
SMTP_FROM="US Gymnasium <your-gmail-address@gmail.com>"
SMTP_REPLY_TO=your-gmail-address@gmail.com
```

## Endpoints

- `POST /adminlogin` `POST /userlogin` — login (returns `token` / `idToken`)
- `POST /api/clients/register` — public, register new client
- `GET/PUT/DELETE /api/clients/:id`, `GET /api/clients` — auth required
- `POST /api/payments`, `GET /api/payments/:id` — auth required
- `POST /api/renewals` — create a renewal for an existing client
- `GET /api/renewals` — list all renewals
- `GET /api/renewals/:clientId` — list renewals for one client
- `POST /api/renewals/:id/email` — send renewal confirmation email
- `POST /api/renewal-payments` — record a payment against a renewal
- `GET /api/renewal-payments/:renewalId` — list payments for one renewal
- `POST /api/email/send` — auth required
- `GET /api/db/download` — download the live `gym.db` file
- `GET /api/health` — health check

### New Tables
- `renewals` stores renewal history separate from the original `clients` table
- `renewal_payments` stores payments tied to renewals
