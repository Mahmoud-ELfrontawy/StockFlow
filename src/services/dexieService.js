// ============================================================
// STOCKFLOW — DEXIE SERVICE (IndexedDB)
// Replaces localStorage with IndexedDB via Dexie.js.
// All reads/writes go through this service exclusively.
// Schema version: 1
// ============================================================

import Dexie from 'dexie';
import { DATA_VERSION } from '../utils/constants';

// ─── Database Definition ────────────────────────────────────
class StockFlowDB extends Dexie {
  constructor() {
    super('StockFlowDB');

    // Version 1 — initial schema
    // Index syntax: '++' = auto-increment, '&' = unique, '*' = multi-entry
    this.version(1).stores({
      products:             '&id, sku, category, isActive',
      salesmen:             '&id, employeeCode, status',
      stockTransactions:    '&id, productId, salesmanId, type, date, referenceNumber',
      loadingTransactions:  '&id, salesmanId, date, referenceNumber',
      returnTransactions:   '&id, salesmanId, productId, date, referenceNumber, condition',
      damageRecords:        '&id, productId, date, referenceNumber, reviewStatus',
      stocktakingSessions:  '&id, date, status, referenceNumber',
      metadata:             '&key',  // key-value: settings, version, initialized, lastBackup
    });
  }
}

export const db = new StockFlowDB();

// ─── Metadata Helpers ───────────────────────────────────────
async function getMeta(key, defaultValue = null) {
  const row = await db.metadata.get(key);
  return row ? row.value : defaultValue;
}

async function setMeta(key, value) {
  await db.metadata.put({ key, value });
}

// ─── DexieService Class ─────────────────────────────────────
class DexieService {
  // ── Initialization ─────────────────────────────────────
  async isInitialized() {
    return await getMeta('initialized', false);
  }

  async markInitialized() {
    await setMeta('initialized', true);
    await setMeta('schemaVersion', DATA_VERSION);
    await setMeta('createdAt', new Date().toISOString());
  }

  // ── Generic CRUD ───────────────────────────────────────
  async getAll(table) {
    return await db[table].toArray();
  }

  async add(table, record) {
    return await db[table].put(record);
  }

  async put(table, record) {
    return await db[table].put(record);
  }

  async putBulk(table, records) {
    return await db[table].bulkPut(records);
  }

  async getByKey(table, key) {
    return await db[table].get(key);
  }

  async clearTable(table) {
    return await db[table].clear();
  }

  async delete(table, key) {
    return await db[table].delete(key);
  }

  // ── Settings ───────────────────────────────────────────
  async getSettings() {
    return await getMeta('settings', null);
  }

  async saveSettings(settings) {
    await setMeta('settings', settings);
  }

  // ── Atomic Loading Transaction ─────────────────────────
  /**
   * Creates a loading document AND its ledger entries atomically.
   * Rolls back automatically if any step throws.
   */
  async atomicCreateLoading(loadingDoc, ledgerEntries) {
    return await db.transaction('rw',
      db.loadingTransactions,
      db.stockTransactions,
      async () => {
        // Check for duplicate reference number
        const existing = await db.loadingTransactions
          .where('referenceNumber')
          .equals(loadingDoc.referenceNumber)
          .first();
        if (existing) {
          throw new Error(`رقم التحميل ${loadingDoc.referenceNumber} مسجل مسبقاً`);
        }
        await db.loadingTransactions.add(loadingDoc);
        await db.stockTransactions.bulkAdd(ledgerEntries);
      }
    );
  }

  async atomicUpdateLoading(loadingDoc, ledgerEntries) {
    return await db.transaction('rw',
      db.loadingTransactions,
      db.stockTransactions,
      async () => {
        const existing = await db.loadingTransactions.get(loadingDoc.id);
        if (!existing) throw new Error('إذن التحميل غير موجود أو تم حذفه');

        const duplicate = await db.loadingTransactions
          .where('referenceNumber')
          .equals(loadingDoc.referenceNumber)
          .filter((row) => row.id !== loadingDoc.id)
          .first();
        if (duplicate) throw new Error(`رقم التحميل ${loadingDoc.referenceNumber} مسجل مسبقاً`);

        const oldEntries = await db.stockTransactions
          .where('referenceNumber')
          .equals(existing.referenceNumber)
          .filter((tx) => tx.type === 'loading')
          .toArray();
        await db.stockTransactions.bulkDelete(oldEntries.map((tx) => tx.id));
        await db.loadingTransactions.put(loadingDoc);
        if (ledgerEntries.length) await db.stockTransactions.bulkAdd(ledgerEntries);
      }
    );
  }

  // ── Atomic Stock-In Transaction ────────────────────────
  async atomicReceiveStock(ledgerEntries) {
    return await db.transaction('rw',
      db.stockTransactions,
      async () => {
        // Check for duplicate reference
        if (ledgerEntries.length > 0) {
          const ref = ledgerEntries[0].referenceNumber;
          const existing = await db.stockTransactions
            .where('referenceNumber')
            .equals(ref)
            .count();
          if (existing > 0) {
            throw new Error(`رقم الاستلام ${ref} مسجل مسبقاً`);
          }
        }
        await db.stockTransactions.bulkAdd(ledgerEntries);
      }
    );
  }

  async atomicReplaceStockGroup(type, oldReference, ledgerEntries) {
    return await db.transaction('rw', db.stockTransactions, async () => {
      const oldEntries = await db.stockTransactions
        .where('referenceNumber')
        .equals(oldReference)
        .filter((tx) => tx.type === type)
        .toArray();
      if (!oldEntries.length) throw new Error('الإذن غير موجود أو لا يمكن تعديله');

      const oldIds = new Set(oldEntries.map((tx) => tx.id));
      const newReference = ledgerEntries[0]?.referenceNumber;
      if (newReference && newReference !== oldReference) {
        const duplicate = await db.stockTransactions
          .where('referenceNumber')
          .equals(newReference)
          .filter((tx) => !oldIds.has(tx.id))
          .first();
        if (duplicate) throw new Error(`رقم الإذن ${newReference} مستخدم بالفعل`);
      }

      await db.stockTransactions.bulkDelete([...oldIds]);
      if (ledgerEntries.length) await db.stockTransactions.bulkAdd(ledgerEntries);
    });
  }

  async atomicReplaceReturnBatch(referenceNumber, returnDocs, ledgerEntries) {
    return await db.transaction('rw', db.returnTransactions, db.stockTransactions, async () => {
      const oldReturns = await db.returnTransactions
        .where('referenceNumber')
        .equals(referenceNumber)
        .toArray();
      if (!oldReturns.length) throw new Error('إذن المرتجع غير موجود أو لا يمكن تعديله');

      const oldLedger = await db.stockTransactions
        .where('referenceNumber')
        .equals(referenceNumber)
        .filter((tx) => ['return_replacement', 'return_good', 'return_damaged'].includes(tx.type))
        .toArray();

      if (returnDocs[0]?.referenceNumber !== referenceNumber) {
        const duplicate = await db.returnTransactions
          .where('referenceNumber')
          .equals(returnDocs[0]?.referenceNumber)
          .first();
        if (duplicate) throw new Error(`رقم المرتجع ${returnDocs[0].referenceNumber} مستخدم بالفعل`);
      }

      await db.returnTransactions.bulkDelete(oldReturns.map((row) => row.id));
      await db.stockTransactions.bulkDelete(oldLedger.map((tx) => tx.id));
      if (returnDocs.length) await db.returnTransactions.bulkAdd(returnDocs);
      if (ledgerEntries.length) await db.stockTransactions.bulkAdd(ledgerEntries);
    });
  }

  async atomicUpdateDamage(damageDoc, ledgerEntry) {
    return await db.transaction('rw', db.damageRecords, db.stockTransactions, async () => {
      const existing = await db.damageRecords.get(damageDoc.id);
      if (!existing) throw new Error('سجل التالف غير موجود أو تم حذفه');
      const oldEntries = await db.stockTransactions
        .where('referenceNumber')
        .equals(existing.referenceNumber)
        .filter((tx) => tx.type === 'damage')
        .toArray();
      await db.stockTransactions.bulkDelete(oldEntries.map((tx) => tx.id));
      await db.damageRecords.put(damageDoc);
      if (ledgerEntry) await db.stockTransactions.add(ledgerEntry);
    });
  }

  // ── Atomic Return Transaction ──────────────────────────
  async atomicRecordReturn(returnDoc, ledgerEntry) {
    return await db.transaction('rw',
      db.returnTransactions,
      db.stockTransactions,
      async () => {
        await db.returnTransactions.add(returnDoc);
        if (ledgerEntry) {
          await db.stockTransactions.add(ledgerEntry);
        }
      }
    );
  }

  // ── Atomic Multiple Returns Transaction ─────────────────
  async atomicRecordReturns(returnDocs, ledgerEntries) {
    return await db.transaction('rw',
      db.returnTransactions,
      db.stockTransactions,
      async () => {
        if (returnDocs && returnDocs.length > 0) {
          await db.returnTransactions.bulkAdd(returnDocs);
        }
        if (ledgerEntries && ledgerEntries.length > 0) {
          await db.stockTransactions.bulkAdd(ledgerEntries);
        }
      }
    );
  }

  // ── Atomic Approve Pending Return ─────────────────────
  async atomicApproveReturn(returnId, updatedReturn, ledgerEntries) {
    const entries = Array.isArray(ledgerEntries)
      ? ledgerEntries.filter(Boolean)
      : ledgerEntries
      ? [ledgerEntries]
      : [];

    return await db.transaction('rw',
      db.returnTransactions,
      db.stockTransactions,
      async () => {
        await db.returnTransactions.put(updatedReturn);
        if (entries.length > 0) {
          await db.stockTransactions.bulkAdd(entries);
        }
      }
    );
  }

  // ── Atomic Dispatch Company Returns ───────────────────
  async atomicDispatchCompanyReturns(ledgerEntries) {
    const entries = Array.isArray(ledgerEntries) ? ledgerEntries : [ledgerEntries];
    return await db.transaction('rw',
      db.stockTransactions,
      async () => {
        if (entries.length > 0) {
          await db.stockTransactions.bulkAdd(entries);
        }
      }
    );
  }

  async atomicUpdateStockTransaction(transaction) {
    return await db.transaction('rw', db.stockTransactions, async () => {
      const current = await db.stockTransactions.get(transaction.id);
      if (!current) throw new Error('حركة المخزون غير موجودة أو تم حذفها');
      await db.stockTransactions.put(transaction);
    });
  }

  // ── Atomic Damage Record ───────────────────────────────
  async atomicRecordDamage(damageDoc, ledgerEntry) {
    return await db.transaction('rw',
      db.damageRecords,
      db.stockTransactions,
      async () => {
        await db.damageRecords.add(damageDoc);
        if (ledgerEntry) {
          await db.stockTransactions.add(ledgerEntry);
        }
      }
    );
  }

  // ── Atomic Stocktaking Approval ────────────────────────
  async atomicApproveStocktaking(sessionId, updatedSession, adjustmentEntries) {
    return await db.transaction('rw',
      db.stocktakingSessions,
      db.stockTransactions,
      async () => {
        const current = await db.stocktakingSessions.get(sessionId);
        if (!current || current.status !== 'pending') {
          throw new Error('جلسة الجرد لم تعد قيد المراجعة');
        }
        await db.stocktakingSessions.put(updatedSession);
        if (adjustmentEntries && adjustmentEntries.length > 0) {
          await db.stockTransactions.bulkAdd(adjustmentEntries);
        }
      }
    );
  }

  async atomicUpdateApprovedStocktaking(sessionId, updatedSession, adjustmentEntries) {
    return await db.transaction('rw',
      db.stocktakingSessions,
      db.stockTransactions,
      async () => {
        const current = await db.stocktakingSessions.get(sessionId);
        if (!current || current.status !== 'approved') {
          throw new Error('Stocktaking session is no longer approved');
        }
        const oldAdjustments = await db.stockTransactions
          .where('referenceNumber')
          .equals(current.referenceNumber)
          .filter((tx) => tx.type === 'adjustment')
          .toArray();
        await db.stockTransactions.bulkDelete(oldAdjustments.map((tx) => tx.id));
        await db.stocktakingSessions.put(updatedSession);
        if (adjustmentEntries.length) await db.stockTransactions.bulkAdd(adjustmentEntries);
      }
    );
  }

  // ── Full Backup Export ─────────────────────────────────
  async exportBackup() {
    const [
      products,
      salesmen,
      stockTransactions,
      loadingTransactions,
      returnTransactions,
      damageRecords,
      stocktakingSessions,
      settings,
      schemaVersion,
      createdAt,
    ] = await Promise.all([
      db.products.toArray(),
      db.salesmen.toArray(),
      db.stockTransactions.toArray(),
      db.loadingTransactions.toArray(),
      db.returnTransactions.toArray(),
      db.damageRecords.toArray(),
      db.stocktakingSessions.toArray(),
      this.getSettings(),
      getMeta('schemaVersion', DATA_VERSION),
      getMeta('createdAt', new Date().toISOString()),
    ]);

    const backup = {
      appName: 'StockFlow',
      appVersion: DATA_VERSION,
      schemaVersion,
      exportedAt: new Date().toISOString(),
      dbCreatedAt: createdAt,
      recordCounts: {
        products: products.length,
        salesmen: salesmen.length,
        stockTransactions: stockTransactions.length,
        loadingTransactions: loadingTransactions.length,
        returnTransactions: returnTransactions.length,
        damageRecords: damageRecords.length,
        stocktakingSessions: stocktakingSessions.length,
      },
      data: {
        products,
        salesmen,
        stockTransactions,
        loadingTransactions,
        returnTransactions,
        damageRecords,
        stocktakingSessions,
        settings,
      },
    };

    // Record last backup time
    await setMeta('lastBackupAt', backup.exportedAt);

    return backup;
  }

  // ── Full Restore from Backup ───────────────────────────
  async importBackup(backup) {
    // Validate structure
    if (!backup || typeof backup !== 'object') {
      throw new Error('الملف ليس ملف نسخة احتياطية صالح');
    }
    if (!backup.appName || backup.appName !== 'StockFlow') {
      throw new Error('هذا الملف ليس نسخة احتياطية من StockFlow');
    }
    if (!backup.data) {
      throw new Error('بنية الملف غير صحيحة: لا توجد بيانات');
    }

    const requiredKeys = ['products', 'salesmen', 'stockTransactions', 'loadingTransactions'];
    for (const key of requiredKeys) {
      if (!Array.isArray(backup.data[key])) {
        throw new Error(`البيانات ناقصة: ${key} غير موجودة`);
      }
    }

    // Atomic full restore — all tables or none
    return await db.transaction('rw',
      db.products,
      db.salesmen,
      db.stockTransactions,
      db.loadingTransactions,
      db.returnTransactions,
      db.damageRecords,
      db.stocktakingSessions,
      db.metadata,
      async () => {
        await db.products.clear();
        await db.salesmen.clear();
        await db.stockTransactions.clear();
        await db.loadingTransactions.clear();
        await db.returnTransactions.clear();
        await db.damageRecords.clear();
        await db.stocktakingSessions.clear();

        const d = backup.data;
        if (d.products?.length)            await db.products.bulkAdd(d.products);
        if (d.salesmen?.length)            await db.salesmen.bulkAdd(d.salesmen);
        if (d.stockTransactions?.length)   await db.stockTransactions.bulkAdd(d.stockTransactions);
        if (d.loadingTransactions?.length) await db.loadingTransactions.bulkAdd(d.loadingTransactions);
        if (d.returnTransactions?.length)  await db.returnTransactions.bulkAdd(d.returnTransactions);
        if (d.damageRecords?.length)       await db.damageRecords.bulkAdd(d.damageRecords);
        if (d.stocktakingSessions?.length) await db.stocktakingSessions.bulkAdd(d.stocktakingSessions);
        if (d.settings)                    await setMeta('settings', d.settings);

        await setMeta('initialized', true);
        await setMeta('schemaVersion', backup.schemaVersion || DATA_VERSION);
        await setMeta('restoredAt', new Date().toISOString());
        await setMeta('restoredFrom', backup.exportedAt);
      }
    );
  }

  // ── Seed Demo Data ─────────────────────────────────────
  async seedDemoData(initialProducts, initialSalesmen, initialTransactions, settings) {
    return await db.transaction('rw',
      db.products,
      db.salesmen,
      db.stockTransactions,
      db.loadingTransactions,
      db.returnTransactions,
      db.damageRecords,
      db.stocktakingSessions,
      db.metadata,
      async () => {
        await db.products.bulkAdd(initialProducts);
        await db.salesmen.bulkAdd(initialSalesmen);
        if (initialTransactions.stockTransactions?.length)
          await db.stockTransactions.bulkAdd(initialTransactions.stockTransactions);
        if (initialTransactions.loadingTransactions?.length)
          await db.loadingTransactions.bulkAdd(initialTransactions.loadingTransactions);
        if (initialTransactions.returnTransactions?.length)
          await db.returnTransactions.bulkAdd(initialTransactions.returnTransactions);
        if (initialTransactions.damageRecords?.length)
          await db.damageRecords.bulkAdd(initialTransactions.damageRecords);
        await setMeta('settings', settings);
        await this.markInitialized();
      }
    );
  }

  // ── Clear All Data ─────────────────────────────────────
  async clearAll() {
    return await db.transaction('rw',
      db.products,
      db.salesmen,
      db.stockTransactions,
      db.loadingTransactions,
      db.returnTransactions,
      db.damageRecords,
      db.stocktakingSessions,
      db.metadata,
      async () => {
        await db.products.clear();
        await db.salesmen.clear();
        await db.stockTransactions.clear();
        await db.loadingTransactions.clear();
        await db.returnTransactions.clear();
        await db.damageRecords.clear();
        await db.stocktakingSessions.clear();
        await db.metadata.clear();
      }
    );
  }

  // ── Storage Estimate ───────────────────────────────────
  async getStorageEstimate() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const { usage, quota } = await navigator.storage.estimate();
        return { usage, quota, supported: true };
      } catch {
        return { usage: 0, quota: 0, supported: false };
      }
    }
    return { usage: 0, quota: 0, supported: false };
  }

  async requestPersistentStorage() {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        const persisted = await navigator.storage.persist();
        return { persisted, supported: true };
      } catch {
        return { persisted: false, supported: false };
      }
    }
    return { persisted: false, supported: false };
  }

  // ── Backup Reminder ────────────────────────────────────
  async getLastBackupAge() {
    const lastBackupAt = await getMeta('lastBackupAt', null);
    if (!lastBackupAt) return { daysSince: Infinity, lastBackupAt: null };
    const diff = Date.now() - new Date(lastBackupAt).getTime();
    const daysSince = Math.floor(diff / (1000 * 60 * 60 * 24));
    return { daysSince, lastBackupAt };
  }

  // ── Integrity Check ────────────────────────────────────
  async runIntegrityCheck() {
    const [products, stockTransactions] = await Promise.all([
      db.products.toArray(),
      db.stockTransactions.toArray(),
    ]);

    const { TRANSACTION_TYPES } = await import('../utils/constants');
    const { calculateWarehouseStock } = await import('../utils/stockCalculations');

    const issues = [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Check 1: Orphan transactions (product not found)
    for (const tx of stockTransactions) {
      if (!productMap.has(tx.productId)) {
        issues.push({
          type: 'orphan_transaction',
          severity: 'warning',
          message: `حركة ${tx.referenceNumber} تشير إلى منتج غير موجود: ${tx.productId}`,
          txId: tx.id,
        });
      }
      // Check 2: Invalid quantities
      if (!tx.quantityPieces || tx.quantityPieces <= 0) {
        issues.push({
          type: 'invalid_quantity',
          severity: 'error',
          message: `حركة ${tx.referenceNumber} تحتوي على كمية غير صالحة: ${tx.quantityPieces}`,
          txId: tx.id,
        });
      }
    }

    // Check 3: Duplicate transaction IDs
    const idSeen = new Set();
    for (const tx of stockTransactions) {
      if (idSeen.has(tx.id)) {
        issues.push({
          type: 'duplicate_id',
          severity: 'error',
          message: `معرف مكرر في حركات المخزن: ${tx.id}`,
        });
      }
      idSeen.add(tx.id);
    }

    // Check 4: Negative balances (data inconsistency)
    for (const product of products) {
      const balance = calculateWarehouseStock(product.id, stockTransactions);
      if (balance < 0) {
        issues.push({
          type: 'negative_balance',
          severity: 'error',
          message: `رصيد المنتج "${product.name}" سالب (${balance}) — تعارض في البيانات`,
          productId: product.id,
        });
      }
    }

    return {
      checkedAt: new Date().toISOString(),
      totalTransactions: stockTransactions.length,
      totalProducts: products.length,
      issueCount: issues.length,
      issues,
      isClean: issues.length === 0,
    };
  }
}

export const dexieService = new DexieService();
