import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Client, Payment, Plan, SyncOperation } from '@/types/gym';

const LOCAL_STORAGE_PREFIX = 'usgym_';

interface LocalRepositoryOptions {
  databaseName?: string;
}

let sqliteConnection: SQLiteConnection | null = null;
let dbConnection: SQLiteDBConnection | null = null;

function isNativePlatform() {
  return Capacitor.getPlatform() !== 'web';
}

function createFallbackKey(key: string) {
  return `${LOCAL_STORAGE_PREFIX}${key}`;
}

function makeUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function ensureSqliteColumn(db: SQLiteDBConnection, table: string, column: string, definition: string) {
  const info = await db.query(`PRAGMA table_info(${table})`);
  const columns = (info.values || []).map((row: any) => row.name);
  if (!columns.includes(column)) {
    await db.execute({ statements: `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}` });
  }
}

async function openSqlite() {
  if (!sqliteConnection) {
    sqliteConnection = new SQLiteConnection(CapacitorSQLite);
  }
  dbConnection = await sqliteConnection.createConnection({
    database: 'us_gym_db',
    version: 1,
    encrypted: false,
    mode: 'no-encryption',
  });
  await dbConnection.open();
  return dbConnection;
}

async function initSqlite() {
  if (!isNativePlatform()) return;
  const db = await openSqlite();
  await db.execute({
    statements: `CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId TEXT UNIQUE,
      name TEXT,
      email TEXT,
      phone TEXT,
      dob TEXT,
      address TEXT,
      occupation TEXT,
      emergencyContact TEXT,
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
      createdAt TEXT,
      updatedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      externalId TEXT UNIQUE,
      clientId TEXT,
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
      createdAt TEXT,
      updatedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      externalId TEXT UNIQUE,
      name TEXT,
      description TEXT,
      price REAL,
      durationMonths INTEGER,
      createdAt TEXT,
      updatedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      entity TEXT,
      action TEXT,
      payload TEXT,
      updatedAt TEXT,
      status TEXT,
      createdAt TEXT
    );
    `,
  });
  await ensureSqliteColumn(db, 'clients', 'membershipStatus', 'TEXT');
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const localRepository = {
  async initialize() {
    if (isNativePlatform()) {
      await initSqlite();
    }
  },

  async getClients(): Promise<Client[]> {
    if (isNativePlatform() && dbConnection) {
      const res = await dbConnection.query('SELECT * FROM clients ORDER BY createdAt DESC');
      const paymentRes = await dbConnection.query('SELECT * FROM payments ORDER BY createdAt DESC');
      const payments = (paymentRes.values || []) as Payment[];
      return (res.values as any[]).map((row) => ({
        ...row,
        membershipType: typeof row.membershipType === 'string' ? JSON.parse(row.membershipType) : row.membershipType,
        payments: payments.filter((payment) => payment.clientId === row.clientId),
      })) as Client[];
    }
    const clients = parseJson<Client[]>(localStorage.getItem(createFallbackKey('clients')), []);
    const payments = parseJson<Payment[]>(localStorage.getItem(createFallbackKey('payments')), []);
    return clients.map((client) => ({
      ...client,
      payments: payments.filter((payment) => payment.clientId === client.clientId),
    }));
  },

  async saveClient(client: Client, options?: { preserveUpdatedAt?: boolean }): Promise<void> {
    const now = new Date().toISOString();
    const updatedAt = options?.preserveUpdatedAt ? client.updatedAt || now : now;
    client.updatedAt = updatedAt;
    if (isNativePlatform() && dbConnection) {
      const payload = JSON.stringify(client.membershipType || {});
      await dbConnection.run(
        `INSERT OR REPLACE INTO clients (id, clientId, name, email, phone, dob, address, occupation, emergencyContact, gender, membershipType, slot, membershipPeriod, startDate, endDate, membershipStatus, registrationDay, finalAmount, termsAcceptedBy, photo, signature, notes, createdAt, updatedAt)
         VALUES (@id, @clientId, @name, @email, @phone, @dob, @address, @occupation, @emergencyContact, @gender, @membershipType, @slot, @membershipPeriod, @startDate, @endDate, @membershipStatus, @registrationDay, @finalAmount, @termsAcceptedBy, @photo, @signature, @notes, @createdAt, @updatedAt)`,
        {
          id: client.id || null,
          clientId: client.clientId,
          name: client.name,
          email: client.email,
          phone: client.phone,
          dob: client.dob,
          address: client.address,
          occupation: client.occupation,
          emergencyContact: client.emergencyContact || '',
          gender: client.gender || '',
          membershipType: payload,
          slot: client.slot,
          membershipPeriod: client.membershipPeriod,
          startDate: client.startDate,
          endDate: client.endDate,
          membershipStatus: client.membershipStatus || 'active',
          registrationDay: client.registrationDay,
          finalAmount: client.finalAmount || 0,
          termsAcceptedBy: client.termsAcceptedBy || '',
          photo: client.photo || '',
          signature: client.signature || '',
          notes: client.notes || '',
          createdAt: client.createdAt || now,
          updatedAt,
        }
      );
      return;
    }

    const current = await this.getClients();
    const existingIndex = current.findIndex((item) => item.clientId === client.clientId);
    if (existingIndex >= 0) {
      current[existingIndex] = { ...current[existingIndex], ...client, updatedAt };
    } else {
      current.unshift({ ...client, createdAt: client.createdAt || now, updatedAt });
    }
    localStorage.setItem(createFallbackKey('clients'), JSON.stringify(current));
  },

  async deleteClient(clientId: string): Promise<void> {
    if (isNativePlatform() && dbConnection) {
      await dbConnection.run('DELETE FROM clients WHERE clientId = ?', [clientId]);
      await dbConnection.run('DELETE FROM payments WHERE clientId = ?', [clientId]);
      return;
    }
    const current = await this.getClients();
    const updated = current.filter((item) => item.clientId !== clientId);
    localStorage.setItem(createFallbackKey('clients'), JSON.stringify(updated));
  },

  async getPayments(clientId?: string): Promise<Payment[]> {
    if (isNativePlatform() && dbConnection) {
      if (clientId) {
        const res = await dbConnection.query('SELECT * FROM payments WHERE clientId = ? ORDER BY createdAt DESC', [clientId]);
        return res.values as Payment[];
      }
      const res = await dbConnection.query('SELECT * FROM payments ORDER BY createdAt DESC');
      return res.values as Payment[];
    }
    const current = parseJson<Payment[]>(localStorage.getItem(createFallbackKey('payments')), []);
    return clientId ? current.filter((payment) => payment.clientId === clientId) : current;
  },

  async savePayment(payment: Payment, options?: { preserveUpdatedAt?: boolean }): Promise<void> {
    const now = new Date().toISOString();
    const updatedAt = options?.preserveUpdatedAt ? payment.updatedAt || now : now;
    payment.updatedAt = updatedAt;
    payment.externalId = payment.externalId || makeUuid();
    if (isNativePlatform() && dbConnection) {
      await dbConnection.run(
        `INSERT OR REPLACE INTO payments (id, externalId, clientId, name, amount, finalAmount, paidAmount, membershipPeriod, offerDiscount, discount, discountType, notes, paidDate, createdAt, updatedAt)
         VALUES (@id, @externalId, @clientId, @name, @amount, @finalAmount, @paidAmount, @membershipPeriod, @offerDiscount, @discount, @discountType, @notes, @paidDate, @createdAt, @updatedAt)`,
        {
          id: payment.id || null,
          externalId: payment.externalId,
          clientId: payment.clientId,
          name: payment.name || '',
          amount: payment.amount,
          finalAmount: payment.finalAmount,
          paidAmount: payment.paidAmount,
          membershipPeriod: payment.membershipPeriod || 0,
          offerDiscount: payment.offerDiscount || 0,
          discount: payment.discount || 0,
          discountType: payment.discountType || '',
          notes: payment.notes || '',
          paidDate: payment.paidDate || now,
          createdAt: payment.createdAt || now,
          updatedAt,
        }
      );
      return;
    }

    const current = parseJson<Payment[]>(localStorage.getItem(createFallbackKey('payments')), []);
    const existingIndex = current.findIndex((item) => item.externalId === payment.externalId || item.id === payment.id);
    if (existingIndex >= 0) {
      current[existingIndex] = { ...current[existingIndex], ...payment, updatedAt };
    } else {
      current.unshift({ ...payment, createdAt: payment.createdAt || now, updatedAt, externalId: payment.externalId });
    }
    localStorage.setItem(createFallbackKey('payments'), JSON.stringify(current));
  },

  async getPlans(): Promise<Plan[]> {
    if (isNativePlatform() && dbConnection) {
      const res = await dbConnection.query('SELECT * FROM plans ORDER BY createdAt DESC');
      return res.values as Plan[];
    }
    return parseJson<Plan[]>(localStorage.getItem(createFallbackKey('plans')), []);
  },

  async savePlan(plan: Plan, options?: { preserveUpdatedAt?: boolean }): Promise<void> {
    const now = new Date().toISOString();
    const updatedAt = options?.preserveUpdatedAt ? plan.updatedAt || now : now;
    plan.updatedAt = updatedAt;
    plan.externalId = plan.externalId || makeUuid();
    if (isNativePlatform() && dbConnection) {
      await dbConnection.run(
        `INSERT OR REPLACE INTO plans (id, externalId, name, description, price, durationMonths, createdAt, updatedAt)
         VALUES (@id, @externalId, @name, @description, @price, @durationMonths, @createdAt, @updatedAt)`,
        {
          id: plan.id || null,
          externalId: plan.externalId,
          name: plan.name,
          description: plan.description || '',
          price: plan.price,
          durationMonths: plan.durationMonths,
          createdAt: plan.createdAt || now,
          updatedAt,
        }
      );
      return;
    }

    const current = await this.getPlans();
    const existingIndex = current.findIndex((item) => item.externalId === plan.externalId || item.id === plan.id);
    if (existingIndex >= 0) {
      current[existingIndex] = { ...current[existingIndex], ...plan, updatedAt };
    } else {
      current.unshift({ ...plan, createdAt: plan.createdAt || now, updatedAt, externalId: plan.externalId });
    }
    localStorage.setItem(createFallbackKey('plans'), JSON.stringify(current));
  },

  async deletePlan(planId: number): Promise<void> {
    if (isNativePlatform() && dbConnection) {
      await dbConnection.run('DELETE FROM plans WHERE id = ?', [planId]);
      return;
    }
    const current = await this.getPlans();
    const updated = current.filter((plan) => plan.id !== planId);
    localStorage.setItem(createFallbackKey('plans'), JSON.stringify(updated));
  },

  async addSyncOperation(operation: SyncOperation): Promise<void> {
    const now = new Date().toISOString();
    if (isNativePlatform() && dbConnection) {
      await dbConnection.run(
        `INSERT OR REPLACE INTO sync_queue (id, entity, action, payload, updatedAt, status, createdAt)
         VALUES (@id, @entity, @action, @payload, @updatedAt, @status, @createdAt)`,
        {
          id: operation.id,
          entity: operation.entity,
          action: operation.action,
          payload: JSON.stringify(operation.payload),
          updatedAt: operation.updatedAt || now,
          status: operation.status || 'pending',
          createdAt: operation.createdAt || now,
        }
      );
      return;
    }

    const queued: SyncOperation[] = parseJson(localStorage.getItem(createFallbackKey('sync_queue')), []);
    queued.push({ ...operation, status: 'pending', createdAt: now, updatedAt: operation.updatedAt || now });
    localStorage.setItem(createFallbackKey('sync_queue'), JSON.stringify(queued));
  },

  async getPendingSyncOperations(): Promise<SyncOperation[]> {
    if (isNativePlatform() && dbConnection) {
      const res = await dbConnection.query(
        'SELECT * FROM sync_queue WHERE status IN ("pending", "failed") ORDER BY createdAt ASC'
      );
      return (res.values as any[]).map((item) => ({
        ...item,
        payload: typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload,
      })) as SyncOperation[];
    }

    return parseJson<SyncOperation[]>(localStorage.getItem(createFallbackKey('sync_queue')), []).filter(
      (item) => item.status === 'pending' || item.status === 'failed'
    );
  },

  async clearSyncOperation(id: string): Promise<void> {
    if (isNativePlatform() && dbConnection) {
      await dbConnection.run('DELETE FROM sync_queue WHERE id = ?', [id]);
      return;
    }

    const queued: SyncOperation[] = parseJson(localStorage.getItem(createFallbackKey('sync_queue')), []);
    const remaining = queued.filter((item) => item.id !== id);
    localStorage.setItem(createFallbackKey('sync_queue'), JSON.stringify(remaining));
  },
};
