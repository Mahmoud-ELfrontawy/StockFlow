// ============================================================
// STOCKFLOW — INITIAL INVENTORY (Demo Data)
// Historical stock transactions for realistic demonstration.
// ============================================================

import { TRANSACTION_TYPES, RETURN_CONDITIONS } from '../utils/constants';

// ─── Stock Transactions (Opening Balances + Stock In + Movements) ─────────────
export const initialStockTransactions = [
  // ─── Opening Balances ───────────────────────────────────────
  { id: 'tx-ob-001', type: TRANSACTION_TYPES.OPENING_BALANCE, productId: 'prod-001', quantityPieces: 2400, referenceNumber: 'OB-001', notes: 'رصيد افتتاحي', createdAt: '2024-11-01T08:00:00.000Z', salesmanId: null },
  { id: 'tx-ob-002', type: TRANSACTION_TYPES.OPENING_BALANCE, productId: 'prod-002', quantityPieces: 1920, referenceNumber: 'OB-002', notes: 'رصيد افتتاحي', createdAt: '2024-11-01T08:00:00.000Z', salesmanId: null },
  { id: 'tx-ob-003', type: TRANSACTION_TYPES.OPENING_BALANCE, productId: 'prod-003', quantityPieces: 1440, referenceNumber: 'OB-003', notes: 'رصيد افتتاحي', createdAt: '2024-11-01T08:00:00.000Z', salesmanId: null },
  { id: 'tx-ob-004', type: TRANSACTION_TYPES.OPENING_BALANCE, productId: 'prod-004', quantityPieces: 300, referenceNumber: 'OB-004', notes: 'رصيد افتتاحي', createdAt: '2024-11-01T08:00:00.000Z', salesmanId: null },
  { id: 'tx-ob-005', type: TRANSACTION_TYPES.OPENING_BALANCE, productId: 'prod-005', quantityPieces: 4800, referenceNumber: 'OB-005', notes: 'رصيد افتتاحي', createdAt: '2024-11-01T08:00:00.000Z', salesmanId: null },
  { id: 'tx-ob-006', type: TRANSACTION_TYPES.OPENING_BALANCE, productId: 'prod-006', quantityPieces: 720, referenceNumber: 'OB-006', notes: 'رصيد افتتاحي', createdAt: '2024-11-01T08:00:00.000Z', salesmanId: null },
  { id: 'tx-ob-007', type: TRANSACTION_TYPES.OPENING_BALANCE, productId: 'prod-007', quantityPieces: 480, referenceNumber: 'OB-007', notes: 'رصيد افتتاحي', createdAt: '2024-11-01T08:00:00.000Z', salesmanId: null },
  { id: 'tx-ob-008', type: TRANSACTION_TYPES.OPENING_BALANCE, productId: 'prod-008', quantityPieces: 360, referenceNumber: 'OB-008', notes: 'رصيد افتتاحي', createdAt: '2024-11-01T08:00:00.000Z', salesmanId: null },
  { id: 'tx-ob-009', type: TRANSACTION_TYPES.OPENING_BALANCE, productId: 'prod-009', quantityPieces: 720, referenceNumber: 'OB-009', notes: 'رصيد افتتاحي', createdAt: '2024-11-01T08:00:00.000Z', salesmanId: null },
  { id: 'tx-ob-010', type: TRANSACTION_TYPES.OPENING_BALANCE, productId: 'prod-010', quantityPieces: 480, referenceNumber: 'OB-010', notes: 'رصيد افتتاحي', createdAt: '2024-11-01T08:00:00.000Z', salesmanId: null },
  { id: 'tx-ob-011', type: TRANSACTION_TYPES.OPENING_BALANCE, productId: 'prod-011', quantityPieces: 600, referenceNumber: 'OB-011', notes: 'رصيد افتتاحي', createdAt: '2024-11-01T08:00:00.000Z', salesmanId: null },
  { id: 'tx-ob-012', type: TRANSACTION_TYPES.OPENING_BALANCE, productId: 'prod-012', quantityPieces: 1200, referenceNumber: 'OB-012', notes: 'رصيد افتتاحي', createdAt: '2024-11-01T08:00:00.000Z', salesmanId: null },
  { id: 'tx-ob-013', type: TRANSACTION_TYPES.OPENING_BALANCE, productId: 'prod-013', quantityPieces: 1440, referenceNumber: 'OB-013', notes: 'رصيد افتتاحي', createdAt: '2024-11-01T08:00:00.000Z', salesmanId: null },

  // ─── Stock In - November 2024 ────────────────────────────────
  { id: 'tx-si-001', type: TRANSACTION_TYPES.STOCK_IN, productId: 'prod-001', quantityPieces: 2400, referenceNumber: 'SI-001', notes: 'استلام من المورد - الموردون المتحدون', createdAt: '2024-11-03T09:30:00.000Z', salesmanId: null },
  { id: 'tx-si-002', type: TRANSACTION_TYPES.STOCK_IN, productId: 'prod-002', quantityPieces: 1920, referenceNumber: 'SI-001', notes: 'استلام من المورد - الموردون المتحدون', createdAt: '2024-11-03T09:30:00.000Z', salesmanId: null },
  { id: 'tx-si-003', type: TRANSACTION_TYPES.STOCK_IN, productId: 'prod-005', quantityPieces: 4800, referenceNumber: 'SI-002', notes: 'استلام مياه نستله', createdAt: '2024-11-05T10:00:00.000Z', salesmanId: null },
  { id: 'tx-si-004', type: TRANSACTION_TYPES.STOCK_IN, productId: 'prod-001', quantityPieces: 1200, referenceNumber: 'SI-003', notes: 'استلام إضافي', createdAt: '2024-11-10T09:00:00.000Z', salesmanId: null },
  { id: 'tx-si-005', type: TRANSACTION_TYPES.STOCK_IN, productId: 'prod-003', quantityPieces: 960, referenceNumber: 'SI-004', notes: 'استلام ميرندا', createdAt: '2024-11-10T09:00:00.000Z', salesmanId: null },
  { id: 'tx-si-006', type: TRANSACTION_TYPES.STOCK_IN, productId: 'prod-009', quantityPieces: 480, referenceNumber: 'SI-005', notes: 'استلام ريد بول', createdAt: '2024-11-12T11:00:00.000Z', salesmanId: null },
  { id: 'tx-si-007', type: TRANSACTION_TYPES.STOCK_IN, productId: 'prod-013', quantityPieces: 720, referenceNumber: 'SI-006', notes: 'استلام سبرايت', createdAt: '2024-11-15T10:30:00.000Z', salesmanId: null },

  // ─── Loadings converted to stock transactions ─────────────────
  // Loading sm-001 on 2024-11-04
  { id: 'tx-ld-001', type: TRANSACTION_TYPES.LOADING, productId: 'prod-001', quantityPieces: 840, referenceNumber: 'LD-001', notes: 'تحميل لأحمد محمد علي', createdAt: '2024-11-04T07:00:00.000Z', salesmanId: 'sm-001' },
  { id: 'tx-ld-002', type: TRANSACTION_TYPES.LOADING, productId: 'prod-005', quantityPieces: 480, referenceNumber: 'LD-001', notes: 'تحميل لأحمد محمد علي', createdAt: '2024-11-04T07:00:00.000Z', salesmanId: 'sm-001' },
  // Loading sm-002 on 2024-11-04
  { id: 'tx-ld-003', type: TRANSACTION_TYPES.LOADING, productId: 'prod-001', quantityPieces: 720, referenceNumber: 'LD-002', notes: 'تحميل لمحمود حسن', createdAt: '2024-11-04T07:30:00.000Z', salesmanId: 'sm-002' },
  { id: 'tx-ld-004', type: TRANSACTION_TYPES.LOADING, productId: 'prod-002', quantityPieces: 480, referenceNumber: 'LD-002', notes: 'تحميل لمحمود حسن', createdAt: '2024-11-04T07:30:00.000Z', salesmanId: 'sm-002' },
  // Loading sm-003 on 2024-11-04
  { id: 'tx-ld-005', type: TRANSACTION_TYPES.LOADING, productId: 'prod-003', quantityPieces: 480, referenceNumber: 'LD-003', notes: 'تحميل لعمر عبد الله', createdAt: '2024-11-04T08:00:00.000Z', salesmanId: 'sm-003' },
  { id: 'tx-ld-006', type: TRANSACTION_TYPES.LOADING, productId: 'prod-005', quantityPieces: 240, referenceNumber: 'LD-003', notes: 'تحميل لعمر عبد الله', createdAt: '2024-11-04T08:00:00.000Z', salesmanId: 'sm-003' },

  // Loading sm-001 on 2024-11-11
  { id: 'tx-ld-007', type: TRANSACTION_TYPES.LOADING, productId: 'prod-001', quantityPieces: 600, referenceNumber: 'LD-004', notes: 'تحميل لأحمد محمد', createdAt: '2024-11-11T07:00:00.000Z', salesmanId: 'sm-001' },
  // Loading sm-004 on 2024-11-11
  { id: 'tx-ld-008', type: TRANSACTION_TYPES.LOADING, productId: 'prod-009', quantityPieces: 240, referenceNumber: 'LD-005', notes: 'تحميل لخالد سعيد', createdAt: '2024-11-11T07:30:00.000Z', salesmanId: 'sm-004' },
  { id: 'tx-ld-009', type: TRANSACTION_TYPES.LOADING, productId: 'prod-005', quantityPieces: 480, referenceNumber: 'LD-005', notes: 'تحميل لخالد سعيد', createdAt: '2024-11-11T07:30:00.000Z', salesmanId: 'sm-004' },
  // Loading sm-005 on 2024-11-13
  { id: 'tx-ld-010', type: TRANSACTION_TYPES.LOADING, productId: 'prod-013', quantityPieces: 480, referenceNumber: 'LD-006', notes: 'تحميل ليوسف عادل', createdAt: '2024-11-13T07:00:00.000Z', salesmanId: 'sm-005' },
  { id: 'tx-ld-011', type: TRANSACTION_TYPES.LOADING, productId: 'prod-003', quantityPieces: 288, referenceNumber: 'LD-006', notes: 'تحميل ليوسف عادل', createdAt: '2024-11-13T07:00:00.000Z', salesmanId: 'sm-005' },
  // Loading sm-006 on 2024-11-14
  { id: 'tx-ld-012', type: TRANSACTION_TYPES.LOADING, productId: 'prod-002', quantityPieces: 480, referenceNumber: 'LD-007', notes: 'تحميل لسامي رضا', createdAt: '2024-11-14T07:00:00.000Z', salesmanId: 'sm-006' },
  { id: 'tx-ld-013', type: TRANSACTION_TYPES.LOADING, productId: 'prod-011', quantityPieces: 240, referenceNumber: 'LD-007', notes: 'تحميل لسامي رضا', createdAt: '2024-11-14T07:00:00.000Z', salesmanId: 'sm-006' },
  // Loading sm-007 on 2024-11-15
  { id: 'tx-ld-014', type: TRANSACTION_TYPES.LOADING, productId: 'prod-001', quantityPieces: 480, referenceNumber: 'LD-008', notes: 'تحميل لطارق أحمد', createdAt: '2024-11-15T07:00:00.000Z', salesmanId: 'sm-007' },
  { id: 'tx-ld-015', type: TRANSACTION_TYPES.LOADING, productId: 'prod-005', quantityPieces: 240, referenceNumber: 'LD-008', notes: 'تحميل لطارق أحمد', createdAt: '2024-11-15T07:00:00.000Z', salesmanId: 'sm-007' },

  // ─── Returns ─────────────────────────────────────────────────
  { id: 'tx-ret-001', type: TRANSACTION_TYPES.RETURN_GOOD, productId: 'prod-001', quantityPieces: 120, referenceNumber: 'RET-001', notes: 'مرتجع سليم من أحمد محمد', createdAt: '2024-11-08T16:00:00.000Z', salesmanId: 'sm-001' },
  { id: 'tx-ret-002', type: TRANSACTION_TYPES.RETURN_GOOD, productId: 'prod-005', quantityPieces: 48, referenceNumber: 'RET-002', notes: 'مرتجع سليم من محمود حسن', createdAt: '2024-11-09T16:30:00.000Z', salesmanId: 'sm-002' },

  // ─── Damage ───────────────────────────────────────────────────
  { id: 'tx-dmg-001', type: TRANSACTION_TYPES.DAMAGE, productId: 'prod-001', quantityPieces: 48, referenceNumber: 'DMG-001', notes: 'علب مهشمة أثناء التخزين', createdAt: '2024-11-07T14:00:00.000Z', salesmanId: null },
  { id: 'tx-dmg-002', type: TRANSACTION_TYPES.DAMAGE, productId: 'prod-005', quantityPieces: 24, referenceNumber: 'DMG-002', notes: 'زجاجات مكسورة', createdAt: '2024-11-12T15:00:00.000Z', salesmanId: null },
];

// ─── Loading Transactions (Full records) ─────────────────────
export const initialLoadingTransactions = [
  {
    id: 'load-001',
    referenceNumber: 'LD-001',
    date: '2024-11-04',
    salesmanId: 'sm-001',
    items: [
      { productId: 'prod-001', quantityPieces: 840, quantityShrinks: 35, piecesPerShrink: 24 },
      { productId: 'prod-005', quantityPieces: 480, quantityShrinks: 20, piecesPerShrink: 24 },
    ],
    notes: 'تحميل صباحي',
    createdAt: '2024-11-04T07:00:00.000Z',
  },
  {
    id: 'load-002',
    referenceNumber: 'LD-002',
    date: '2024-11-04',
    salesmanId: 'sm-002',
    items: [
      { productId: 'prod-001', quantityPieces: 720, quantityShrinks: 30, piecesPerShrink: 24 },
      { productId: 'prod-002', quantityPieces: 480, quantityShrinks: 20, piecesPerShrink: 24 },
    ],
    notes: 'تحميل صباحي',
    createdAt: '2024-11-04T07:30:00.000Z',
  },
  {
    id: 'load-003',
    referenceNumber: 'LD-003',
    date: '2024-11-04',
    salesmanId: 'sm-003',
    items: [
      { productId: 'prod-003', quantityPieces: 480, quantityShrinks: 20, piecesPerShrink: 24 },
      { productId: 'prod-005', quantityPieces: 240, quantityShrinks: 10, piecesPerShrink: 24 },
    ],
    notes: 'تحميل صباحي',
    createdAt: '2024-11-04T08:00:00.000Z',
  },
  {
    id: 'load-004',
    referenceNumber: 'LD-004',
    date: '2024-11-11',
    salesmanId: 'sm-001',
    items: [
      { productId: 'prod-001', quantityPieces: 600, quantityShrinks: 25, piecesPerShrink: 24 },
    ],
    notes: 'تحميل أسبوعي',
    createdAt: '2024-11-11T07:00:00.000Z',
  },
  {
    id: 'load-005',
    referenceNumber: 'LD-005',
    date: '2024-11-11',
    salesmanId: 'sm-004',
    items: [
      { productId: 'prod-009', quantityPieces: 240, quantityShrinks: 10, piecesPerShrink: 24 },
      { productId: 'prod-005', quantityPieces: 480, quantityShrinks: 20, piecesPerShrink: 24 },
    ],
    notes: 'تحميل أسبوعي',
    createdAt: '2024-11-11T07:30:00.000Z',
  },
  {
    id: 'load-006',
    referenceNumber: 'LD-006',
    date: '2024-11-13',
    salesmanId: 'sm-005',
    items: [
      { productId: 'prod-013', quantityPieces: 480, quantityShrinks: 20, piecesPerShrink: 24 },
      { productId: 'prod-003', quantityPieces: 288, quantityShrinks: 12, piecesPerShrink: 24 },
    ],
    notes: 'تحميل',
    createdAt: '2024-11-13T07:00:00.000Z',
  },
  {
    id: 'load-007',
    referenceNumber: 'LD-007',
    date: '2024-11-14',
    salesmanId: 'sm-006',
    items: [
      { productId: 'prod-002', quantityPieces: 480, quantityShrinks: 20, piecesPerShrink: 24 },
      { productId: 'prod-011', quantityPieces: 240, quantityShrinks: 10, piecesPerShrink: 24 },
    ],
    notes: 'تحميل',
    createdAt: '2024-11-14T07:00:00.000Z',
  },
  {
    id: 'load-008',
    referenceNumber: 'LD-008',
    date: '2024-11-15',
    salesmanId: 'sm-007',
    items: [
      { productId: 'prod-001', quantityPieces: 480, quantityShrinks: 20, piecesPerShrink: 24 },
      { productId: 'prod-005', quantityPieces: 240, quantityShrinks: 10, piecesPerShrink: 24 },
    ],
    notes: 'تحميل',
    createdAt: '2024-11-15T07:00:00.000Z',
  },
];

// ─── Return Transactions ─────────────────────────────────────
export const initialReturnTransactions = [
  {
    id: 'ret-001',
    referenceNumber: 'RET-001',
    date: '2024-11-08',
    salesmanId: 'sm-001',
    productId: 'prod-001',
    quantityPieces: 120,
    quantityShrinks: 5,
    piecesPerShrink: 24,
    condition: RETURN_CONDITIONS.GOOD,
    notes: 'مرتجع بضاعة سليمة',
    createdAt: '2024-11-08T16:00:00.000Z',
  },
  {
    id: 'ret-002',
    referenceNumber: 'RET-002',
    date: '2024-11-09',
    salesmanId: 'sm-002',
    productId: 'prod-005',
    quantityPieces: 48,
    quantityShrinks: 2,
    piecesPerShrink: 24,
    condition: RETURN_CONDITIONS.GOOD,
    notes: 'مرتجع بضاعة سليمة',
    createdAt: '2024-11-09T16:30:00.000Z',
  },
];

// ─── Damage Records ───────────────────────────────────────────
export const initialDamageRecords = [
  {
    id: 'dmg-001',
    referenceNumber: 'DMG-001',
    date: '2024-11-07',
    productId: 'prod-001',
    quantityPieces: 48,
    quantityShrinks: 2,
    piecesPerShrink: 24,
    source: 'warehouse',
    reason: 'علب مهشمة أثناء التخزين',
    salesmanId: null,
    reviewStatus: 'approved',
    notes: 'تلف مخزن',
    createdAt: '2024-11-07T14:00:00.000Z',
  },
  {
    id: 'dmg-002',
    referenceNumber: 'DMG-002',
    date: '2024-11-12',
    productId: 'prod-005',
    quantityPieces: 24,
    quantityShrinks: 1,
    piecesPerShrink: 24,
    source: 'transport',
    reason: 'زجاجات مكسورة أثناء النقل',
    salesmanId: null,
    reviewStatus: 'approved',
    notes: 'تلف نقل',
    createdAt: '2024-11-12T15:00:00.000Z',
  },
];
