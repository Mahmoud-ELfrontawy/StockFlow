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
      case TRANSACTION_TYPES.COMPANY_RETURN_DISPATCH:
        // Company returns are tracked in their own bucket and do NOT add to sellable stock
        return balance;
      case TRANSACTION_TYPES.RETURN_REPLACEMENT:
        // Replacement good stock given to salesman for returns
        return balance - tx.quantityPieces;
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
 * Calculate pending company returns balance in pieces for a product.
 * Formula: RETURN_DAMAGED (sorted/marked for company) - COMPANY_RETURN_DISPATCH (sent back to company)
 */
export function calculateCompanyReturnsStock(productId, transactions) {
  if (!Array.isArray(transactions)) return 0;

  return transactions
    .filter((tx) => tx.productId === productId)
    .reduce((balance, tx) => {
      if (tx.type === TRANSACTION_TYPES.RETURN_DAMAGED) {
        return balance + tx.quantityPieces;
      }
      if (tx.type === TRANSACTION_TYPES.COMPANY_RETURN_DISPATCH) {
        return balance - tx.quantityPieces;
      }
      return balance;
    }, 0);
}

/**
 * Calculate unsorted/pending returns balance in pieces for a product.
 */
export function calculatePendingReturnsStock(productId, returnTransactions) {
  if (!Array.isArray(returnTransactions)) return 0;

  return returnTransactions
    .filter(
      (r) => r.productId === productId && r.condition === RETURN_CONDITIONS.PENDING
    )
    .reduce((sum, r) => sum + (r.quantityPieces || 0), 0);
}

/**
 * Exact integer breakdown of pieces into Pallets, Shrinks, and Loose Pieces.
 */
export function breakdownStockQuantity(
  totalPieces,
  piecesPerShrink = 24,
  shrinksPerPallet = 169
) {
  const safePieces = Number.isFinite(totalPieces) ? Math.trunc(totalPieces) : 0;
  const pShrink = piecesPerShrink > 0 ? piecesPerShrink : 24;
  const sPallet = shrinksPerPallet > 0 ? shrinksPerPallet : 169;

  const sign = safePieces < 0 ? -1 : 1;
  const absPieces = Math.abs(safePieces);

  const totalShrinks = Math.floor(absPieces / pShrink);
  const loosePieces = absPieces % pShrink;
  const fullPallets = Math.floor(totalShrinks / sPallet);
  const remainingShrinks = totalShrinks % sPallet;

  return {
    totalPieces: safePieces,
    totalShrinks: sign * totalShrinks,
    loosePieces: sign * loosePieces,
    fullPallets: sign * fullPallets,
    remainingShrinks: sign * remainingShrinks,
  };
}

/**
 * Calculate a salesman's inventory balance for a specific product.
 * Balance = Loading - Confirmed Sales - Non-Exchange Returns
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
  salesRecords = [],
  damageRecords = []
) {
  // Total loaded to this salesman for this product
  const totalLoaded = loadingTransactions
    .filter((tx) => tx.salesmanId === salesmanId)
    .flatMap((tx) => tx.items || [])
    .filter((item) => item.productId === productId)
    .reduce((sum, item) => sum + item.quantityPieces, 0);

  // Non-exchange returns from this salesman reduce custody (exchange returns do NOT reduce custody)
  const totalNonExchangeReturns = returnTransactions
    .filter(
      (tx) =>
        tx.salesmanId === salesmanId &&
        tx.productId === productId &&
        !tx.isExchange
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

  // Damage attributed to a salesman or their transport reduces the stock in their custody.
  const totalAttributedDamage = damageRecords
    .filter((d) =>
      d.salesmanId === salesmanId &&
      d.productId === productId &&
      ['salesman', 'transport'].includes(d.source)
    )
    .reduce((sum, d) => sum + d.quantityPieces, 0);

  return totalLoaded - totalNonExchangeReturns - totalSales - totalAttributedDamage;
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
 * @param {Array} returnTransactions - optional return docs to include pending (unsorted) stock
 * @returns {Array} products with stock info
 */
export function buildWarehouseStockSummary(products, transactions, returnTransactions = []) {
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

      const totalCompanyReturned = productTx
        .filter((tx) => tx.type === TRANSACTION_TYPES.RETURN_DAMAGED)
        .reduce((sum, tx) => sum + tx.quantityPieces, 0);

      const totalCompanyDispatched = productTx
        .filter((tx) => tx.type === TRANSACTION_TYPES.COMPANY_RETURN_DISPATCH)
        .reduce((sum, tx) => sum + tx.quantityPieces, 0);

      const totalDamaged = productTx
        .filter((tx) => tx.type === TRANSACTION_TYPES.DAMAGE)
        .reduce((sum, tx) => sum + tx.quantityPieces, 0);

      const openingBalance = productTx
        .filter((tx) => tx.type === TRANSACTION_TYPES.OPENING_BALANCE)
        .reduce((sum, tx) => sum + tx.quantityPieces, 0);

      // Good stock available for sale / loading
      const currentStock = calculateWarehouseStock(product.id, transactions);
      // Sorted returns earmarked to go back to the company
      const companyReturnsStock = calculateCompanyReturnsStock(product.id, transactions);
      // Unsorted returns still pending inspection
      const pendingReturnsStock = calculatePendingReturnsStock(product.id, returnTransactions);
      // Total physical stock physically inside the warehouse (Good + Company Returns + Pending Inspection)
      const totalPhysicalStock = currentStock + companyReturnsStock + pendingReturnsStock;

      const lastTx = productTx.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      )[0];

      const pPerShrink = product.piecesPerShrink || 24;
      const sPerPallet = product.shrinksPerPallet || 169;

      const goodBreakdown = breakdownStockQuantity(currentStock, pPerShrink, sPerPallet);
      const companyBreakdown = breakdownStockQuantity(companyReturnsStock, pPerShrink, sPerPallet);
      const pendingBreakdown = breakdownStockQuantity(pendingReturnsStock, pPerShrink, sPerPallet);
      const physicalBreakdown = breakdownStockQuantity(totalPhysicalStock, pPerShrink, sPerPallet);

      const currentStockShrinks = goodBreakdown.totalShrinks;
      const minStockShrinks = product.minimumStock || 0;
      const minStockPieces = minStockShrinks * pPerShrink;

      return {
        ...product,
        openingBalance,
        totalReceived,
        totalDispatched,
        totalGoodReturned,
        totalCompanyReturned,
        totalCompanyDispatched,
        totalDamaged,
        currentStock,
        currentStockShrinks,
        companyReturnsStock,
        pendingReturnsStock,
        totalPhysicalStock,
        goodBreakdown,
        companyBreakdown,
        pendingBreakdown,
        physicalBreakdown,
        minimumStockShrinks: minStockShrinks,
        minimumStockPieces: minStockPieces,
        lastMovementDate: lastTx?.createdAt || null,
        isLowStock: currentStockShrinks < minStockShrinks,
      };
    });
}
