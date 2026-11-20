// ============================================================
// STOCKFLOW — STOCK CALCULATIONS
// Core warehouse and salesman balance calculation logic.
// All stock math must go through these functions.
// ============================================================

import { TRANSACTION_TYPES, RETURN_CONDITIONS } from './constants';

/**
 * Calculate current warehouse stock for a product.
 * Formula: Opening + StockIn - Loading + GoodReturns - Damage - Adjustments
 *
 * @param {string} productId
 * @param {Array} transactions - all stock transactions for this product
 * @returns {number} current stock in pieces
 */
export function calculateWarehouseStock(productId, transactions) {
  if (!Array.isArray(transactions)) return 0;

  const productTx = transactions.filter((tx) => tx.productId === productId);

  return productTx.reduce((balance, tx) => {
    switch (tx.type) {
      case TRANSACTION_TYPES.OPENING_BALANCE:
        return balance + tx.quantityPieces;
      case TRANSACTION_TYPES.STOCK_IN:
        return balance + tx.quantityPieces;
      case TRANSACTION_TYPES.LOADING:
        return balance - tx.quantityPieces;
      case TRANSACTION_TYPES.RETURN_GOOD:
        return balance + tx.quantityPieces;
      case TRANSACTION_TYPES.RETURN_DAMAGED:
        // Damaged returns do NOT add back to available stock
        return balance;
      case TRANSACTION_TYPES.DAMAGE:
        return balance - tx.quantityPieces;
      case TRANSACTION_TYPES.ADJUSTMENT:
        // Can be positive (surplus) or negative (shortage)
        return balance + tx.quantityPieces;
      case TRANSACTION_TYPES.REVERSAL:
        // Reversal has the opposite effect of original
        return balance + tx.quantityPieces; // quantityPieces is signed
      default:
        return balance;
    }
  }, 0);
}

/**
 * Calculate stock balance at a specific point in time.
 *
 * @param {string} productId
 * @param {Array} transactions
 * @param {string} beforeDate - ISO date string (exclusive)
 * @returns {number}
 */
export function calculateStockAtDate(productId, transactions, beforeDate) {
  const cutoff = new Date(beforeDate);
  const filtered = transactions.filter(
    (tx) => tx.productId === productId && new Date(tx.createdAt) < cutoff
  );
  return calculateWarehouseStock(productId, filtered);
}

/**
 * Calculate a salesman's inventory balance for a specific product.
 * Balance = Loading - Confirmed Sales - Good Returns - Other Outgoing Adjustments
 *
 * @param {string} salesmanId
 * @param {string} productId
 * @param {Array} loadingTransactions
 * @param {Array} returnTransactions
 * @param {Array} salesRecords  (optional — only confirmed/verified)
 * @returns {number} balance in pieces
 */
export function calculateSalesmanProductBalance(
  salesmanId,
  productId,
  loadingTransactions,
  returnTransactions,
  salesRecords = []
) {
  // Total loaded to this salesman for this product
  const totalLoaded = loadingTransactions
    .filter((tx) => tx.salesmanId === salesmanId)
    .flatMap((tx) => tx.items || [])
    .filter((item) => item.productId === productId)
    .reduce((sum, item) => sum + item.quantityPieces, 0);

  // Good returns from this salesman for this product
  const totalGoodReturns = returnTransactions
    .filter(
      (tx) =>
        tx.salesmanId === salesmanId &&
        tx.productId === productId &&
        tx.condition === RETURN_CONDITIONS.GOOD
    )
    .reduce((sum, tx) => sum + tx.quantityPieces, 0);

  // Confirmed sales (from admin-sourced records only)
  const totalSales = salesRecords
    .filter(
      (s) =>
        s.salesmanId === salesmanId &&
        s.productId === productId &&
        s.isVerified === true
    )
    .reduce((sum, s) => sum + s.quantityPieces, 0);

  return totalLoaded - totalGoodReturns - totalSales;
}

/**
 * Convert shrinks to pieces.
 */
export function shrinksToPieces(shrinks, piecesPerShrink) {
  if (!Number.isFinite(shrinks) || !Number.isFinite(piecesPerShrink)) return 0;
  if (piecesPerShrink <= 0) return 0;
  return Math.round(shrinks * piecesPerShrink);
}

/**
 * Convert pieces to shrinks (may be fractional).
 */
export function piecesToShrinks(pieces, piecesPerShrink) {
  if (!Number.isFinite(pieces) || !Number.isFinite(piecesPerShrink)) return 0;
  if (piecesPerShrink <= 0) return 0;
  return pieces / piecesPerShrink;
}

/**
 * Format a piece count as "X شرنك + Y قطعة".
 */
export function formatQuantityDisplay(pieces, piecesPerShrink) {
  if (!Number.isFinite(pieces) || pieces <= 0) return '0';
  if (!Number.isFinite(piecesPerShrink) || piecesPerShrink <= 0) {
    return `${pieces} قطعة`;
  }
  const shrinks = Math.floor(pieces / piecesPerShrink);
  const remainder = pieces % piecesPerShrink;
  if (remainder === 0) return `${shrinks} شرنك`;
  return `${shrinks} شرنك + ${remainder} قطعة`;
}

/**
 * Validate that a requested quantity is available in the warehouse.
 *
 * @returns {{ valid: boolean, message?: string }}
 */
export function validateStockAvailability(
  requestedPieces,
  availablePieces,
  productName = 'المنتج'
) {
  if (requestedPieces <= 0) {
    return { valid: false, message: 'الكمية المطلوبة يجب أن تكون أكبر من صفر' };
  }
  if (requestedPieces > availablePieces) {
    return {
      valid: false,
      message: `الكمية المطلوبة (${requestedPieces} قطعة) تتجاوز المخزون المتاح (${availablePieces} قطعة) من ${productName}`,
    };
  }
  return { valid: true };
}

/**
 * Calculate warehouse balance before and after a transaction.
 * Used when creating ledger entries.
 */
export function calculateBalanceBeforeAndAfter(
  productId,
  transactions,
  newTransaction
) {
  const before = calculateWarehouseStock(productId, transactions);
  const after = calculateWarehouseStock(productId, [
    ...transactions,
    newTransaction,
  ]);
  return { before, after };
}

/**
 * Aggregate stock summary for all products.
 *
 * @param {Array} products
 * @param {Array} transactions
 * @returns {Array} products with stock info
 */
export function buildWarehouseStockSummary(products, transactions) {
  return products
    .filter((p) => p.isActive)
    .map((product) => {
      const productTx = transactions.filter(
        (tx) => tx.productId === product.id
      );

      const totalReceived = productTx
        .filter((tx) => tx.type === TRANSACTION_TYPES.STOCK_IN)
        .reduce((sum, tx) => sum + tx.quantityPieces, 0);

      const totalDispatched = productTx
        .filter((tx) => tx.type === TRANSACTION_TYPES.LOADING)
        .reduce((sum, tx) => sum + tx.quantityPieces, 0);

      const totalGoodReturned = productTx
        .filter((tx) => tx.type === TRANSACTION_TYPES.RETURN_GOOD)
        .reduce((sum, tx) => sum + tx.quantityPieces, 0);

      const totalDamaged = productTx
        .filter(
          (tx) =>
            tx.type === TRANSACTION_TYPES.DAMAGE ||
            tx.type === TRANSACTION_TYPES.RETURN_DAMAGED
        )
        .reduce((sum, tx) => sum + tx.quantityPieces, 0);

      const openingBalance = productTx
        .filter((tx) => tx.type === TRANSACTION_TYPES.OPENING_BALANCE)
        .reduce((sum, tx) => sum + tx.quantityPieces, 0);

      const currentStock = calculateWarehouseStock(product.id, transactions);

      const lastTx = productTx.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      )[0];

      const pPerShrink = product.piecesPerShrink || 24;
      const currentStockShrinks = Math.floor(currentStock / pPerShrink);
      const minStockShrinks = product.minimumStock || 0;
      const minStockPieces = minStockShrinks * pPerShrink;

      return {
        ...product,
        openingBalance,
        totalReceived,
        totalDispatched,
        totalGoodReturned,
        totalDamaged,
        currentStock,
        currentStockShrinks,
        minimumStockShrinks: minStockShrinks,
        minimumStockPieces: minStockPieces,
        lastMovementDate: lastTx?.createdAt || null,
        isLowStock: currentStockShrinks < minStockShrinks,
      };
    });
}
