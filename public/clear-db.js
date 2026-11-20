// STOCKFLOW — One-time clear script
// Run this in browser console OR as a standalone page to wipe IndexedDB

// Delete the entire StockFlowDB from IndexedDB
const req = indexedDB.deleteDatabase('StockFlowDB');
req.onsuccess = () => {
  console.log('[StockFlow] IndexedDB cleared. Reloading...');
  location.reload();
};
req.onerror = () => console.error('Failed to clear IndexedDB');
req.onblocked = () => {
  console.warn('Database is open in another tab. Close other tabs and retry.');
};
