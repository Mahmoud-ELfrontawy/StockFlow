// ============================================================
// STOCKFLOW — CONSTANTS
// All magic numbers and string values must be defined here.
// ============================================================

export const APP_NAME = 'ستوك فلو';
export const APP_VERSION = '1.0.0';

// ─── Transaction Types ───────────────────────────────────────
export const TRANSACTION_TYPES = {
  OPENING_BALANCE: 'opening_balance',
  STOCK_IN: 'stock_in',
  LOADING: 'loading',
  RETURN_GOOD: 'return_good',
  RETURN_DAMAGED: 'return_damaged',
  DAMAGE: 'damage',
  ADJUSTMENT: 'adjustment',
  REVERSAL: 'reversal',
};

export const TRANSACTION_TYPE_LABELS = {
  [TRANSACTION_TYPES.OPENING_BALANCE]: 'رصيد افتتاحي',
  [TRANSACTION_TYPES.STOCK_IN]: 'استلام بضاعة',
  [TRANSACTION_TYPES.LOADING]: 'تحميل',
  [TRANSACTION_TYPES.RETURN_GOOD]: 'مرتجع سليم',
  [TRANSACTION_TYPES.RETURN_DAMAGED]: 'مرتجع تالف',
  [TRANSACTION_TYPES.DAMAGE]: 'بضاعة تالفة',
  [TRANSACTION_TYPES.ADJUSTMENT]: 'تسوية جرد',
  [TRANSACTION_TYPES.REVERSAL]: 'عكس معاملة',
};

// ─── Return Conditions ───────────────────────────────────────
export const RETURN_CONDITIONS = {
  GOOD: 'good',
  DAMAGED: 'damaged',
  PENDING: 'pending',
};

export const RETURN_CONDITION_LABELS = {
  [RETURN_CONDITIONS.GOOD]: 'سليم (قابل للبيع)',
  [RETURN_CONDITIONS.DAMAGED]: 'تالف',
  [RETURN_CONDITIONS.PENDING]: 'قيد الفحص',
};

// ─── Stocktaking Status ──────────────────────────────────────
export const STOCKTAKING_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const STOCKTAKING_STATUS_LABELS = {
  [STOCKTAKING_STATUS.DRAFT]: 'مسودة',
  [STOCKTAKING_STATUS.PENDING]: 'قيد المراجعة',
  [STOCKTAKING_STATUS.APPROVED]: 'معتمد',
  [STOCKTAKING_STATUS.REJECTED]: 'مرفوض',
};

// ─── Damage Sources ──────────────────────────────────────────
export const DAMAGE_SOURCES = {
  WAREHOUSE: 'warehouse',
  SALESMAN: 'salesman',
  TRANSPORT: 'transport',
  EXPIRED: 'expired',
  OTHER: 'other',
};

export const DAMAGE_SOURCE_LABELS = {
  [DAMAGE_SOURCES.WAREHOUSE]: 'المخزن',
  [DAMAGE_SOURCES.SALESMAN]: 'المندوب',
  [DAMAGE_SOURCES.TRANSPORT]: 'النقل',
  [DAMAGE_SOURCES.EXPIRED]: 'انتهاء الصلاحية',
  [DAMAGE_SOURCES.OTHER]: 'أخرى',
};

// ─── Product Categories ──────────────────────────────────────
export const PRODUCT_CATEGORIES = [
  'مياه غازية',
  'مياه طبيعية',
  'عصائر',
  'مشروبات طاقة',
  'مشروبات رياضية',
  'شاي وقهوة',
  'مشروبات ألبان',
  'أخرى',
];

// ─── Default Settings ────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  warehouseName: 'مخزن الشركة الرئيسي',
  warehouseAddress: 'القاهرة، مصر',
  defaultShrinksPerPallet: 169,
  defaultPiecesPerShrink: 24,
  lowStockThreshold: 50,
  currency: 'جنيه مصري',
  dateFormat: 'dd/MM/yyyy',
  language: 'ar',
};

// ─── Storage Keys ────────────────────────────────────────────
export const STORAGE_KEYS = {
  PRODUCTS: 'sf_products',
  SALESMEN: 'sf_salesmen',
  STOCK_TRANSACTIONS: 'sf_stock_transactions',
  LOADING_TRANSACTIONS: 'sf_loading_transactions',
  RETURN_TRANSACTIONS: 'sf_return_transactions',
  DAMAGE_RECORDS: 'sf_damage_records',
  STOCKTAKING_SESSIONS: 'sf_stocktaking_sessions',
  SETTINGS: 'sf_settings',
  DATA_VERSION: 'sf_data_version',
  INITIALIZED: 'sf_initialized',
};

export const DATA_VERSION = '1.0.0';

// ─── UI Constants ─────────────────────────────────────────────
export const ITEMS_PER_PAGE = 20;
export const DEBOUNCE_DELAY = 300;

// ─── Validation ───────────────────────────────────────────────
export const MAX_QUANTITY = 999999;
export const MIN_QUANTITY = 1;
export const MAX_PIECES_PER_SHRINK = 999;
export const MIN_PIECES_PER_SHRINK = 1;
