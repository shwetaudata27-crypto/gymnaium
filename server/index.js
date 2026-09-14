// US Gymnasium backend — Express + SQLite + Nodemailer.
// Lives inside the same repo as the frontend. Run with: npm run server
// or together with the frontend: npm run dev:all
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dotenvPath = path.join(__dirname, '.env');
dotenv.config({ path: dotenvPath });

const PORT = process.env.PORT || 5000;
const DATA_DIR = __dirname;
const DB_PATH = path.resolve(process.env.DB_PATH || path.join(DATA_DIR, 'gym.db'));
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('wal_checkpoint(TRUNCATE)');
db.pragma('journal_mode = DELETE');
console.log('[db] using SQLite database:', DB_PATH);
console.log('[db] journal mode:', db.pragma('journal_mode', { simple: true }));

const legacyTables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('sms_history','email_history')`).all().map((row) => row.name);
if (legacyTables.includes('sms_history') && !legacyTables.includes('email_history')) {
  db.exec(`ALTER TABLE sms_history RENAME TO email_history;`);
  try {
    db.exec(`ALTER TABLE email_history RENAME COLUMN smsType TO emailType;`);
  } catch {
    // older SQLite versions may not support column rename; preserve the original column name.
  }
}

// ---------- Schema ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Admin'
  );
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clientId TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    dob TEXT,
    address TEXT,
    occupation TEXT,
    emergencyContact TEXT,
    age INTEGER,
    gender TEXT,
    membershipType TEXT,
    slot TEXT,
    membershipPeriod INTEGER,
    startDate TEXT,
    endDate TEXT,
    membershipStatus TEXT,
    registrationDay TEXT,
    finalAmount REAL,
    termsAcceptedBy TEXT,
    photo TEXT,
    signature TEXT,
    notes TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    externalId TEXT UNIQUE,
    clientId TEXT NOT NULL,
    name TEXT,
    amount REAL,
    finalAmount REAL,
    paidAmount REAL,
    membershipPeriod INTEGER,
    offerDiscount REAL,
    discount REAL,
    discountType TEXT,
    notes TEXT,
    paidDate TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    externalId TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    price REAL,
    durationMonths INTEGER,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS email_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clientId TEXT NOT NULL,
    emailType TEXT,
    message TEXT,
    sentAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS renewals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clientId TEXT NOT NULL,
    name TEXT NOT NULL,
    membershipType TEXT,
    memberSlot TEXT,
    membershipPeriod INTEGER,
    startDate TEXT,
    endDate TEXT,
    finalAmount REAL,
    notes TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS renewal_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    renewalId INTEGER NOT NULL,
    clientId TEXT NOT NULL,
    client_name TEXT,
    amount REAL,
    finalAmount REAL,
    paidAmount REAL,
    membershipPeriod INTEGER,
    offerDiscount REAL,
    discount REAL,
    discountType TEXT,
    notes TEXT,
    paidDate TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clientId TEXT,
    name TEXT NOT NULL,
    rating INTEGER NOT NULL,
    feedback TEXT NOT NULL,
    email TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

const clientColumns = db.prepare('PRAGMA table_info(clients)').all().map((column) => column.name);
function addClientColumn(name, definition) {
  if (!clientColumns.includes(name)) {
    db.prepare(`ALTER TABLE clients ADD COLUMN ${name} ${definition}`).run();
  }
}

function quoteIdentifier(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function addTableColumnIfMissing(table, name, definition, options = {}) {
  const tableName = quoteIdentifier(table);
  const columnName = quoteIdentifier(name);
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all().map((row) => row.name);
  const needsUniqueIndex = /\bUNIQUE\b/i.test(definition);
  const safeDefinition = definition
    .replace(/\bUNIQUE\b/ig, '')
    .replace(/\s+DEFAULT\s+CURRENT_TIMESTAMP\b/ig, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cols.includes(name)) {
    db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${safeDefinition}`).run();
  }

  if (options.backfillSql) {
    db.prepare(options.backfillSql({ tableName, columnName })).run();
  }

  if (needsUniqueIndex) {
    const indexName = quoteIdentifier(`idx_${table}_${name}`);
    try {
      db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${columnName}) WHERE ${columnName} IS NOT NULL`).run();
    } catch (err) {
      console.warn(`[db] could not create unique index for ${table}.${name}:`, err && err.message ? err.message : err);
    }
  }
}

function tableExists(table) {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`).get(table);
  return Boolean(row?.name);
}


function isTimestampNewer(incoming, existing) {
  const incomingTime = Number(new Date(incoming));
  const existingTime = Number(new Date(existing));
  if (Number.isNaN(incomingTime)) return false;
  if (Number.isNaN(existingTime)) return true;
  return incomingTime >= existingTime;
}

addClientColumn('phone', 'TEXT');
addClientColumn('dob', 'TEXT');
addClientColumn('slot', 'TEXT');
addClientColumn('occupation', 'TEXT');
addClientColumn('termsAcceptedBy', 'TEXT');
addClientColumn('membershipType', 'TEXT');
addClientColumn('membershipStatus', 'TEXT');

const timestampBackfill = ({ tableName, columnName }) =>
  `UPDATE ${tableName} SET ${columnName} = COALESCE(${columnName}, createdAt, CURRENT_TIMESTAMP) WHERE ${columnName} IS NULL OR ${columnName} = ''`;

addTableColumnIfMissing('clients', 'updatedAt', 'TEXT DEFAULT CURRENT_TIMESTAMP', { backfillSql: timestampBackfill });
addTableColumnIfMissing('payments', 'externalId', 'TEXT UNIQUE', {
  backfillSql: ({ tableName, columnName }) =>
    `UPDATE ${tableName} SET ${columnName} = 'server-payment-' || id WHERE ${columnName} IS NULL OR ${columnName} = ''`,
});
addTableColumnIfMissing('payments', 'updatedAt', 'TEXT DEFAULT CURRENT_TIMESTAMP', { backfillSql: timestampBackfill });
addTableColumnIfMissing('reviews', 'updatedAt', 'TEXT DEFAULT CURRENT_TIMESTAMP', { backfillSql: timestampBackfill });
addTableColumnIfMissing('plans', 'externalId', 'TEXT UNIQUE', {
  backfillSql: ({ tableName, columnName }) =>
    `UPDATE ${tableName} SET ${columnName} = 'server-plan-' || id WHERE ${columnName} IS NULL OR ${columnName} = ''`,
});
addTableColumnIfMissing('renewal_payments', 'client_name', 'TEXT', {
  backfillSql: ({ tableName, columnName }) =>
    `UPDATE ${tableName} SET ${columnName} = COALESCE(
      (SELECT name FROM clients WHERE clients.clientId = ${tableName}.clientId),
      (SELECT name FROM renewals WHERE renewals.id = ${tableName}.renewalId)
    ) WHERE ${columnName} IS NULL OR ${columnName} = ''`,
});
addTableColumnIfMissing('plans', 'updatedAt', 'TEXT DEFAULT CURRENT_TIMESTAMP', { backfillSql: timestampBackfill });

if (clientColumns.includes('dateOfBirth')) {
  db.prepare(`UPDATE clients SET dob = dateOfBirth WHERE (dob IS NULL OR dob = '') AND dateOfBirth IS NOT NULL`).run();
}
if (clientColumns.includes('memberSlot')) {
  db.prepare(`UPDATE clients SET slot = memberSlot WHERE (slot IS NULL OR slot = '') AND memberSlot IS NOT NULL`).run();
}

function parseMembershipType(value) {
  if (!value) return { gym: false, cardio: false, crossfit: false, pt: false };
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return { gym: false, cardio: false, crossfit: false, pt: false };
  }
}

function normalizeClient(row) {
  if (!row) return null;
  return {
    ...row,
    membershipType: parseMembershipType(row.membershipType),
    membershipStatus: row.membershipStatus || 'active',
    slot: row.slot || row.memberSlot || '',
    dob: row.dob || row.dateOfBirth || '',
  };
}

function getPaymentsForClient(clientId) {
  return db.prepare('SELECT * FROM payments WHERE clientId = ? ORDER BY createdAt DESC').all(clientId);
}

function normalizeClientWithPayments(row) {
  const client = normalizeClient(row);
  if (!client) return null;
  return {
    ...client,
    payments: getPaymentsForClient(client.clientId),
  };
}

function normalizeClients(rows, includePayments = false) {
  return rows.map((row) => includePayments ? normalizeClientWithPayments(row) : normalizeClient(row));
}

function parseSyncTimestamp(value) {
  const timestamp = String(value || '').trim();
  const millis = Number(new Date(timestamp));
  return Number.isNaN(millis) ? new Date().toISOString() : new Date(millis).toISOString();
}

function isSyncIncomingNewer(incoming, existing) {
  const incomingTime = Number(new Date(incoming));
  const existingTime = Number(new Date(existing));
  if (Number.isNaN(incomingTime)) return false;
  if (Number.isNaN(existingTime)) return true;
  return incomingTime >= existingTime;
}

function makeConflict(entity, identifier, incomingUpdatedAt, existingUpdatedAt, action) {
  return {
    entity,
    identifier,
    action,
    incomingUpdatedAt,
    existingUpdatedAt,
    winner: 'server',
  };
}

function normalizePlan(row) {
  if (!row) return null;
  return { ...row };
}

function normalizeReview(row) {
  if (!row) return null;
  return { ...row };
}

function getDbCounts() {
  return {
    clients: db.prepare('SELECT COUNT(*) AS count FROM clients').get().count,
    payments: db.prepare('SELECT COUNT(*) AS count FROM payments').get().count,
    plans: tableExists('plans') ? db.prepare('SELECT COUNT(*) AS count FROM plans').get().count : 0,
    reviews: db.prepare('SELECT COUNT(*) AS count FROM reviews').get().count,
    emailHistory: db.prepare('SELECT COUNT(*) AS count FROM email_history').get().count,
  };
}

const GOOGLE_REVIEW_LINK = 'https://www.google.com/search?q=us+gymnasium+in+solapur&rlz=1C1YTUH_enIN1082IN1082&oq=us&gs_lcrp=EgZjaHJvbWUqBggBECMYJzIGCAAQRRg5MgYIARAjGCcyDQgCEAAYgwEYsQMYgAQyDQgDEAAYgwEYsQMYgAQyCggEEAAYsQMYgAQyBggFEEUYPTIGCAYQRRg8MgYIBxBFGDzSAQgyNTQxajBqN6gCALACAA&sourceid=chrome&ie=UTF-8#lrd=0x3bc5db221e1fab99:0xe5e60b898a66c2b2,3,,,,';

function getReviewFooter() {
  return `⭐ Rate us on Google: ${GOOGLE_REVIEW_LINK}`;
}

function normalizeRenewal(row) {
  if (!row) return null;
  return {
    ...row,
    membershipType: parseMembershipType(row.membershipType),
  };
}

function normalizeRenewals(rows) {
  return rows.map((row) => normalizeRenewal(row));
}

// Seed / refresh built-in accounts so credentials always match the docs.
// - Admin login  (/adminlogin)  -> gymnasium / usbv7173
// - Gate  login  (/userlogin)   -> shubham   / gymnasium@1521
function upsertUser(username, password, role) {
  const hash = bcrypt.hashSync(password, 10);
  const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
  if (existing) {
    db.prepare('UPDATE admins SET password_hash = ?, role = ? WHERE username = ?')
      .run(hash, role, username);
  } else {
    db.prepare('INSERT INTO admins (username, password_hash, role) VALUES (?, ?, ?)')
      .run(username, hash, role);
  }
}
upsertUser('gymnasium', 'usbv7173', 'Admin');
upsertUser('shubham',   'gym@1521', 'User');
console.log('[seed] built-in users ready (gymnasium / Admin, shubham / User)');

// ---------- Mail ----------
let mailer = null;
const smtpConfigured = Boolean((process.env.SMTP_SERVICE || process.env.SMTP_HOST) && process.env.SMTP_USER && process.env.SMTP_PASS);
if (smtpConfigured) {
  const auth = {
    user: process.env.SMTP_USER,
    pass: String(process.env.SMTP_PASS || '').replace(/\s/g, ''),
  };
  const service = String(process.env.SMTP_SERVICE || '').trim();
  const host = String(process.env.SMTP_HOST || '').trim();
  const passWithoutSpaces = auth.pass.replace(/\s/g, '');
  const isGmailTransport =
    service.toLowerCase() === 'gmail' ||
    host.toLowerCase().includes('gmail') ||
    String(process.env.SMTP_USER || '').toLowerCase().endsWith('@gmail.com');

  if (isGmailTransport && passWithoutSpaces.length > 0 && passWithoutSpaces.length !== 16) {
    console.warn('[smtp] Gmail SMTP_PASS should be a 16-character Google app password, not the normal Gmail password.');
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
  const transportOptions = service
    ? {
        service,
        auth,
        port,
        secure,
        ...(process.env.SMTP_AUTH_METHOD ? { authMethod: process.env.SMTP_AUTH_METHOD } : {}),
      }
    : {
        host,
        port,
        secure,
        auth,
        ...(process.env.SMTP_AUTH_METHOD ? { authMethod: process.env.SMTP_AUTH_METHOD } : {}),
      };
  mailer = nodemailer.createTransport(transportOptions);
  console.log('[smtp] transport created, verifying credentials...', { service, host, port, secure });
  mailer.verify().then(() => {
    console.log('[smtp] configured and verified');
  }).catch((err) => {
    console.error('[smtp] verification failed:', err && err.message ? err.message : err);
    console.error('[smtp] Gmail requires a valid app password for SMTP. Emails will fail until SMTP_PASS is corrected.');
  });
}
console.log('[smtp]', smtpConfigured ? 'configured (verification pending)' : `not configured. using path: ${dotenvPath}`);

function appendEmailFailureLog(entry) {
  const logPath = path.join(__dirname, 'email-fallback.log');
  fs.appendFileSync(logPath, JSON.stringify({ time: new Date().toISOString(), ...entry }) + '\n');
  console.warn('[email] failure details written to', logPath);
}

function buildEmailHtml({ headerText, headline, bodyText, buttonText, buttonUrl, footerText, includeReview = false }) {
  const bodyHtml = String(bodyText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin: 0 0 16px; font-size: 16px; line-height: 1.75; color: #0f172a;">${line}</p>`) 
    .join('');
  const reviewHtml = includeReview ? `<br><br><span style="font-weight: 700;">⭐ Rate us on Google: <a href="${GOOGLE_REVIEW_LINK}" style="color: #2563eb; text-decoration: none;">${GOOGLE_REVIEW_LINK}</a></span>` : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${headerText || 'US Gymnasium'}</title>
  </head>
  <body style="margin: 0; padding: 0; background: #eef2ff;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="min-width: 100%; background: #eef2ff; padding: 24px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 680px; background: #ffffff; border-radius: 28px; overflow: hidden; border: 1px solid #dbeafe; box-shadow: 0 24px 80px rgba(15, 23, 42, 0.08);">
            <tr>
              <td style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 32px; text-align: center; color: #ffffff;">
                <p style="margin: 0 0 12px; font-size: 12px; letter-spacing: 0.24em; text-transform: uppercase; opacity: 0.85;">${headerText}</p>
                <h1 style="margin: 0; font-size: 32px; line-height: 1.1; font-weight: 800;">${headline}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px; color: #0f172a; font-family: Inter, system-ui, sans-serif;">
                ${bodyHtml}
                ${buttonText && buttonUrl ? `<p style="margin: 24px 0 0;"><a href="${buttonUrl}" style="display: inline-block; padding: 14px 24px; border-radius: 999px; background: #111827; color: #ffffff; text-decoration: none; font-weight: 700;">${buttonText}</a></p>` : ''}
                <p style="margin: 30px 0 0; font-size: 14px; line-height: 1.75; color: #475569;">${footerText}${reviewHtml}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function getPublicEmailError(err) {
  const rawMessage = err && err.message ? err.message : String(err);
  const rawResponse = err && err.response ? String(err.response) : '';
  const combined = `${rawMessage}\n${rawResponse}`.toLowerCase();

  if (
    (err && err.code === 'EAUTH') ||
    combined.includes('application-specific password required') ||
    combined.includes('invalidsecondfactor')
  ) {
    return {
      code: 'GMAIL_APP_PASSWORD_REQUIRED',
      message: 'Gmail rejected the SMTP login. Create a Google app password and put that 16-character password in SMTP_PASS, then restart the backend.',
    };
  }

  if (combined.includes('etimeout') || combined.includes('connection timed out') || combined.includes('connect etimedout') || combined.includes('econnrefused')) {
    return {
      code: 'SMTP_CONNECTION_FAILED',
      message: 'SMTP connection failed. Check SMTP_HOST/SMTP_PORT/SMTP_SECURE, network access to the SMTP server, and whether port 465 is blocked. For Gmail, try SMTP_PORT=587 and SMTP_SECURE=false.',
    };
  }

  return {
    code: err && err.code ? String(err.code) : 'EMAIL_SEND_FAILED',
    message: rawMessage || 'Email was not accepted by the SMTP server',
  };
}

async function sendTrackedEmail({ to, subject, text, html, clientId, emailType }) {
  const recipient = String(to || '').trim();
  if (!recipient) {
    throw new Error('No recipient email address provided');
  }
  if (!mailer) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS in the backend deployment environment.');
  }

  const safeText = String(text || '').trim();
  const t = String(emailType || '').toLowerCase();
  const includeReviewFooter = t === 'welcome' || t === 'registration';
  const safeTextWithFooter = includeReviewFooter
    ? (safeText ? `${safeText}\n\n${getReviewFooter()}` : `Thank you for being part of US Gymnasium. We are here to support your fitness journey.\n\n${getReviewFooter()}`)
    : (safeText || 'Thank you for being part of US Gymnasium. We are here to support your fitness journey.');

  const safeHtml = html || buildEmailHtml({
    headerText: subject || 'US Gymnasium',
    headline: subject || 'Hello from US Gymnasium',
    bodyText: safeText || 'Thank you for being part of US Gymnasium. We are here to support your fitness journey.',
    footerText: 'If you have questions, reply to this email and we’ll help you right away.',
    includeReview: includeReviewFooter,
  });

  const mailOptions = {
    from: process.env.SMTP_FROM || `"US Gymnasium" <${process.env.SMTP_USER}>`,
    to: recipient,
    subject: subject || 'US Gymnasium',
    text: safeTextWithFooter || undefined,
    html: safeHtml,
    replyTo: process.env.SMTP_REPLY_TO || process.env.SMTP_USER,
    sender: process.env.SMTP_USER,
    importance: 'normal',
    priority: 'normal',
    headers: {
      'X-Mailer': 'US Gymnasium',
      'X-Priority': '3',
    },
  };

  console.log('[email] sending', { to: recipient, subject: mailOptions.subject, clientId: clientId || null, emailType: emailType || null });
  try {
    const info = await mailer.sendMail(mailOptions);
    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];
    console.log('[email] SMTP response', {
      messageId: info.messageId,
      response: info.response,
      accepted,
      rejected,
      pending: info.pending || [],
    });

    if (accepted.length === 0 || rejected.length > 0) {
      throw new Error(`SMTP did not accept all recipients. Accepted: ${accepted.join(', ') || 'none'}; Rejected: ${rejected.join(', ') || 'none'}`);
    }

    if (clientId && text) {
      db.prepare('INSERT INTO email_history (clientId, emailType, message) VALUES (?, ?, ?)')
        .run(clientId, emailType || subject || 'email', text);
    }

    return {
      accepted,
      rejected,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (err) {
    appendEmailFailureLog({
      to: recipient,
      subject: mailOptions.subject,
      text: text || null,
      html: html || null,
      from: mailOptions.from,
      error: err && err.message ? err.message : String(err),
      code: err && err.code ? err.code : null,
      response: err && err.response ? err.response : null,
      responseCode: err && err.responseCode ? err.responseCode : null,
    });
    throw err;
  }
}

// ---------- App ----------
const app = express();
const envOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const defaultLocalOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];
const allowedOrigins = [...new Set([...defaultLocalOrigins, ...envOrigins])];
function isLocalNetworkOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin);
}
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin) || isLocalNetworkOrigin(origin)) {
      return callback(null, true);
    }
    callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
console.log('[cors] allowing origins', allowedOrigins.join(', ') || 'all local network origins');

// Helper to wrap async route handlers so errors are forwarded to Express error handler
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// (error middleware is registered after routes so it can catch errors)

// Health
app.get('/api/health', (_req, res) => res.json({ status: 'ok', dbPath: DB_PATH, counts: getDbCounts() }));

// ---------- Auth ----------
function makeLoginHandler(requiredRole) {
  return (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
    const row = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    if (requiredRole && row.role !== requiredRole) {
      return res.status(403).json({ error: 'Not allowed for this login' });
    }
    res.json({ success: true, message: 'Login successful', role: row.role, username: row.username });
  };
}
app.post('/adminlogin', wrap((req, res) => makeLoginHandler('Admin')(req, res)));
app.post('/userlogin', wrap((req, res) => makeLoginHandler('User')(req, res)));
app.post('/api/auth/login', wrap((req, res) => makeLoginHandler('Admin')(req, res)));

// ---------- Clients ----------
app.post('/api/clients/register', wrap(async (req, res) => {
  const c = req.body || {};
  const recipientEmail = String(c.email || '').trim();
  const last = db.prepare('SELECT MAX(CAST(clientId AS INTEGER)) AS m FROM clients').get().m || 100;
  const clientId = String(last + 1);
  const now = new Date().toISOString();
  const stmt = db.prepare(`INSERT INTO clients
    (clientId, name, email, phone, dob, address, occupation, emergencyContact, age, gender, membershipType, slot, membershipPeriod, startDate, endDate, membershipStatus, registrationDay, finalAmount, termsAcceptedBy, photo, signature, notes, createdAt, updatedAt)
    VALUES (@clientId,@name,@email,@phone,@dob,@address,@occupation,@emergencyContact,@age,@gender,@membershipType,@slot,@membershipPeriod,@startDate,@endDate,@membershipStatus,@registrationDay,@finalAmount,@termsAcceptedBy,@photo,@signature,@notes,@createdAt,@updatedAt)`);
  stmt.run({
    clientId,
    name: c.name || '',
    email: recipientEmail,
    phone: c.phone || '',
    dob: c.dob || '',
    address: c.address || '',
    occupation: c.occupation || '',
    emergencyContact: c.emergencyContact || '',
    age: c.age || 0,
    gender: c.gender || '',
    membershipType: JSON.stringify(c.membershipType || {}),
    slot: c.slot || '',
    membershipPeriod: c.membershipPeriod || 0,
    startDate: c.startDate || '',
    endDate: c.endDate || '',
    membershipStatus: c.membershipStatus || 'active',
    registrationDay: c.registrationDay || '',
    finalAmount: c.finalAmount || 0,
    termsAcceptedBy: c.termsAcceptedBy || '',
    photo: c.photo || '',
    signature: c.signature || '',
    notes: c.notes || '',
    createdAt: now,
    updatedAt: now,
  });
  const client = normalizeClientWithPayments(db.prepare('SELECT * FROM clients WHERE clientId = ?').get(clientId));
  console.log('[clients] registered', { clientId, email: recipientEmail, totalClients: getDbCounts().clients, dbPath: DB_PATH });

  let emailResult = { sent: false, skipped: true, error: 'No recipient email address provided' };
  if (recipientEmail) {
    const reviewUrl = `${process.env.PUBLIC_APP_URL || 'http://localhost:3000'}/review?clientId=${encodeURIComponent(clientId)}`;
    const welcomeText = [
      `Welcome to US Gymnasium, ${client.name}!`,
      client.slot ? `Workout slot: ${client.slot}.` : '',
      client.startDate ? `Plan starts: ${new Date(client.startDate).toLocaleDateString('en-IN')}.` : '',
      client.endDate ? `Membership valid until: ${new Date(client.endDate).toLocaleDateString('en-IN')}.` : '',
      `Share your first impressions with us here: ${reviewUrl}`,
      'Stay consistent and train with discipline.',
    ].filter(Boolean).join(' ');

    try {
      const html = buildEmailHtml({
        headerText: 'Welcome to US Gymnasium',
        headline: `Hi ${client.name}, welcome aboard!`,
        bodyText: [
          client.slot ? `Workout slot: ${client.slot}.` : '',
          client.startDate ? `Your plan starts on ${new Date(client.startDate).toLocaleDateString('en-IN')}.` : '',
          client.endDate ? `Membership valid until ${new Date(client.endDate).toLocaleDateString('en-IN')}.` : '',
          `We’re excited to support your fitness journey. Share your first impressions with us after your first visit.`,
        ].filter(Boolean).join(' '),
        buttonText: 'Share your review',
        buttonUrl: reviewUrl,
        footerText: 'Reply to this email if you have any questions. We’re here to help you stay consistent and strong.',
      });
      const info = await sendTrackedEmail({
        to: recipientEmail,
        subject: 'Welcome to US Gymnasium',
        text: welcomeText,
        html,
        clientId,
        emailType: 'registration',
      });
      emailResult = { sent: true, skipped: false, ...info };
    } catch (err) {
      const publicError = getPublicEmailError(err);
      emailResult = {
        sent: false,
        skipped: false,
        error: publicError.message,
        errorCode: publicError.code,
      };
      console.error('[clients] registration email failed', { clientId, email: recipientEmail, error: emailResult.error, errorCode: emailResult.errorCode });
    }
  }

  res.json({ success: true, message: 'Client registered', client, email: emailResult, counts: getDbCounts(), dbPath: DB_PATH });
}));

// Public client lookup endpoints. These are read-only so the scanner and registration flow can work without admin JWT.
app.get('/api/clients', (_req, res) => {
  const rows = db.prepare('SELECT * FROM clients ORDER BY CAST(clientId AS INTEGER) ASC').all();
  const clients = normalizeClients(rows, true);
  const counts = getDbCounts();
  if (clients.length !== counts.clients) {
    console.error('[db] client count mismatch', { apiRows: clients.length, dbCount: counts.clients, dbPath: DB_PATH });
  }
  console.log('[clients] fetched', { count: clients.length, dbPath: DB_PATH });
  res.json(clients);
});

app.get('/api/clients/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM clients WHERE clientId = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(normalizeClientWithPayments(row));
});

app.put('/api/clients/:id', (req, res) => {
  const fields = ['name','email','phone','dob','address','occupation','emergencyContact','age','gender','membershipType','slot','membershipPeriod','startDate','endDate','membershipStatus','registrationDay','finalAmount','termsAcceptedBy','photo','signature','notes'];
  const sets = []; const vals = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      sets.push(`${f} = @${f}`);
      const value = req.body[f];
      vals[f] = f === 'membershipType' && typeof value !== 'string' ? JSON.stringify(value) : value;
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'No fields' });
  sets.push('updatedAt = @updatedAt');
  vals.updatedAt = new Date().toISOString();
  vals.id = req.params.id;
  db.prepare(`UPDATE clients SET ${sets.join(', ')} WHERE clientId = @id`).run(vals);
  const client = normalizeClientWithPayments(db.prepare('SELECT * FROM clients WHERE clientId = ?').get(req.params.id));
  console.log('[clients] updated', { clientId: req.params.id, dbPath: DB_PATH });
  res.json({ success: true, client });
});

app.delete('/api/clients/:id', (req, res) => {
  db.prepare('DELETE FROM clients WHERE clientId = ?').run(req.params.id);
  db.prepare('DELETE FROM payments WHERE clientId = ?').run(req.params.id);
  console.log('[clients] deleted', { clientId: req.params.id, counts: getDbCounts(), dbPath: DB_PATH });
  res.json({ success: true, message: 'Deleted' });
});

// ---------- Payments ----------
app.post('/api/payments', (req, res) => {
  const p = req.body || {};
  const externalId = p.externalId || `server-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const result = db.prepare(`INSERT INTO payments
    (externalId, clientId, name, amount, finalAmount, paidAmount, membershipPeriod, offerDiscount, discount, discountType, notes, paidDate, updatedAt)
    VALUES (@externalId, @clientId, @name, @amount, @finalAmount, @paidAmount, @membershipPeriod, @offerDiscount, @discount, @discountType, @notes, @paidDate, @updatedAt)`)
    .run({
      externalId,
      clientId: p.clientId,
      name: p.name || '',
      amount: p.amount || 0,
      finalAmount: p.finalAmount || 0,
      paidAmount: p.paidAmount || 0,
      membershipPeriod: p.membershipPeriod || 0,
      offerDiscount: p.offerDiscount || 0,
      discount: p.discount || 0,
      discountType: p.discountType || '',
      notes: p.notes || '',
      paidDate: p.paidDate || new Date().toISOString(),
      updatedAt: now,
    });
  console.log('[payments] recorded', { paymentId: result.lastInsertRowid, clientId: p.clientId, counts: getDbCounts(), dbPath: DB_PATH });
  res.json({ success: true, message: 'Payment recorded', paymentId: result.lastInsertRowid, externalId });
});

app.get('/api/payments/:id', (req, res) => {
  const rows = db.prepare('SELECT * FROM payments WHERE clientId = ? ORDER BY createdAt DESC').all(req.params.id);
  res.json(rows);
});

app.post('/api/sync/members', wrap((req, res) => {
  const operations = Array.isArray(req.body.operations) ? req.body.operations : [];
  const conflicts = [];
  let synced = 0;

  for (const operation of operations) {
    const member = operation.payload || {};
    const clientId = String(member.clientId || '').trim();
    if (!clientId) continue;

    const existing = db.prepare('SELECT * FROM clients WHERE clientId = ?').get(clientId);
    const incomingUpdatedAt = parseSyncTimestamp(member.updatedAt || member.createdAt);
    const existingUpdatedAt = existing?.updatedAt || existing?.createdAt || '';

    if (operation.action === 'delete') {
      if (existing) {
        db.prepare('DELETE FROM clients WHERE clientId = ?').run(clientId);
        db.prepare('DELETE FROM payments WHERE clientId = ?').run(clientId);
        synced += 1;
      }
      continue;
    }

    if (existing) {
      if (isSyncIncomingNewer(incomingUpdatedAt, existingUpdatedAt)) {
        db.prepare(`INSERT OR REPLACE INTO clients
          (id, clientId, name, email, phone, dob, address, occupation, emergencyContact, age, gender, membershipType, slot, membershipPeriod, startDate, endDate, membershipStatus, registrationDay, finalAmount, termsAcceptedBy, photo, signature, notes, createdAt, updatedAt)
          VALUES (@id, @clientId, @name, @email, @phone, @dob, @address, @occupation, @emergencyContact, @age, @gender, @membershipType, @slot, @membershipPeriod, @startDate, @endDate, @membershipStatus, @registrationDay, @finalAmount, @termsAcceptedBy, @photo, @signature, @notes, @createdAt, @updatedAt)`)
          .run({
            id: existing.id,
            clientId,
            name: member.name || existing.name || '',
            email: member.email || existing.email || '',
            phone: member.phone || existing.phone || '',
            dob: member.dob || existing.dob || '',
            address: member.address || existing.address || '',
            occupation: member.occupation || existing.occupation || '',
            emergencyContact: member.emergencyContact || existing.emergencyContact || '',
            age: member.age || existing.age || null,
            gender: member.gender || existing.gender || '',
            membershipType: typeof member.membershipType === 'object' ? JSON.stringify(member.membershipType) : member.membershipType || existing.membershipType || '',
            slot: member.slot || existing.slot || '',
            membershipPeriod: member.membershipPeriod || existing.membershipPeriod || 0,
            startDate: member.startDate || existing.startDate || '',
            endDate: member.endDate || existing.endDate || '',
            membershipStatus: member.membershipStatus || existing.membershipStatus || 'active',
            registrationDay: member.registrationDay || existing.registrationDay || '',
            finalAmount: member.finalAmount ?? existing.finalAmount ?? 0,
            termsAcceptedBy: member.termsAcceptedBy || existing.termsAcceptedBy || '',
            photo: member.photo || existing.photo || '',
            signature: member.signature || existing.signature || '',
            notes: member.notes || existing.notes || '',
            createdAt: existing.createdAt || member.createdAt || new Date().toISOString(),
            updatedAt: incomingUpdatedAt,
          });
        synced += 1;
      } else {
        conflicts.push(makeConflict('client', clientId, incomingUpdatedAt, existingUpdatedAt, operation.action));
      }
    } else {
      db.prepare(`INSERT INTO clients
        (clientId, name, email, phone, dob, address, occupation, emergencyContact, age, gender, membershipType, slot, membershipPeriod, startDate, endDate, membershipStatus, registrationDay, finalAmount, termsAcceptedBy, photo, signature, notes, createdAt, updatedAt)
        VALUES (@clientId, @name, @email, @phone, @dob, @address, @occupation, @emergencyContact, @age, @gender, @membershipType, @slot, @membershipPeriod, @startDate, @endDate, @membershipStatus, @registrationDay, @finalAmount, @termsAcceptedBy, @photo, @signature, @notes, @createdAt, @updatedAt)`)
        .run({
          clientId,
          name: member.name || '',
          email: member.email || '',
          phone: member.phone || '',
          dob: member.dob || '',
          address: member.address || '',
          occupation: member.occupation || '',
          emergencyContact: member.emergencyContact || '',
          age: member.age || null,
          gender: member.gender || '',
          membershipType: typeof member.membershipType === 'object' ? JSON.stringify(member.membershipType) : member.membershipType || '',
          slot: member.slot || '',
          membershipPeriod: member.membershipPeriod || 0,
          startDate: member.startDate || '',
          endDate: member.endDate || '',
          membershipStatus: member.membershipStatus || 'active',
          registrationDay: member.registrationDay || '',
          finalAmount: member.finalAmount ?? 0,
          termsAcceptedBy: member.termsAcceptedBy || '',
          photo: member.photo || '',
          signature: member.signature || '',
          notes: member.notes || '',
          createdAt: member.createdAt || new Date().toISOString(),
          updatedAt: incomingUpdatedAt,
        });
      synced += 1;
    }
  }

  console.log('[sync] members', { synced, conflicts, dbPath: DB_PATH });
  res.json({ success: true, synced, conflicts });
}));

app.post('/api/sync/payments', wrap((req, res) => {
  const operations = Array.isArray(req.body.operations) ? req.body.operations : [];
  const conflicts = [];
  let synced = 0;

  for (const operation of operations) {
    const payment = operation.payload || {};
    const externalId = String(payment.externalId || payment.id || `server-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const existing = db.prepare('SELECT * FROM payments WHERE externalId = ?').get(externalId);
    const incomingUpdatedAt = parseSyncTimestamp(payment.updatedAt || payment.createdAt);
    const existingUpdatedAt = existing?.updatedAt || existing?.createdAt || '';

    if (operation.action === 'delete') {
      if (existing) {
        db.prepare('DELETE FROM payments WHERE externalId = ?').run(externalId);
        synced += 1;
      }
      continue;
    }

    if (existing) {
      if (isSyncIncomingNewer(incomingUpdatedAt, existingUpdatedAt)) {
        db.prepare(`UPDATE payments SET
          clientId = @clientId,
          name = @name,
          amount = @amount,
          finalAmount = @finalAmount,
          paidAmount = @paidAmount,
          membershipPeriod = @membershipPeriod,
          offerDiscount = @offerDiscount,
          discount = @discount,
          discountType = @discountType,
          notes = @notes,
          paidDate = @paidDate,
          updatedAt = @updatedAt
          WHERE externalId = @externalId`)
          .run({
            externalId,
            clientId: payment.clientId || existing.clientId,
            name: payment.name || existing.name || '',
            amount: payment.amount ?? existing.amount ?? 0,
            finalAmount: payment.finalAmount ?? existing.finalAmount ?? 0,
            paidAmount: payment.paidAmount ?? existing.paidAmount ?? 0,
            membershipPeriod: payment.membershipPeriod ?? existing.membershipPeriod ?? 0,
            offerDiscount: payment.offerDiscount ?? existing.offerDiscount ?? 0,
            discount: payment.discount ?? existing.discount ?? 0,
            discountType: payment.discountType || existing.discountType || '',
            notes: payment.notes || existing.notes || '',
            paidDate: payment.paidDate || existing.paidDate || new Date().toISOString(),
            updatedAt: incomingUpdatedAt,
          });
        synced += 1;
      } else {
        conflicts.push(makeConflict('payment', externalId, incomingUpdatedAt, existingUpdatedAt, operation.action));
      }
    } else {
      db.prepare(`INSERT INTO payments
        (externalId, clientId, name, amount, finalAmount, paidAmount, membershipPeriod, offerDiscount, discount, discountType, notes, paidDate, updatedAt)
        VALUES (@externalId, @clientId, @name, @amount, @finalAmount, @paidAmount, @membershipPeriod, @offerDiscount, @discount, @discountType, @notes, @paidDate, @updatedAt)`)
        .run({
          externalId,
          clientId: payment.clientId || '',
          name: payment.name || '',
          amount: payment.amount ?? 0,
          finalAmount: payment.finalAmount ?? 0,
          paidAmount: payment.paidAmount ?? 0,
          membershipPeriod: payment.membershipPeriod ?? 0,
          offerDiscount: payment.offerDiscount ?? 0,
          discount: payment.discount ?? 0,
          discountType: payment.discountType || '',
          notes: payment.notes || '',
          paidDate: payment.paidDate || new Date().toISOString(),
          updatedAt: incomingUpdatedAt,
        });
      synced += 1;
    }
  }

  console.log('[sync] payments', { synced, conflicts, dbPath: DB_PATH });
  res.json({ success: true, synced, conflicts });
}));

app.post('/api/sync/plans', wrap((req, res) => {
  const operations = Array.isArray(req.body.operations) ? req.body.operations : [];
  const conflicts = [];
  let synced = 0;

  for (const operation of operations) {
    const plan = operation.payload || {};
    const externalId = String(plan.externalId || plan.id || `server-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const existing = db.prepare('SELECT * FROM plans WHERE externalId = ?').get(externalId);
    const incomingUpdatedAt = parseSyncTimestamp(plan.updatedAt || plan.createdAt);
    const existingUpdatedAt = existing?.updatedAt || existing?.createdAt || '';

    if (operation.action === 'delete') {
      if (existing) {
        db.prepare('DELETE FROM plans WHERE externalId = ?').run(externalId);
        synced += 1;
      }
      continue;
    }

    if (existing) {
      if (isSyncIncomingNewer(incomingUpdatedAt, existingUpdatedAt)) {
        db.prepare(`UPDATE plans SET
          name = @name,
          description = @description,
          price = @price,
          durationMonths = @durationMonths,
          updatedAt = @updatedAt
          WHERE externalId = @externalId`)
          .run({
            externalId,
            name: plan.name || existing.name || '',
            description: plan.description || existing.description || '',
            price: plan.price ?? existing.price ?? 0,
            durationMonths: plan.durationMonths ?? existing.durationMonths ?? 0,
            updatedAt: incomingUpdatedAt,
          });
        synced += 1;
      } else {
        conflicts.push(makeConflict('plan', externalId, incomingUpdatedAt, existingUpdatedAt, operation.action));
      }
    } else {
      db.prepare(`INSERT INTO plans
        (externalId, name, description, price, durationMonths, updatedAt)
        VALUES (@externalId, @name, @description, @price, @durationMonths, @updatedAt)`)
        .run({
          externalId,
          name: plan.name || '',
          description: plan.description || '',
          price: plan.price ?? 0,
          durationMonths: plan.durationMonths ?? 0,
          updatedAt: incomingUpdatedAt,
        });
      synced += 1;
    }
  }

  console.log('[sync] plans', { synced, conflicts, dbPath: DB_PATH });
  res.json({ success: true, synced, conflicts });
}));

app.post('/api/sync/reports', wrap((req, res) => {
  const operations = Array.isArray(req.body.operations) ? req.body.operations : [];
  const conflicts = [];
  let synced = 0;

  for (const operation of operations) {
    const report = operation.payload || {};
    const reportId = report.id || null;
    const existing = reportId ? db.prepare('SELECT * FROM reviews WHERE id = ?').get(reportId) : null;
    const incomingUpdatedAt = parseSyncTimestamp(report.updatedAt || report.createdAt);
    const existingUpdatedAt = existing?.updatedAt || existing?.createdAt || '';

    if (operation.action === 'delete') {
      if (existing) {
        db.prepare('DELETE FROM reviews WHERE id = ?').run(reportId);
        synced += 1;
      }
      continue;
    }

    if (existing) {
      if (isSyncIncomingNewer(incomingUpdatedAt, existingUpdatedAt)) {
        db.prepare(`UPDATE reviews SET
          clientId = @clientId,
          name = @name,
          rating = @rating,
          feedback = @feedback,
          email = @email,
          updatedAt = @updatedAt
          WHERE id = @id`)
          .run({
            id: existing.id,
            clientId: report.clientId || existing.clientId || null,
            name: report.name || existing.name || '',
            rating: report.rating ?? existing.rating ?? 0,
            feedback: report.feedback || existing.feedback || '',
            email: report.email || existing.email || '',
            updatedAt: incomingUpdatedAt,
          });
        synced += 1;
      } else {
        conflicts.push(makeConflict('report', String(existing.id), incomingUpdatedAt, existingUpdatedAt, operation.action));
      }
    } else {
      db.prepare(`INSERT INTO reviews (clientId, name, rating, feedback, email, updatedAt)
        VALUES (@clientId, @name, @rating, @feedback, @email, @updatedAt)`)
        .run({
          clientId: report.clientId || null,
          name: report.name || '',
          rating: report.rating ?? 0,
          feedback: report.feedback || '',
          email: report.email || '',
          updatedAt: incomingUpdatedAt,
        });
      synced += 1;
    }
  }

  console.log('[sync] reports', { synced, conflicts, dbPath: DB_PATH });
  res.json({ success: true, synced, conflicts });
}));

app.get('/api/sync/updates', (req, res) => {
  const since = req.query.since ? parseSyncTimestamp(String(req.query.since)) : null;
  const members = since
    ? db.prepare('SELECT * FROM clients WHERE updatedAt > ? ORDER BY updatedAt ASC').all(since)
    : db.prepare('SELECT * FROM clients ORDER BY updatedAt ASC').all();
  const payments = since
    ? db.prepare('SELECT * FROM payments WHERE updatedAt > ? ORDER BY updatedAt ASC').all(since)
    : db.prepare('SELECT * FROM payments ORDER BY updatedAt ASC').all();
  const plans = since
    ? db.prepare('SELECT * FROM plans WHERE updatedAt > ? ORDER BY updatedAt ASC').all(since)
    : db.prepare('SELECT * FROM plans ORDER BY updatedAt ASC').all();
  const reports = since
    ? db.prepare('SELECT * FROM reviews WHERE updatedAt > ? ORDER BY updatedAt ASC').all(since)
    : db.prepare('SELECT * FROM reviews ORDER BY updatedAt ASC').all();

  res.json({ members, payments, plans, reports });
});

app.post('/api/renewals', wrap(async (req, res) => {
  const data = req.body || {};
  if (!data.clientId) return res.status(400).json({ error: 'clientId is required' });
  if (!data.name) return res.status(400).json({ error: 'name is required' });
  if (!data.membershipPeriod || data.membershipPeriod < 1) return res.status(400).json({ error: 'membershipPeriod is required' });
  if (!data.startDate) return res.status(400).json({ error: 'startDate is required' });
  if (!data.endDate) return res.status(400).json({ error: 'endDate is required' });
  if (data.finalAmount == null) return res.status(400).json({ error: 'finalAmount is required' });

  const client = db.prepare('SELECT clientId, name FROM clients WHERE clientId = ?').get(data.clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const stmt = db.prepare(`INSERT INTO renewals
    (clientId, name, membershipType, memberSlot, membershipPeriod, startDate, endDate, finalAmount, notes)
    VALUES (@clientId, @name, @membershipType, @memberSlot, @membershipPeriod, @startDate, @endDate, @finalAmount, @notes)`);
  const result = stmt.run({
    clientId: data.clientId,
    name: data.name,
    membershipType: JSON.stringify(data.membershipType || {}),
    memberSlot: data.memberSlot || '',
    membershipPeriod: data.membershipPeriod,
    startDate: data.startDate,
    endDate: data.endDate,
    finalAmount: data.finalAmount,
    notes: data.notes || '',
  });

  const renewal = normalizeRenewal(db.prepare('SELECT * FROM renewals WHERE id = ?').get(result.lastInsertRowid));
  res.json({ success: true, renewal });
}));

app.get('/api/renewals', (_req, res) => {
  const rows = db.prepare(`SELECT r.*, c.name AS clientName FROM renewals r LEFT JOIN clients c ON c.clientId = r.clientId ORDER BY r.createdAt DESC`).all();
  res.json(normalizeRenewals(rows));
});

app.get('/api/renewals/:clientId', (req, res) => {
  const rows = db.prepare(`SELECT r.*, c.name AS clientName FROM renewals r LEFT JOIN clients c ON c.clientId = r.clientId WHERE r.clientId = ? ORDER BY r.createdAt DESC`).all(req.params.clientId);
  res.json(normalizeRenewals(rows));
});

app.post('/api/renewal-payments', (req, res) => {
  const data = req.body || {};
  if (!data.renewalId) return res.status(400).json({ error: 'renewalId is required' });
  if (!data.clientId) return res.status(400).json({ error: 'clientId is required' });
  if (data.paidAmount == null) return res.status(400).json({ error: 'paidAmount is required' });

  const renewal = db.prepare(`
    SELECT r.id, r.clientId, c.name AS client_name
    FROM renewals r
    LEFT JOIN clients c ON c.clientId = r.clientId
    WHERE r.id = ?
  `).get(data.renewalId);
  if (!renewal) return res.status(404).json({ error: 'Renewal not found' });

  const stmt = db.prepare(`INSERT INTO renewal_payments
    (renewalId, clientId, client_name, amount, finalAmount, paidAmount, membershipPeriod, offerDiscount, discount, discountType, notes, paidDate)
    VALUES (@renewalId, @clientId, @client_name, @amount, @finalAmount, @paidAmount, @membershipPeriod, @offerDiscount, @discount, @discountType, @notes, @paidDate)`);
  const result = stmt.run({
    renewalId: data.renewalId,
    clientId: renewal.clientId,
    client_name: renewal.client_name || data.clientName || '',
    amount: data.amount || 0,
    finalAmount: data.finalAmount || 0,
    paidAmount: data.paidAmount,
    membershipPeriod: data.membershipPeriod || 0,
    offerDiscount: data.offerDiscount || 0,
    discount: data.discount || 0,
    discountType: data.discountType || '',
    notes: data.notes || '',
    paidDate: data.paidDate || new Date().toISOString(),
  });
  res.json({ success: true, paymentId: result.lastInsertRowid });
});

app.get('/api/renewal-payments/:renewalId', (req, res) => {
  const rows = db.prepare('SELECT * FROM renewal_payments WHERE renewalId = ? ORDER BY createdAt DESC').all(req.params.renewalId);
  res.json(rows);
});

app.get('/api/renewal-payments', (req, res) => {
  const rows = db.prepare('SELECT * FROM renewal_payments ORDER BY createdAt DESC').all();
  res.json(rows);
});

app.put('/api/renewals/:id', wrap(async (req, res) => {
  const id = req.params.id;
  const data = req.body || {};
  const renewal = db.prepare('SELECT * FROM renewals WHERE id = ?').get(id);
  if (!renewal) return res.status(404).json({ error: 'Renewal not found' });

  const stmt = db.prepare(`UPDATE renewals SET
    membershipType = @membershipType,
    memberSlot = @memberSlot,
    membershipPeriod = @membershipPeriod,
    startDate = @startDate,
    endDate = @endDate,
    finalAmount = @finalAmount,
    notes = @notes
    WHERE id = @id`);
  stmt.run({
    id,
    membershipType: JSON.stringify(data.membershipType || JSON.parse(renewal.membershipType || '{}')),
    memberSlot: data.memberSlot || renewal.memberSlot,
    membershipPeriod: data.membershipPeriod || renewal.membershipPeriod,
    startDate: data.startDate || renewal.startDate,
    endDate: data.endDate || renewal.endDate,
    finalAmount: data.finalAmount != null ? data.finalAmount : renewal.finalAmount,
    notes: data.notes || renewal.notes || '',
  });

  const updatedRenewal = normalizeRenewal(db.prepare('SELECT * FROM renewals WHERE id = ?').get(id));
  res.json({ success: true, renewal: updatedRenewal });
}));

app.post('/api/renewals/:id/email', wrap(async (req, res) => {
  const renewal = db.prepare('SELECT * FROM renewals WHERE id = ?').get(req.params.id);
  if (!renewal) return res.status(404).json({ error: 'Renewal not found' });

  const client = db.prepare('SELECT email, name FROM clients WHERE clientId = ?').get(renewal.clientId);
  if (!client || !client.email) return res.status(404).json({ error: 'Client email not found' });

  const subject = 'US Gymnasium — Membership Renewed';
  const bodyText = [
    `Thank you for renewing your membership with US Gymnasium, ${client.name}!`,
    renewal.memberSlot ? `Workout slot: ${renewal.memberSlot}.` : '',
    renewal.startDate ? `Your renewed plan starts on ${new Date(renewal.startDate).toLocaleDateString('en-IN')}.` : '',
    renewal.endDate ? `Your renewed membership ends on ${new Date(renewal.endDate).toLocaleDateString('en-IN')}.` : '',
    `Total amount: Rs.${renewal.finalAmount?.toLocaleString() || 0}.`,
    'If you have any questions, reply to this email anytime.',
  ].filter(Boolean).join(' ');

  const html = buildEmailHtml({
    headerText: 'Membership Renewed',
    headline: 'Membership Renewed Successfully',
    bodyText,
    footerText: 'We appreciate your continued trust in US Gymnasium.',
  });

  const info = await sendTrackedEmail({
    to: client.email,
    subject,
    text: bodyText,
    html,
    clientId: renewal.clientId,
    emailType: 'renewal',
  });

  res.json({ success: true, message: 'Renewal confirmation email sent', delivery: info });
}));

// Delete a renewal and its associated payments
app.delete('/api/renewals/:id', wrap(async (req, res) => {
  const id = req.params.id;
  const renewal = db.prepare('SELECT id FROM renewals WHERE id = ?').get(id);
  if (!renewal) return res.status(404).json({ error: 'Renewal not found' });

  // Delete associated renewal payments first
  db.prepare('DELETE FROM renewal_payments WHERE renewalId = ?').run(id);
  // Delete the renewal record
  db.prepare('DELETE FROM renewals WHERE id = ?').run(id);

  res.json({ success: true, message: 'Renewal deleted' });
}));

// Backwards-compatible handler: if frontend calls email endpoint with toClientId, resolve recipient
app.post('/api/email/send', wrap(async (req, res) => {
  const { toClientId, to, subject, text, html, emailType } = req.body || {};
  let recipients = String(to || '').trim();
  if (!recipients && toClientId) {
    const c = db.prepare('SELECT email, name FROM clients WHERE clientId = ?').get(toClientId);
    recipients = String(c?.email || '').trim();
  }
  if (!recipients) return res.status(400).json({ error: 'No recipient' });

  const safeText = String(text || '').trim();
  const t = String(emailType || '').toLowerCase();
  const includeReview = t === 'welcome' || t === 'registration';
  const safeHtml = html || buildEmailHtml({
    headerText: subject || 'US Gymnasium',
    headline: subject || 'Hello from US Gymnasium',
    bodyText: safeText || 'Thank you for being part of US Gymnasium. We are here to support your fitness journey.',
    footerText: 'US Gymnasium — stay active, stay healthy.',
    includeReview,
  });

  try {
    const info = await sendTrackedEmail({
      to: recipients,
      subject: subject || 'US Gymnasium',
      text: safeText,
      html: safeHtml,
      clientId: toClientId,
      emailType: emailType || subject || 'email',
    });
    res.json({ success: true, message: 'Email accepted by SMTP server', delivery: info });
  } catch (e) {
    const publicError = getPublicEmailError(e);
    console.error('[email] send failed:', publicError.message, publicError.code);
    res.status(502).json({
      success: false,
      error: publicError.message,
      message: publicError.message,
      errorCode: publicError.code,
    });
  }
}));

app.post('/api/reviews', wrap((req, res) => {
  const { clientId, name, rating, feedback, email } = req.body || {};
  if (!name || typeof rating !== 'number' || !feedback) {
    return res.status(400).json({ error: 'Missing review data' });
  }

  db.prepare(`INSERT INTO reviews (clientId, name, rating, feedback, email, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(clientId || null, name, rating, feedback, email || '', new Date().toISOString());

  res.json({ success: true, message: 'Review recorded' });
}));

app.get('/api/reviews', (req, res) => {
  const rows = db.prepare('SELECT * FROM reviews ORDER BY createdAt DESC').all();
  res.json(rows);
});

// ---------- DB download ----------
app.get('/api/db/download', (_req, res) => {
  db.pragma('wal_checkpoint(TRUNCATE)');
  console.log('[db] download requested', { dbPath: DB_PATH, counts: getDbCounts() });
  res.download(DB_PATH, 'gym.db');
});

app.get('/api/db/status', (_req, res) => {
  db.pragma('wal_checkpoint(TRUNCATE)');
  res.json({
    dbPath: DB_PATH,
    journalMode: db.pragma('journal_mode', { simple: true }),
    counts: getDbCounts(),
  });
});

// Central error-logging middleware (registered after routes)
app.use((err, req, res, next) => {
  console.error('[server error]', err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: err?.message || 'Internal Server Error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] US Gymnasium API listening on http://0.0.0.0:${PORT}`);
  console.log(`[server] Available from local network on http://<PC-IP>:${PORT}`);
});
