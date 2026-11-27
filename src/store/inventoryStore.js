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
  calculateCompanyReturnsStock,
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

// ─── Constant for Mixed / Assorted returns ─────────────────
export const MIXED_PRODUCT = {
  id: 'prod-mixed',
  name: 'شرنك مشكّل (تشكيلة أصناف)',
  sku: 'MIXED',
  category: 'تشكيلة ومرتجعات',
  packageSize: 'علب متنوعة',
  piecesPerShrink: 24,
  shrinksPerPallet: 169,
  minimumStock: 0,
  description: 'شرنكات بضاعة مشكلة تضم أكثر من صنف أو نكهة',
  isActive: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

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

      // If prod-mixed is in DB but has no transactions referencing it, clean it up so reset remains empty
      let activeProducts = products;
      const hasMixedUsage =
        stockTransactions.some((t) => t.productId === 'prod-mixed') ||
        returnTransactions.some((t) => t.productId === 'prod-mixed');

      if (!hasMixedUsage && activeProducts.some((p) => p.id === 'prod-mixed')) {
        await dexieService.delete('products', 'prod-mixed').catch(() => {});
        activeProducts = activeProducts.filter((p) => p.id !== 'prod-mixed');
      }

      set({
        products: activeProducts,
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

  receiveStock: async ({ date, referenceNumber, supplier, notes, items, editReferenceNumber }) => {
    const { products, stockTransactions } = get();

    // Validate
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return { success: false, message: `منتج غير موجود: ${item.productId}` };
      const wasInEditedReceipt = editReferenceNumber && stockTransactions.some((tx) => tx.type === TRANSACTION_TYPES.STOCK_IN && tx.referenceNumber === editReferenceNumber && tx.productId === item.productId);
      if (!product.isActive && !wasInEditedReceipt) return { success: false, message: `المنتج "${product.name}" غير نشط` };
      if (!item.quantityPieces || item.quantityPieces <= 0)
        return { success: false, message: 'الكمية يجب أن تكون أكبر من صفر' };
    }

    const ref = referenceNumber?.trim() || editReferenceNumber || generateRef('SI', stockTransactions);
    const now = nowISO();

    const newTxs = items.map((item) => ({
      id: `tx-${uuidv4()}`,
      type: TRANSACTION_TYPES.STOCK_IN,
      productId: item.productId,
      quantityPieces: item.quantityPieces,
      quantityShrinks: item.quantityShrinks,
      extraPieces: item.extraPieces || 0,
      piecesPerShrink: item.piecesPerShrink,
      shrinksPerPallet: item.shrinksPerPallet,
      pallets: item.pallets || 0,
      extraShrinks: item.extraShrinks || 0,
      referenceNumber: ref,
      notes: notes || '',
      supplier: supplier || '',
      date: date || todayISO(),
      salesmanId: null,
      createdAt: now,
    }));

    try {
      if (editReferenceNumber) {
        const oldByProduct = new Map();
        const newByProduct = new Map();
        stockTransactions
          .filter((tx) => tx.type === TRANSACTION_TYPES.STOCK_IN && tx.referenceNumber === editReferenceNumber)
          .forEach((tx) => oldByProduct.set(tx.productId, (oldByProduct.get(tx.productId) || 0) + tx.quantityPieces));
        newTxs.forEach((tx) => newByProduct.set(tx.productId, (newByProduct.get(tx.productId) || 0) + tx.quantityPieces));
        const productIds = new Set([...oldByProduct.keys(), ...newByProduct.keys()]);
        for (const productId of productIds) {
          const finalBalance = calculateWarehouseStock(productId, stockTransactions)
            - (oldByProduct.get(productId) || 0)
            + (newByProduct.get(productId) || 0);
          if (finalBalance < 0) {
            return { success: false, message: `Editing this receipt would make product ${productId} stock negative` };
          }
        }
        await dexieService.atomicReplaceStockGroup(
          TRANSACTION_TYPES.STOCK_IN,
          editReferenceNumber,
          newTxs
        );
        set((s) => ({
          stockTransactions: [
            ...s.stockTransactions.filter((tx) =>
              !(tx.type === TRANSACTION_TYPES.STOCK_IN && tx.referenceNumber === editReferenceNumber)
            ),
            ...newTxs,
          ],
        }));
      } else {
        await dexieService.atomicReceiveStock(newTxs);
        set((s) => ({ stockTransactions: [...s.stockTransactions, ...newTxs] }));
      }
      return { success: true, referenceNumber: ref };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  // ══════════════════════════════════════════════════════════════
  // OLD STOCK (رصيد قديم) — Atomic via Dexie transaction
  // ══════════════════════════════════════════════════════════════

  recordOldStock: async ({ date, referenceNumber, notes, items, editReferenceNumber }) => {
    const { products, stockTransactions } = get();

    if (!items || items.length === 0) {
      return { success: false, message: 'يجب إضافة صنف واحد على الأقل' };
    }

    for (const item of items) {
      if (item.isMixed || !item.productId || item.productId === 'prod-mixed') {
        item.productId = 'prod-mixed';
      }
      const product = products.find((p) => p.id === item.productId) || (item.productId === 'prod-mixed' ? MIXED_PRODUCT : null);
      if (!product) return { success: false, message: `منتج غير موجود: ${item.productId}` };
      if (!item.quantityPieces || item.quantityPieces <= 0)
        return { success: false, message: `الكمية الإجمالية للصنف "${product.name}" يجب أن تكون أكبر من صفر` };
    }

    const ref = referenceNumber?.trim() || editReferenceNumber || generateRef('OLD', stockTransactions);
    const now = nowISO();

    const newTxs = items.map((item) => {
      const product = products.find((p) => p.id === item.productId) || (item.productId === 'prod-mixed' ? MIXED_PRODUCT : null);
      const detailParts = [];
      if (item.pallets > 0) detailParts.push(`${item.pallets} بالتة`);
      if (item.extraShrinks > 0) detailParts.push(`${item.extraShrinks} شرنك`);
      if (item.returnsShrinks > 0) detailParts.push(`${item.returnsShrinks} شرنك مرتجع قديم`);
      if (item.extraPieces > 0) detailParts.push(`${item.extraPieces} قطع فرط`);

      const autoNote = detailParts.length > 0 ? `[رصيد قديم: ${detailParts.join(' + ')}]` : '[رصيد قديم]';
      const fullNotes = notes ? `${autoNote} ${notes}` : autoNote;

      return {
        id: `tx-${uuidv4()}`,
        type: TRANSACTION_TYPES.OPENING_BALANCE,
        productId: item.productId,
        quantityPieces: item.quantityPieces,
        quantityShrinks: item.quantityShrinks,
        pallets: item.pallets || 0,
        extraShrinks: item.extraShrinks || 0,
        returnsShrinks: item.returnsShrinks || 0,
        extraPieces: item.extraPieces || 0,
        referenceNumber: ref,
        notes: fullNotes,
        supplier: 'رصيد قديم سابق',
        date: date || todayISO(),
        salesmanId: null,
        createdAt: now,
      };
    });

    try {
      let updatedProducts = products;
      const usesMixed = items.some((item) => item.productId === 'prod-mixed');
      if (usesMixed && !products.some((p) => p.id === 'prod-mixed')) {
        await dexieService.put('products', MIXED_PRODUCT);
        updatedProducts = [...products, MIXED_PRODUCT];
      }

      if (editReferenceNumber) {
        const oldByProduct = new Map();
        const newByProduct = new Map();
        stockTransactions
          .filter((tx) => tx.type === TRANSACTION_TYPES.OPENING_BALANCE && tx.referenceNumber === editReferenceNumber)
          .forEach((tx) => oldByProduct.set(tx.productId, (oldByProduct.get(tx.productId) || 0) + tx.quantityPieces));
        newTxs.forEach((tx) => newByProduct.set(tx.productId, (newByProduct.get(tx.productId) || 0) + tx.quantityPieces));
        const productIds = new Set([...oldByProduct.keys(), ...newByProduct.keys()]);
        for (const productId of productIds) {
          const finalBalance = calculateWarehouseStock(productId, stockTransactions)
            - (oldByProduct.get(productId) || 0)
            + (newByProduct.get(productId) || 0);
          if (finalBalance < 0) {
            return { success: false, message: `Editing this opening balance would make product ${productId} stock negative` };
          }
        }
        await dexieService.atomicReplaceStockGroup(
          TRANSACTION_TYPES.OPENING_BALANCE,
          editReferenceNumber,
          newTxs
        );
        set((s) => ({
          products: updatedProducts,
          stockTransactions: [
            ...s.stockTransactions.filter((tx) =>
              !(tx.type === TRANSACTION_TYPES.OPENING_BALANCE && tx.referenceNumber === editReferenceNumber)
            ),
            ...newTxs,
          ],
        }));
      } else {
        await dexieService.atomicReceiveStock(newTxs);
        set((s) => ({
          products: updatedProducts,
          stockTransactions: [...s.stockTransactions, ...newTxs],
        }));
      }
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

    const mergedItems = [...items.reduce((map, item) => {
      const current = map.get(item.productId);
      if (!current) map.set(item.productId, { ...item });
      else {
        current.quantityPieces += item.quantityPieces;
        current.quantityShrinks += item.quantityShrinks;
      }
      return map;
    }, new Map()).values()];

    for (const item of mergedItems) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return { success: false, message: 'منتج غير موجود' };
      const wasInEditedReceipt = editReferenceNumber && stockTransactions.some((tx) => tx.type === TRANSACTION_TYPES.STOCK_IN && tx.referenceNumber === editReferenceNumber && tx.productId === item.productId);
      if (!product.isActive && !wasInEditedReceipt) return { success: false, message: `المنتج "${product.name}" غير نشط` };

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
      items: mergedItems.map((item) => ({
        productId: item.productId,
        quantityPieces: item.quantityPieces,
        quantityShrinks: item.quantityShrinks,
        piecesPerShrink: item.piecesPerShrink,
      })),
      notes: notes || '',
      createdAt: now,
    };

    const newLedgerTxs = mergedItems.map((item) => ({
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

  updateLoading: async (loadingId, { date, salesmanId, items, notes }) => {
    const { products, salesmen, stockTransactions, loadingTransactions } = get();
    const existing = loadingTransactions.find((loading) => loading.id === loadingId);
    if (!existing) return { success: false, message: 'إذن التحميل غير موجود' };

    const salesman = salesmen.find((row) => row.id === salesmanId);
    if (!salesman) return { success: false, message: 'المندوب غير موجود' };
    if (salesman.status !== 'active' && salesmanId !== existing.salesmanId) {
      return { success: false, message: `المندوب "${salesman.name}" غير نشط` };
    }

    const mergedItems = [...items.reduce((map, item) => {
      const current = map.get(item.productId);
      if (!current) map.set(item.productId, { ...item });
      else {
        current.quantityPieces += item.quantityPieces;
        current.quantityShrinks += item.quantityShrinks;
      }
      return map;
    }, new Map()).values()];

    const priorPieces = new Map();
    existing.items.forEach((item) => {
      priorPieces.set(item.productId, (priorPieces.get(item.productId) || 0) + item.quantityPieces);
    });
    for (const item of mergedItems) {
      const product = products.find((row) => row.id === item.productId);
      if (!product) return { success: false, message: `الصنف غير موجود: ${item.productId}` };
      if (!product.isActive && !existing.items.some((old) => old.productId === item.productId)) {
        return { success: false, message: `الصنف "${product.name}" غير نشط` };
      }
      if (!Number.isFinite(item.quantityPieces) || item.quantityPieces <= 0) {
        return { success: false, message: `الكمية للصنف "${product.name}" يجب أن تكون أكبر من صفر` };
      }

      const availableBeforeThisLoading =
        calculateWarehouseStock(item.productId, stockTransactions) + (priorPieces.get(item.productId) || 0);
      if (item.quantityPieces > availableBeforeThisLoading) {
        return {
          success: false,
          message: `الكمية المطلوبة للصنف "${product.name}" تتجاوز المتاح بعد التعديل (${availableBeforeThisLoading} قطعة)`,
        };
      }
    }

    const now = nowISO();
    const updatedLoading = {
      ...existing,
      date: date || existing.date,
      salesmanId,
      notes: notes || '',
      items: mergedItems.map((item) => ({
        productId: item.productId,
        quantityPieces: item.quantityPieces,
        quantityShrinks: item.quantityShrinks,
        piecesPerShrink: item.piecesPerShrink,
      })),
      updatedAt: now,
    };
    const ledgerEntries = mergedItems.map((item) => ({
      id: `tx-${uuidv4()}`,
      type: TRANSACTION_TYPES.LOADING,
      productId: item.productId,
      quantityPieces: item.quantityPieces,
      referenceNumber: existing.referenceNumber,
      notes: notes || '',
      date: date || existing.date,
      salesmanId,
      createdAt: now,
    }));

    try {
      await dexieService.atomicUpdateLoading(updatedLoading, ledgerEntries);
      set((state) => ({
        loadingTransactions: state.loadingTransactions.map((row) =>
          row.id === loadingId ? updatedLoading : row
        ),
        stockTransactions: [
          ...state.stockTransactions.filter((tx) =>
            !(tx.type === TRANSACTION_TYPES.LOADING && tx.referenceNumber === existing.referenceNumber)
          ),
          ...ledgerEntries,
        ],
      }));
      return { success: true, referenceNumber: existing.referenceNumber };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  // ══════════════════════════════════════════════════════════════
  // RETURNS  — Atomic via Dexie transaction
  // Supports:
  // - Shrinks + Loose pieces input
  // - Immediate exchange deduction (salesman takes good replacement)
  // - Pending sorting OR immediate full/partial sorting (good pieces + company return pieces)
  // ══════════════════════════════════════════════════════════════

  recordReturn: async ({ date, salesmanId, items, notes, editReferenceNumber, ...singleProps }) => {
    const { salesmen, products, returnTransactions, stockTransactions } = get();

    const salesman = salesmen.find((s) => s.id === salesmanId);
    if (!salesman) return { success: false, message: 'المندوب غير موجود' };

    const itemsList = Array.isArray(items) && items.length > 0
      ? items
      : [{
          productId: singleProps.productId,
          quantityPieces: singleProps.quantityPieces,
          quantityShrinks: singleProps.quantityShrinks,
          shrinks: singleProps.shrinks,
          loosePieces: singleProps.loosePieces,
          piecesPerShrink: singleProps.piecesPerShrink,
          condition: singleProps.condition,
          goodPieces: singleProps.goodPieces,
          companyPieces: singleProps.companyPieces,
          replacementProductId: singleProps.replacementProductId,
          goodTargetProductId: singleProps.goodTargetProductId,
          notes: singleProps.notes,
        }];

    // Normalize & validate every item
    const normalizedItems = [];
    for (const rawItem of itemsList) {
      const item = { ...rawItem };
      if (item.isMixed || !item.productId || item.productId === 'prod-mixed') {
        item.productId = 'prod-mixed';
      }
      const product = products.find((p) => p.id === item.productId) || (item.productId === 'prod-mixed' ? MIXED_PRODUCT : null);
      if (!product) return { success: false, message: 'أحد الأصناف المحددة غير موجود' };

      const pShrink = item.piecesPerShrink || product.piecesPerShrink || 24;
      let totalPieces = 0;
      let qShrinks = 0;
      let qLoose = 0;

      if (item.shrinks !== undefined || item.loosePieces !== undefined) {
        qShrinks = Math.max(0, Math.floor(Number(item.shrinks) || 0));
        qLoose = Math.max(0, Math.floor(Number(item.loosePieces) || 0));
        totalPieces = qShrinks * pShrink + qLoose;
      } else if (item.quantityPieces && item.quantityPieces > 0) {
        totalPieces = Math.round(Number(item.quantityPieces));
        qShrinks = Math.floor(totalPieces / pShrink);
        qLoose = totalPieces % pShrink;
      } else if (item.quantityShrinks && item.quantityShrinks > 0) {
        totalPieces = Math.round(Number(item.quantityShrinks) * pShrink);
        qShrinks = Math.floor(totalPieces / pShrink);
        qLoose = totalPieces % pShrink;
      }

      if (totalPieces <= 0) {
        return { success: false, message: `الكمية للصنف "${product.name}" يجب أن تكون أكبر من صفر` };
      }

      const rawCond = item.condition || RETURN_CONDITIONS.PENDING;
      let goodPieces = 0;
      let companyPieces = 0;
      let finalCondition = rawCond;

      if (rawCond === RETURN_CONDITIONS.GOOD) {
        goodPieces = totalPieces;
        companyPieces = 0;
      } else if (rawCond === RETURN_CONDITIONS.COMPANY) {
        goodPieces = 0;
        companyPieces = totalPieces;
      } else if (rawCond === RETURN_CONDITIONS.PARTIAL) {
        goodPieces = Math.max(0, Math.round(Number(item.goodPieces) || 0));
        companyPieces = item.companyPieces !== undefined
          ? Math.max(0, Math.round(Number(item.companyPieces) || 0))
          : totalPieces - goodPieces;

        if (goodPieces + companyPieces !== totalPieces) {
          return {
            success: false,
            message: `مجموع القطع السليمة ومرتجع الشركة (${goodPieces + companyPieces}) يجب أن يساوي إجمالي المرتجع (${totalPieces} قطعة)`,
          };
        }
        if (goodPieces === totalPieces) finalCondition = RETURN_CONDITIONS.GOOD;
        else if (companyPieces === totalPieces) finalCondition = RETURN_CONDITIONS.COMPANY;
        else finalCondition = RETURN_CONDITIONS.PARTIAL;
      } else {
        finalCondition = RETURN_CONDITIONS.PENDING;
      }

      const replacementProductId = item.replacementProductId || item.productId;
      const goodTargetProductId = item.goodTargetProductId || item.productId;

      normalizedItems.push({
        ...item,
        product,
        piecesPerShrink: pShrink,
        quantityPieces: totalPieces,
        shrinks: qShrinks,
        loosePieces: qLoose,
        condition: finalCondition,
        goodPieces,
        companyPieces,
        replacementProductId,
        goodTargetProductId,
      });
    }

    const ref = editReferenceNumber || generateRef('RET', returnTransactions);
    const now = nowISO();
    const txDate = date || todayISO();

    const returnDocs = [];
    const ledgerTxs = [];

    for (const item of normalizedItems) {
      const docId = `ret-${uuidv4()}`;
      const itemNotes = item.notes ? `${notes ? notes + ' - ' : ''}${item.notes}` : (notes || '');
      const isExchange = singleProps.isExchange !== undefined
        ? singleProps.isExchange
        : (item.isExchange !== undefined ? item.isExchange : true);

      const returnDoc = {
        id: docId,
        referenceNumber: ref,
        date: txDate,
        salesmanId,
        productId: item.productId,
        replacementProductId: isExchange ? item.replacementProductId : null,
        goodTargetProductId: item.goodTargetProductId,
        quantityPieces: item.quantityPieces,
        quantityShrinks: item.shrinks,
        loosePieces: item.loosePieces,
        piecesPerShrink: item.piecesPerShrink,
        condition: item.condition,
        goodPieces: item.goodPieces,
        companyPieces: item.companyPieces,
        isExchange,
        notes: itemNotes,
        createdAt: now,
        sortedAt: item.condition !== RETURN_CONDITIONS.PENDING ? now : null,
      };
      returnDocs.push(returnDoc);

      // 1. Exchange: Salesman took good stock in replacement -> immediately deduct from sellable stock
      if (isExchange) {
        ledgerTxs.push({
          id: `tx-${uuidv4()}`,
          type: TRANSACTION_TYPES.RETURN_REPLACEMENT,
          productId: item.replacementProductId,
          quantityPieces: item.quantityPieces,
          referenceNumber: ref,
          notes: `صرف بدل مرتجع للمندوب ${salesman.name}${itemNotes ? ` - ${itemNotes}` : ''}`,
          date: txDate,
          salesmanId,
          createdAt: now,
        });
      }

      // 2. If already sorted on arrival, post good pieces back to sellable & company pieces to company bucket
      if (item.condition !== RETURN_CONDITIONS.PENDING) {
        if (item.goodPieces > 0) {
          ledgerTxs.push({
            id: `tx-${uuidv4()}`,
            type: TRANSACTION_TYPES.RETURN_GOOD,
            productId: item.goodTargetProductId,
            quantityPieces: item.goodPieces,
            referenceNumber: ref,
            notes: `مرتجع سليم صالح للبيع من ${salesman.name}${itemNotes ? ` - ${itemNotes}` : ''}`,
            date: txDate,
            salesmanId,
            createdAt: now,
          });
        }
        if (item.companyPieces > 0) {
          ledgerTxs.push({
            id: `tx-${uuidv4()}`,
            type: TRANSACTION_TYPES.RETURN_DAMAGED,
            productId: item.productId,
            quantityPieces: item.companyPieces,
            referenceNumber: ref,
            notes: `مرتجع هيرجع للشركة من ${salesman.name}${itemNotes ? ` - ${itemNotes}` : ''}`,
            date: txDate,
            salesmanId,
            createdAt: now,
          });
        }
      }
    }

    if (editReferenceNumber) {
      const oldDocs = returnTransactions.filter((row) => row.referenceNumber === editReferenceNumber);
      if (!oldDocs.length) return { success: false, message: 'إذن المرتجع غير موجود' };
      const priorReplacement = new Map();
      stockTransactions
        .filter((tx) => tx.referenceNumber === editReferenceNumber && tx.type === TRANSACTION_TYPES.RETURN_REPLACEMENT)
        .forEach((tx) => priorReplacement.set(
          tx.productId,
          (priorReplacement.get(tx.productId) || 0) + tx.quantityPieces
        ));

      const replacementTotals = new Map();
      ledgerTxs
        .filter((tx) => tx.type === TRANSACTION_TYPES.RETURN_REPLACEMENT)
        .forEach((tx) => replacementTotals.set(
          tx.productId,
          (replacementTotals.get(tx.productId) || 0) + tx.quantityPieces
        ));

      for (const [productId, requestedPieces] of replacementTotals) {
        const product = products.find((row) => row.id === productId) || (productId === 'prod-mixed' ? MIXED_PRODUCT : null);
        if (!product) return { success: false, message: `صنف البديل غير موجود: ${productId}` };
        const available = calculateWarehouseStock(productId, stockTransactions) + (priorReplacement.get(productId) || 0);
        if (requestedPieces > available) {
          return {
            success: false,
            message: `كمية البديل للصنف "${product.name}" تتجاوز المتاح بعد التعديل (${available} قطعة)`,
          };
        }
      }
    }

    const replacementOutflowByProduct = new Map();
    ledgerTxs
      .filter((tx) => tx.type === TRANSACTION_TYPES.RETURN_REPLACEMENT)
      .forEach((tx) => replacementOutflowByProduct.set(
        tx.productId,
        (replacementOutflowByProduct.get(tx.productId) || 0) + tx.quantityPieces
      ));
    for (const [productId, requestedPieces] of replacementOutflowByProduct) {
      const product = products.find((row) => row.id === productId) || (productId === 'prod-mixed' ? MIXED_PRODUCT : null);
      if (!product) return { success: false, message: `الصنف البديل غير موجود: ${productId}` };
      const oldOutflow = editReferenceNumber
        ? stockTransactions
            .filter((tx) => tx.referenceNumber === editReferenceNumber && tx.type === TRANSACTION_TYPES.RETURN_REPLACEMENT && tx.productId === productId)
            .reduce((sum, tx) => sum + tx.quantityPieces, 0)
        : 0;
      const available = calculateWarehouseStock(productId, stockTransactions) + oldOutflow;
      if (requestedPieces > available) {
        return { success: false, message: `كمية البديل للصنف "${product.name}" تتجاوز المتاح (${available} قطعة)` };
      }
    }

    if (editReferenceNumber) {
      const oldLedger = stockTransactions.filter((tx) =>
        tx.referenceNumber === editReferenceNumber &&
        [TRANSACTION_TYPES.RETURN_REPLACEMENT, TRANSACTION_TYPES.RETURN_GOOD, TRANSACTION_TYPES.RETURN_DAMAGED].includes(tx.type)
      );
      const productIds = new Set([
        ...oldLedger.map((tx) => tx.productId),
        ...ledgerTxs.map((tx) => tx.productId),
      ]);
      for (const productId of productIds) {
        const oldWarehouseEffect = oldLedger
          .filter((tx) => tx.productId === productId)
          .reduce((sum, tx) => {
            if (tx.type === TRANSACTION_TYPES.RETURN_GOOD) return sum + tx.quantityPieces;
            if (tx.type === TRANSACTION_TYPES.RETURN_REPLACEMENT) return sum - tx.quantityPieces;
            return sum;
          }, 0);
        const newWarehouseEffect = ledgerTxs
          .filter((tx) => tx.productId === productId)
          .reduce((sum, tx) => {
            if (tx.type === TRANSACTION_TYPES.RETURN_GOOD) return sum + tx.quantityPieces;
            if (tx.type === TRANSACTION_TYPES.RETURN_REPLACEMENT) return sum - tx.quantityPieces;
            return sum;
          }, 0);
        const finalWarehouseBalance = calculateWarehouseStock(productId, stockTransactions) - oldWarehouseEffect + newWarehouseEffect;
        if (finalWarehouseBalance < 0) {
          return { success: false, message: `Editing this return would make the warehouse balance negative for product ${productId}` };
        }

        const oldCompanyInflow = oldLedger
          .filter((tx) => tx.productId === productId && tx.type === TRANSACTION_TYPES.RETURN_DAMAGED)
          .reduce((sum, tx) => sum + tx.quantityPieces, 0);
        const newCompanyInflow = ledgerTxs
          .filter((tx) => tx.productId === productId && tx.type === TRANSACTION_TYPES.RETURN_DAMAGED)
          .reduce((sum, tx) => sum + tx.quantityPieces, 0);
        const finalCompanyBalance = calculateCompanyReturnsStock(productId, stockTransactions) - oldCompanyInflow + newCompanyInflow;
        if (finalCompanyBalance < 0) {
          return { success: false, message: `Editing this return would reduce the company-return balance below zero for product ${productId}` };
        }
      }
    }

    try {
      // Ensure prod-mixed is registered in products if referenced anywhere
      let updatedProducts = products;
      const usesMixed =
        normalizedItems.some((item) => item.productId === 'prod-mixed') ||
        ledgerTxs.some((tx) => tx.productId === 'prod-mixed');
      if (usesMixed && !products.some((p) => p.id === 'prod-mixed')) {
        await dexieService.put('products', MIXED_PRODUCT);
        updatedProducts = [...products, MIXED_PRODUCT];
      }

      if (editReferenceNumber) {
        await dexieService.atomicReplaceReturnBatch(editReferenceNumber, returnDocs, ledgerTxs);
      } else {
        await dexieService.atomicRecordReturns(returnDocs, ledgerTxs);
      }
      set((s) => ({
        products: updatedProducts,
        returnTransactions: [
          ...s.returnTransactions.filter((row) =>
            !editReferenceNumber || row.referenceNumber !== editReferenceNumber
          ),
          ...returnDocs,
        ],
        stockTransactions: [
          ...s.stockTransactions.filter((tx) =>
            !editReferenceNumber || !(
              tx.referenceNumber === editReferenceNumber &&
              [TRANSACTION_TYPES.RETURN_REPLACEMENT, TRANSACTION_TYPES.RETURN_GOOD, TRANSACTION_TYPES.RETURN_DAMAGED].includes(tx.type)
            )
          ),
          ...ledgerTxs,
        ],
      }));
      return { success: true, referenceNumber: ref };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  approvePendingReturn: async (returnId, payload) => {
    const { returnTransactions, salesmen, products } = get();
    const ret = returnTransactions.find((r) => r.id === returnId);
    if (!ret) return { success: false, message: 'المرتجع غير موجود' };
    if (ret.condition !== RETURN_CONDITIONS.PENDING)
      return { success: false, message: 'هذا المرتجع تمت معالجته مسبقاً' };

    const salesman = salesmen.find((s) => s.id === ret.salesmanId);
    const totalPieces = ret.quantityPieces;

    let goodPieces = 0;
    let companyPieces = 0;
    let goodTargetProductId = ret.productId;
    let extraNote = '';

    if (typeof payload === 'string') {
      // Legacy call: 'good' | 'damaged'
      if (payload === RETURN_CONDITIONS.GOOD) {
        goodPieces = totalPieces;
      } else {
        companyPieces = totalPieces;
      }
    } else if (payload && typeof payload === 'object') {
      goodPieces = Math.max(0, Math.round(Number(payload.goodPieces) || 0));
      companyPieces = payload.companyPieces !== undefined
        ? Math.max(0, Math.round(Number(payload.companyPieces) || 0))
        : totalPieces - goodPieces;
      if (payload.goodTargetProductId) goodTargetProductId = payload.goodTargetProductId;
      if (payload.notes) extraNote = payload.notes.trim();
    }

    if (goodPieces + companyPieces !== totalPieces) {
      return {
        success: false,
        message: `مجموع السليم (${goodPieces}) + المرتجع للشركة (${companyPieces}) يجب أن يساوي ${totalPieces} قطعة`,
      };
    }

    const finalCondition =
      goodPieces === totalPieces
        ? RETURN_CONDITIONS.GOOD
        : companyPieces === totalPieces
        ? RETURN_CONDITIONS.COMPANY
        : RETURN_CONDITIONS.PARTIAL;

    const now = nowISO();
    const today = todayISO();
    const ledgerTxs = [];

    if (goodPieces > 0) {
      ledgerTxs.push({
        id: `tx-${uuidv4()}`,
        type: TRANSACTION_TYPES.RETURN_GOOD,
        productId: goodTargetProductId,
        quantityPieces: goodPieces,
        referenceNumber: ret.referenceNumber,
        notes: `فرز سليم من مرتجع #${ret.referenceNumber}${salesman ? ` (${salesman.name})` : ''}${extraNote ? ` - ${extraNote}` : ''}`,
        date: today,
        salesmanId: ret.salesmanId,
        createdAt: now,
      });
    }

    if (companyPieces > 0) {
      ledgerTxs.push({
        id: `tx-${uuidv4()}`,
        type: TRANSACTION_TYPES.RETURN_DAMAGED,
        productId: ret.productId,
        quantityPieces: companyPieces,
        referenceNumber: ret.referenceNumber,
        notes: `فرز مرتجع للشركة من #${ret.referenceNumber}${salesman ? ` (${salesman.name})` : ''}${extraNote ? ` - ${extraNote}` : ''}`,
        date: today,
        salesmanId: ret.salesmanId,
        createdAt: now,
      });
    }

    const updatedReturn = {
      ...ret,
      condition: finalCondition,
      goodPieces,
      companyPieces,
      goodTargetProductId,
      notes: extraNote ? (ret.notes ? `${ret.notes} | فرز: ${extraNote}` : `فرز: ${extraNote}`) : ret.notes,
      sortedAt: now,
    };

    try {
      let updatedProducts = products;
      if (goodTargetProductId === 'prod-mixed' && !products.some((p) => p.id === 'prod-mixed')) {
        await dexieService.put('products', MIXED_PRODUCT);
        updatedProducts = [...products, MIXED_PRODUCT];
      }

      await dexieService.atomicApproveReturn(returnId, updatedReturn, ledgerTxs);
      set((s) => ({
        products: updatedProducts,
        returnTransactions: s.returnTransactions.map((r) =>
          r.id === returnId ? updatedReturn : r
        ),
        stockTransactions: [...s.stockTransactions, ...ledgerTxs],
      }));
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  dispatchCompanyReturns: async ({ date, productId, quantityPieces, referenceNumber, notes, transactionId }) => {
    const { products, stockTransactions } = get();
    const existing = transactionId
      ? stockTransactions.find((tx) => tx.id === transactionId && tx.type === TRANSACTION_TYPES.COMPANY_RETURN_DISPATCH)
      : null;
    if (transactionId && !existing) return { success: false, message: 'سجل التسليم غير موجود' };
    const product = products.find((p) => p.id === productId) || (productId === 'prod-mixed' ? MIXED_PRODUCT : null);
    if (!product) return { success: false, message: 'المنتج غير موجود' };
    if (!quantityPieces || quantityPieces <= 0) {
      return { success: false, message: 'الكمية يجب أن تكون أكبر من صفر' };
    }

    const restoredQuantity = existing?.productId === productId ? existing.quantityPieces : 0;
    const availableCompanyReturns = calculateCompanyReturnsStock(productId, stockTransactions) + restoredQuantity;
    if (quantityPieces > availableCompanyReturns) {
      return {
        success: false,
        message: `الكمية المطلوب تسليمها (${quantityPieces} ق) أكبر من رصيد مرتجعات الشركة المتاح (${availableCompanyReturns} ق)`,
      };
    }

    const ref = existing?.referenceNumber || referenceNumber?.trim() || generateRef('CMP', stockTransactions);
    const now = nowISO();
    const ledgerTx = {
      id: existing?.id || `tx-${uuidv4()}`,
      type: TRANSACTION_TYPES.COMPANY_RETURN_DISPATCH,
      productId,
      quantityPieces,
      referenceNumber: ref,
      notes: notes?.trim() || `تسليم مرتجعات للشركة (${product.name})`,
      date: date || todayISO(),
      salesmanId: null,
      createdAt: now,
    };

    try {
      if (existing) {
        await dexieService.atomicUpdateStockTransaction(ledgerTx);
        set((s) => ({
          stockTransactions: s.stockTransactions.map((tx) => tx.id === existing.id ? ledgerTx : tx),
        }));
      } else {
        await dexieService.atomicDispatchCompanyReturns([ledgerTx]);
        set((s) => ({ stockTransactions: [...s.stockTransactions, ledgerTx] }));
      }
      return { success: true, referenceNumber: ref };
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
    if (!Number.isFinite(quantityPieces)) return { success: false, message: 'Quantity must be a finite number' };
    if (!product) return { success: false, message: 'المنتج غير موجود' };
    if (quantityPieces <= 0) return { success: false, message: 'الكمية يجب أن تكون أكبر من صفر' };

    const damageSource = source || 'warehouse';
    const affectsWarehouse = !['salesman', 'transport'].includes(damageSource);
    if (affectsWarehouse && quantityPieces > calculateWarehouseStock(productId, stockTransactions)) {
      return { success: false, message: 'Damage quantity exceeds available warehouse stock' };
    }

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
      source: damageSource,
      reason: reason || '',
      salesmanId: salesmanId || null,
      reviewStatus: 'pending',
      notes: notes || '',
      createdAt: now,
    };

    const ledgerTx = affectsWarehouse ? {
      id: `tx-${uuidv4()}`,
      type: TRANSACTION_TYPES.DAMAGE,
      productId,
      quantityPieces,
      referenceNumber: ref,
      notes: reason || '',
      date: date || todayISO(),
      salesmanId: salesmanId || null,
      createdAt: now,
    } : null;

    try {
      await dexieService.atomicRecordDamage(damageDoc, ledgerTx);
      set((s) => ({
        damageRecords: [...s.damageRecords, damageDoc],
        stockTransactions: ledgerTx ? [...s.stockTransactions, ledgerTx] : s.stockTransactions,
      }));
      return { success: true, referenceNumber: ref };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  updateDamageRecord: async (damageId, { date, productId, quantityPieces, piecesPerShrink, source, reason, salesmanId, notes }) => {
    const { products, stockTransactions, damageRecords } = get();
    const existing = damageRecords.find((row) => row.id === damageId);
    const product = products.find((row) => row.id === productId);
    if (!existing) return { success: false, message: 'Damage record not found' };
    if (!product) return { success: false, message: 'Product not found' };
    if (!Number.isFinite(quantityPieces) || quantityPieces <= 0) {
      return { success: false, message: 'Quantity must be a positive finite number' };
    }

    const damageSource = source || 'warehouse';
    const affectsWarehouse = !['salesman', 'transport'].includes(damageSource);
    const oldAffectsWarehouse = !['salesman', 'transport'].includes(existing.source || 'warehouse');
    if (affectsWarehouse) {
      const restoredQuantity = oldAffectsWarehouse && existing.productId === productId
        ? existing.quantityPieces
        : 0;
      const available = calculateWarehouseStock(productId, stockTransactions) + restoredQuantity;
      if (quantityPieces > available) {
        return { success: false, message: `Damage quantity exceeds available stock (${available} pieces)` };
      }
    }

    const now = nowISO();
    const updatedDamage = {
      ...existing,
      date: date || existing.date,
      productId,
      quantityPieces,
      quantityShrinks: piecesPerShrink ? quantityPieces / piecesPerShrink : null,
      piecesPerShrink,
      source: damageSource,
      reason: reason || '',
      salesmanId: salesmanId || null,
      notes: notes || '',
      updatedAt: now,
    };
    const ledgerTx = affectsWarehouse ? {
      id: `tx-${uuidv4()}`,
      type: TRANSACTION_TYPES.DAMAGE,
      productId,
      quantityPieces,
      referenceNumber: existing.referenceNumber,
      notes: reason || '',
      date: date || existing.date,
      salesmanId: salesmanId || null,
      createdAt: now,
    } : null;

    try {
      await dexieService.atomicUpdateDamage(updatedDamage, ledgerTx);
      set((state) => ({
        damageRecords: state.damageRecords.map((row) => row.id === damageId ? updatedDamage : row),
        stockTransactions: [
          ...state.stockTransactions.filter((tx) =>
            !(tx.type === TRANSACTION_TYPES.DAMAGE && tx.referenceNumber === existing.referenceNumber)
          ),
          ...(ledgerTx ? [ledgerTx] : []),
        ],
      }));
      return { success: true, referenceNumber: existing.referenceNumber };
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

  saveStocktakingData: async (sessionId, { manualShrinks, manualLoosePieces, items, submit = false }) => {
    const { stocktakingSessions, stockTransactions } = get();
    const current = stocktakingSessions.find((row) => row.id === sessionId);
    if (!current || !['draft', 'pending', 'approved'].includes(current.status)) {
      return { success: false, message: 'جلسة الجرد لم تعد مسودة قابلة للتعديل' };
    }

    const updates = new Map((items || []).map((item) => [item.productId, item]));
    if ((submit || current.status === 'pending' || current.status === 'approved') && current.items.some((item) => !updates.has(item.productId) || updates.get(item.productId).physicalQuantity === null)) {
      return { success: false, message: 'أدخل الكمية الفعلية لكل صنف قبل رفع الجرد للمراجعة' };
    }
    const updatedSession = {
      ...current,
      manualShrinks,
      manualLoosePieces,
      status: submit ? 'pending' : current.status,
      submittedAt: submit ? nowISO() : current.submittedAt,
      updatedAt: nowISO(),
      items: current.items.map((item) => {
        const update = updates.get(item.productId);
        if (!update) return item;
        const physicalQuantity = update.physicalQuantity;
        const systemQuantity = submit && current.status === 'draft'
          ? calculateWarehouseStock(item.productId, stockTransactions)
          : item.systemQuantity;
        return {
          ...item,
          systemQuantity,
          physicalQuantity,
          variance: physicalQuantity === null ? null : physicalQuantity - systemQuantity,
          notes: update.notes || '',
        };
      }),
    };

    try {
      if (current.status === 'approved') {
        const oldAdjustments = stockTransactions.filter((tx) =>
          tx.referenceNumber === current.referenceNumber && tx.type === TRANSACTION_TYPES.ADJUSTMENT
        );
        const adjustmentEntries = updatedSession.items
          .filter((item) => item.variance !== 0)
          .map((item) => ({
            id: `tx-${uuidv4()}`,
            type: TRANSACTION_TYPES.ADJUSTMENT,
            productId: item.productId,
            quantityPieces: item.variance,
            referenceNumber: current.referenceNumber,
            notes: `تصحيح تسوية الجرد ${current.referenceNumber}: ${item.notes || ''}`,
            date: current.date,
            salesmanId: null,
            createdAt: nowISO(),
          }));
        const productIds = new Set([
          ...oldAdjustments.map((tx) => tx.productId),
          ...adjustmentEntries.map((tx) => tx.productId),
        ]);
        for (const productId of productIds) {
          const oldEffect = oldAdjustments
            .filter((tx) => tx.productId === productId)
            .reduce((sum, tx) => sum + tx.quantityPieces, 0);
          const newEffect = adjustmentEntries
            .filter((tx) => tx.productId === productId)
            .reduce((sum, tx) => sum + tx.quantityPieces, 0);
          if (calculateWarehouseStock(productId, stockTransactions) - oldEffect + newEffect < 0) {
            return { success: false, message: `Editing this stocktake would make product ${productId} stock negative` };
          }
        }

        await dexieService.atomicUpdateApprovedStocktaking(sessionId, updatedSession, adjustmentEntries);
        set((state) => ({
          stocktakingSessions: state.stocktakingSessions.map((row) =>
            row.id === sessionId ? updatedSession : row
          ),
          stockTransactions: [
            ...state.stockTransactions.filter((tx) =>
              !(tx.referenceNumber === current.referenceNumber && tx.type === TRANSACTION_TYPES.ADJUSTMENT)
            ),
            ...adjustmentEntries,
          ],
        }));
      } else {
        await dexieService.put('stocktakingSessions', updatedSession);
        set((state) => ({
          stocktakingSessions: state.stocktakingSessions.map((row) =>
            row.id === sessionId ? updatedSession : row
          ),
        }));
      }
      return { success: true, session: updatedSession };
    } catch (err) {
      return { success: false, message: err.message };
    }
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

  updateStocktakingTotals: async (sessionId, manualShrinks, manualLoosePieces) => {
    const sessions = get().stocktakingSessions.map((s) =>
      s.id === sessionId ? { ...s, manualShrinks, manualLoosePieces } : s
    );
    const updated = sessions.find((s) => s.id === sessionId);
    if (updated) {
      await dexieService.put('stocktakingSessions', updated);
      set({ stocktakingSessions: sessions });
    }
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
    const current = get().stocktakingSessions.find((s) => s.id === sessionId);
    if (!current || current.status !== 'pending') {
      return { success: false, message: 'جلسة الجرد لم تعد قيد المراجعة' };
    }
    const updated = { ...current, status: 'rejected', rejectedAt: nowISO() };
    try {
      await dexieService.put('stocktakingSessions', updated);
      set((state) => ({
        stocktakingSessions: state.stocktakingSessions.map((s) => s.id === sessionId ? updated : s),
      }));
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
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
