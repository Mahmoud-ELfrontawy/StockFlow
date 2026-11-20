// ============================================================
// STOCKFLOW — INVENTORY STORE (Zustand + Dexie/IndexedDB)
// All persistence goes through dexieService — atomic, reliable.
// ============================================================

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { dexieService } from '../services/dexieService';
import {
  TRANSACTION_TYPES,
  RETURN_CONDITIONS,
  DEFAULT_SETTINGS,
} from '../utils/constants';
import {
  calculateWarehouseStock,
  validateStockAvailability,
} from '../utils/stockCalculations';
import { nowISO, todayISO } from '../utils/formatters';
import { initialProducts } from '../data/initialProducts';
import { initialSalesmen } from '../data/initialSalesmen';
import {
  initialStockTransactions,
  initialLoadingTransactions,
  initialReturnTransactions,
  initialDamageRecords,
} from '../data/initialInventory';

// ─── Helper: generate a timestamp-safe reference number ──────
// Uses current count + timestamp suffix to prevent collisions after restore
function generateRef(prefix, existingItems) {
  const count = (existingItems?.length || 0) + 1;
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}-${String(count).padStart(4, '0')}-${ts}`;
}

// ─── Store Definition ─────────────────────────────────────────
const useInventoryStore = create((set, get) => ({
  // ─── State ───────────────────────────────────────────────────
  products: [],
  salesmen: [],
  stockTransactions: [],
  loadingTransactions: [],
  returnTransactions: [],
  damageRecords: [],
  stocktakingSessions: [],
  settings: DEFAULT_SETTINGS,
  isLoaded: false,
  dbError: null,

  // ─── INITIALIZATION ──────────────────────────────────────────
  initialize: async () => {
    try {
      const initialized = await dexieService.isInitialized();

      if (!initialized) {
        // Seed demo data atomically via Dexie transaction
        await dexieService.seedDemoData(
          initialProducts,
          initialSalesmen,
          {
            stockTransactions: initialStockTransactions,
            loadingTransactions: initialLoadingTransactions,
            returnTransactions: initialReturnTransactions,
            damageRecords: initialDamageRecords,
          },
          DEFAULT_SETTINGS
        );
      }

      // Load all data into Zustand state
      const [
        products,
        salesmen,
        stockTransactions,
        loadingTransactions,
        returnTransactions,
        damageRecords,
        stocktakingSessions,
        settings,
      ] = await Promise.all([
        dexieService.getAll('products'),
        dexieService.getAll('salesmen'),
        dexieService.getAll('stockTransactions'),
        dexieService.getAll('loadingTransactions'),
        dexieService.getAll('returnTransactions'),
        dexieService.getAll('damageRecords'),
        dexieService.getAll('stocktakingSessions'),
        dexieService.getSettings(),
      ]);

      // Request persistent storage on first run
      if (!initialized) {
        dexieService.requestPersistentStorage().catch(() => {});
      }

      set({
        products,
        salesmen,
        stockTransactions,
        loadingTransactions,
        returnTransactions,
        damageRecords,
        stocktakingSessions,
        settings: settings || DEFAULT_SETTINGS,
        isLoaded: true,
        dbError: null,
      });
    } catch (err) {
      console.error('[Store] initialize failed:', err);
      set({ isLoaded: true, dbError: err.message });
    }
  },

  // ─── Reload from DB (after backup restore etc.) ───────────────
  _reload: async () => {
    const [
      products,
      salesmen,
      stockTransactions,
      loadingTransactions,
      returnTransactions,
      damageRecords,
      stocktakingSessions,
      settings,
    ] = await Promise.all([
      dexieService.getAll('products'),
      dexieService.getAll('salesmen'),
      dexieService.getAll('stockTransactions'),
      dexieService.getAll('loadingTransactions'),
      dexieService.getAll('returnTransactions'),
      dexieService.getAll('damageRecords'),
      dexieService.getAll('stocktakingSessions'),
      dexieService.getSettings(),
    ]);
    set({
      products,
      salesmen,
      stockTransactions,
      loadingTransactions,
      returnTransactions,
      damageRecords,
      stocktakingSessions,
      settings: settings || DEFAULT_SETTINGS,
    });
  },

  // ══════════════════════════════════════════════════════════════
  // PRODUCTS
  // ══════════════════════════════════════════════════════════════

  addProduct: async (data) => {
    const newProduct = {
      id: `prod-${uuidv4().slice(0, 8)}`,
      ...data,
      isActive: true,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    await dexieService.put('products', newProduct);
    set((s) => ({ products: [...s.products, newProduct] }));
    return newProduct;
  },

  updateProduct: async (id, data) => {
    const products = get().products.map((p) =>
      p.id === id ? { ...p, ...data, updatedAt: nowISO() } : p
    );
    const updated = products.find((p) => p.id === id);
    await dexieService.put('products', updated);
    set({ products });
  },

  toggleProductStatus: async (id) => {
    const products = get().products.map((p) =>
      p.id === id ? { ...p, isActive: !p.isActive, updatedAt: nowISO() } : p
    );
    const updated = products.find((p) => p.id === id);
    await dexieService.put('products', updated);
    set({ products });
  },

  getProductById: (id) => get().products.find((p) => p.id === id),

  // ══════════════════════════════════════════════════════════════
  // SALESMEN
  // ══════════════════════════════════════════════════════════════

  addSalesman: async (data) => {
    const newSalesman = {
      id: `sm-${uuidv4().slice(0, 8)}`,
      ...data,
      status: 'active',
      createdAt: nowISO(),
    };
    await dexieService.put('salesmen', newSalesman);
    set((s) => ({ salesmen: [...s.salesmen, newSalesman] }));
    return newSalesman;
  },

  updateSalesman: async (id, data) => {
    const salesmen = get().salesmen.map((s) =>
      s.id === id ? { ...s, ...data } : s
    );
    const updated = salesmen.find((s) => s.id === id);
    await dexieService.put('salesmen', updated);
    set({ salesmen });
  },

  toggleSalesmanStatus: async (id) => {
    const salesmen = get().salesmen.map((s) =>
      s.id === id
        ? { ...s, status: s.status === 'active' ? 'inactive' : 'active' }
        : s
    );
    const updated = salesmen.find((s) => s.id === id);
    await dexieService.put('salesmen', updated);
    set({ salesmen });
  },

  getSalesmanById: (id) => get().salesmen.find((s) => s.id === id),

  // ══════════════════════════════════════════════════════════════
  // STOCK IN  — Atomic via Dexie transaction
  // ══════════════════════════════════════════════════════════════

  receiveStock: async ({ date, referenceNumber, supplier, notes, items }) => {
    const { products, stockTransactions } = get();

    // Validate
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return { success: false, message: `منتج غير موجود: ${item.productId}` };
      if (!product.isActive) return { success: false, message: `المنتج "${product.name}" غير نشط` };
      if (!item.quantityPieces || item.quantityPieces <= 0)
        return { success: false, message: 'الكمية يجب أن تكون أكبر من صفر' };
    }

    const ref = referenceNumber || generateRef('SI', stockTransactions);
    const now = nowISO();

    const newTxs = items.map((item) => ({
      id: `tx-${uuidv4()}`,
      type: TRANSACTION_TYPES.STOCK_IN,
      productId: item.productId,
      quantityPieces: item.quantityPieces,
      referenceNumber: ref,
      notes: notes || '',
      supplier: supplier || '',
      date: date || todayISO(),
      salesmanId: null,
      createdAt: now,
    }));

    try {
      await dexieService.atomicReceiveStock(newTxs);
      set((s) => ({ stockTransactions: [...s.stockTransactions, ...newTxs] }));
      return { success: true, referenceNumber: ref };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  // ══════════════════════════════════════════════════════════════
  // LOADING  — Atomic via Dexie transaction
  // ══════════════════════════════════════════════════════════════

  createLoading: async ({ date, salesmanId, items, notes }) => {
    const { products, salesmen, stockTransactions, loadingTransactions } = get();

    const salesman = salesmen.find((s) => s.id === salesmanId);
    if (!salesman) return { success: false, message: 'المندوب غير موجود' };
    if (salesman.status !== 'active')
      return { success: false, message: `المندوب "${salesman.name}" غير نشط` };

    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return { success: false, message: 'منتج غير موجود' };
      if (!product.isActive) return { success: false, message: `المنتج "${product.name}" غير نشط` };

      const available = calculateWarehouseStock(item.productId, stockTransactions);
      const validation = validateStockAvailability(item.quantityPieces, available, product.name);
      if (!validation.valid) return { success: false, message: validation.message };
    }

    const ref = generateRef('LD', loadingTransactions);
    const now = nowISO();

    const loadingDoc = {
      id: `load-${uuidv4()}`,
      referenceNumber: ref,
      date: date || todayISO(),
      salesmanId,
      items: items.map((item) => ({
        productId: item.productId,
        quantityPieces: item.quantityPieces,
        quantityShrinks: item.quantityShrinks,
        piecesPerShrink: item.piecesPerShrink,
      })),
      notes: notes || '',
      createdAt: now,
    };

    const newLedgerTxs = items.map((item) => ({
      id: `tx-${uuidv4()}`,
      type: TRANSACTION_TYPES.LOADING,
      productId: item.productId,
      quantityPieces: item.quantityPieces,
      referenceNumber: ref,
      notes: notes || '',
      date: date || todayISO(),
      salesmanId,
      createdAt: now,
    }));

    try {
      // Atomic: both loading doc + ledger entries commit together
      await dexieService.atomicCreateLoading(loadingDoc, newLedgerTxs);
      set((s) => ({
        loadingTransactions: [...s.loadingTransactions, loadingDoc],
        stockTransactions: [...s.stockTransactions, ...newLedgerTxs],
      }));
      return { success: true, referenceNumber: ref, loadingId: loadingDoc.id };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  // ══════════════════════════════════════════════════════════════
  // RETURNS  — Atomic via Dexie transaction
  // ══════════════════════════════════════════════════════════════

  recordReturn: async ({ date, salesmanId, productId, quantityPieces, piecesPerShrink, condition, notes }) => {
    const { salesmen, products, stockTransactions, returnTransactions } = get();

    const salesman = salesmen.find((s) => s.id === salesmanId);
    if (!salesman) return { success: false, message: 'المندوب غير موجود' };
    const product = products.find((p) => p.id === productId);
    if (!product) return { success: false, message: 'المنتج غير موجود' };
    if (!quantityPieces || quantityPieces <= 0)
      return { success: false, message: 'الكمية يجب أن تكون أكبر من صفر' };

    const ref = generateRef('RET', returnTransactions);
    const now = nowISO();

    const returnDoc = {
      id: `ret-${uuidv4()}`,
      referenceNumber: ref,
      date: date || todayISO(),
      salesmanId,
      productId,
      quantityPieces,
      quantityShrinks: piecesPerShrink ? quantityPieces / piecesPerShrink : null,
      piecesPerShrink,
      condition: condition || RETURN_CONDITIONS.GOOD,
      notes: notes || '',
      createdAt: now,
    };

    let ledgerTx = null;
    if (condition !== RETURN_CONDITIONS.PENDING) {
      const txType = condition === RETURN_CONDITIONS.GOOD
        ? TRANSACTION_TYPES.RETURN_GOOD
        : TRANSACTION_TYPES.RETURN_DAMAGED;
      ledgerTx = {
        id: `tx-${uuidv4()}`,
        type: txType,
        productId,
        quantityPieces,
        referenceNumber: ref,
        notes: `مرتجع من ${salesman.name} - ${notes || ''}`,
        date: date || todayISO(),
        salesmanId,
        createdAt: now,
      };
    }

    try {
      await dexieService.atomicRecordReturn(returnDoc, ledgerTx);
      set((s) => ({
        returnTransactions: [...s.returnTransactions, returnDoc],
        stockTransactions: ledgerTx
          ? [...s.stockTransactions, ledgerTx]
          : s.stockTransactions,
      }));
      return { success: true, referenceNumber: ref };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  approvePendingReturn: async (returnId, finalCondition) => {
    const { returnTransactions, salesmen } = get();
    const ret = returnTransactions.find((r) => r.id === returnId);
    if (!ret) return { success: false, message: 'المرتجع غير موجود' };
    if (ret.condition !== RETURN_CONDITIONS.PENDING)
      return { success: false, message: 'هذا المرتجع تمت معالجته مسبقاً' };

    const salesman = salesmen.find((s) => s.id === ret.salesmanId);
    const txType = finalCondition === RETURN_CONDITIONS.GOOD
      ? TRANSACTION_TYPES.RETURN_GOOD
      : TRANSACTION_TYPES.RETURN_DAMAGED;

    const ledgerTx = {
      id: `tx-${uuidv4()}`,
      type: txType,
      productId: ret.productId,
      quantityPieces: ret.quantityPieces,
      referenceNumber: ret.referenceNumber,
      notes: `اعتماد مرتجع ${ret.referenceNumber}`,
      date: todayISO(),
      salesmanId: ret.salesmanId,
      createdAt: nowISO(),
    };

    const updatedReturn = { ...ret, condition: finalCondition };

    try {
      await dexieService.atomicApproveReturn(returnId, updatedReturn, ledgerTx);
      set((s) => ({
        returnTransactions: s.returnTransactions.map((r) =>
          r.id === returnId ? updatedReturn : r
        ),
        stockTransactions: [...s.stockTransactions, ledgerTx],
      }));
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  // ══════════════════════════════════════════════════════════════
  // DAMAGE RECORDS  — Atomic
  // ══════════════════════════════════════════════════════════════

  recordDamage: async ({ date, productId, quantityPieces, piecesPerShrink, source, reason, salesmanId, notes }) => {
    const { products, stockTransactions, damageRecords } = get();

    const product = products.find((p) => p.id === productId);
    if (!product) return { success: false, message: 'المنتج غير موجود' };
    if (quantityPieces <= 0) return { success: false, message: 'الكمية يجب أن تكون أكبر من صفر' };

    const ref = generateRef('DMG', damageRecords);
    const now = nowISO();

    const damageDoc = {
      id: `dmg-${uuidv4()}`,
      referenceNumber: ref,
      date: date || todayISO(),
      productId,
      quantityPieces,
      quantityShrinks: piecesPerShrink ? quantityPieces / piecesPerShrink : null,
      piecesPerShrink,
      source: source || 'warehouse',
      reason: reason || '',
      salesmanId: salesmanId || null,
      reviewStatus: 'pending',
      notes: notes || '',
      createdAt: now,
    };

    const ledgerTx = {
      id: `tx-${uuidv4()}`,
      type: TRANSACTION_TYPES.DAMAGE,
      productId,
      quantityPieces,
      referenceNumber: ref,
      notes: reason || '',
      date: date || todayISO(),
      salesmanId: salesmanId || null,
      createdAt: now,
    };

    try {
      await dexieService.atomicRecordDamage(damageDoc, ledgerTx);
      set((s) => ({
        damageRecords: [...s.damageRecords, damageDoc],
        stockTransactions: [...s.stockTransactions, ledgerTx],
      }));
      return { success: true, referenceNumber: ref };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  approveDamageRecord: async (damageId) => {
    const records = get().damageRecords.map((d) =>
      d.id === damageId ? { ...d, reviewStatus: 'approved' } : d
    );
    const updated = records.find((d) => d.id === damageId);
    await dexieService.put('damageRecords', updated);
    set({ damageRecords: records });
    return { success: true };
  },

  // ══════════════════════════════════════════════════════════════
  // STOCKTAKING  — Atomic approval
  // ══════════════════════════════════════════════════════════════

  startStocktaking: async (notes) => {
    const { products, stockTransactions, stocktakingSessions } = get();
    const session = {
      id: `st-${uuidv4()}`,
      referenceNumber: generateRef('JRD', stocktakingSessions),
      date: todayISO(),
      status: 'draft',
      notes: notes || '',
      items: products.filter((p) => p.isActive).map((p) => ({
        productId: p.id,
        systemQuantity: calculateWarehouseStock(p.id, stockTransactions),
        physicalQuantity: null,
        variance: null,
        notes: '',
      })),
      createdAt: nowISO(),
    };
    await dexieService.put('stocktakingSessions', session);
    set((s) => ({ stocktakingSessions: [...s.stocktakingSessions, session] }));
    return session;
  },

  updateStocktakingItem: async (sessionId, productId, physicalQuantity, itemNotes) => {
    const sessions = get().stocktakingSessions.map((s) => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        items: s.items.map((item) => {
          if (item.productId !== productId) return item;
          return {
            ...item,
            physicalQuantity,
            variance: physicalQuantity - item.systemQuantity,
            notes: itemNotes || '',
          };
        }),
      };
    });
    const updated = sessions.find((s) => s.id === sessionId);
    await dexieService.put('stocktakingSessions', updated);
    set({ stocktakingSessions: sessions });
  },

  submitStocktaking: async (sessionId) => {
    const sessions = get().stocktakingSessions.map((s) =>
      s.id === sessionId ? { ...s, status: 'pending' } : s
    );
    const updated = sessions.find((s) => s.id === sessionId);
    await dexieService.put('stocktakingSessions', updated);
    set({ stocktakingSessions: sessions });
  },

  approveStocktaking: async (sessionId) => {
    const { stocktakingSessions, stockTransactions } = get();
    const session = stocktakingSessions.find((s) => s.id === sessionId);
    if (!session || session.status !== 'pending') return { success: false };

    const now = nowISO();
    const adjustmentTxs = session.items
      .filter((item) => item.physicalQuantity !== null && item.variance !== 0)
      .map((item) => ({
        id: `tx-${uuidv4()}`,
        type: TRANSACTION_TYPES.ADJUSTMENT,
        productId: item.productId,
        quantityPieces: item.variance,
        referenceNumber: session.referenceNumber,
        notes: `تسوية جرد ${session.referenceNumber}: ${item.notes || ''}`,
        date: session.date,
        salesmanId: null,
        createdAt: now,
      }));

    const updatedSession = { ...session, status: 'approved', approvedAt: now };

    try {
      await dexieService.atomicApproveStocktaking(sessionId, updatedSession, adjustmentTxs);
      set((s) => ({
        stocktakingSessions: s.stocktakingSessions.map((ss) =>
          ss.id === sessionId ? updatedSession : ss
        ),
        stockTransactions: [...s.stockTransactions, ...adjustmentTxs],
      }));
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  rejectStocktaking: async (sessionId) => {
    const sessions = get().stocktakingSessions.map((s) =>
      s.id === sessionId ? { ...s, status: 'rejected' } : s
    );
    const updated = sessions.find((s) => s.id === sessionId);
    await dexieService.put('stocktakingSessions', updated);
    set({ stocktakingSessions: sessions });
  },

  // ══════════════════════════════════════════════════════════════
  // SETTINGS
  // ══════════════════════════════════════════════════════════════

  updateSettings: async (data) => {
    const settings = { ...get().settings, ...data };
    await dexieService.saveSettings(settings);
    set({ settings });
  },

  // ══════════════════════════════════════════════════════════════
  // BACKUP & RESTORE
  // ══════════════════════════════════════════════════════════════

  exportBackup: async () => {
    return await dexieService.exportBackup();
  },

  importBackup: async (backup) => {
    try {
      // Validate before wiping anything
      await dexieService.importBackup(backup);
      await get()._reload();
      return { success: true, message: 'تم استعادة النسخة الاحتياطية بنجاح وأُعيد تحميل البيانات' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  resetToDemo: async () => {
    await dexieService.clearAll();
    set({ isLoaded: false });
    await get().initialize();
  },

  // ── Start completely empty (no demo data) ──────────────────
  startEmpty: async () => {
    // Clear everything
    await dexieService.clearAll();
    // Mark as initialized WITHOUT seeding demo data
    await dexieService.markInitialized();
    await dexieService.saveSettings(DEFAULT_SETTINGS);
    // Reset Zustand state to empty
    set({
      products: [],
      salesmen: [],
      stockTransactions: [],
      loadingTransactions: [],
      returnTransactions: [],
      damageRecords: [],
      stocktakingSessions: [],
      settings: DEFAULT_SETTINGS,
      isLoaded: true,
      dbError: null,
    });
  },

  runIntegrityCheck: async () => {
    return await dexieService.runIntegrityCheck();
  },

  getStorageEstimate: async () => {
    return await dexieService.getStorageEstimate();
  },

  getLastBackupAge: async () => {
    return await dexieService.getLastBackupAge();
  },
}));

export default useInventoryStore;
