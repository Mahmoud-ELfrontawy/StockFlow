// ============================================================
// STOCKFLOW — STORAGE SERVICE
// Centralized local storage abstraction.
// All reads and writes to browser storage go through here.
// ============================================================

import { STORAGE_KEYS, DATA_VERSION } from '../utils/constants';

class StorageService {
  /**
   * Read a value from localStorage.
   * Returns null if key does not exist or parse fails.
   */
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.error(`[StorageService] Failed to read key "${key}":`, err);
      return null;
    }
  }

  /**
   * Write a value to localStorage.
   */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error(`[StorageService] Failed to write key "${key}":`, err);
      return false;
    }
  }

  /**
   * Remove a key from localStorage.
   */
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.error(`[StorageService] Failed to remove key "${key}":`, err);
    }
  }

  /**
   * Check whether the app has been initialized with demo data.
   */
  isInitialized() {
    return this.get(STORAGE_KEYS.INITIALIZED) === true;
  }

  /**
   * Mark the app as initialized.
   */
  markInitialized() {
    this.set(STORAGE_KEYS.INITIALIZED, true);
    this.set(STORAGE_KEYS.DATA_VERSION, DATA_VERSION);
  }

  /**
   * Export all application data as a JSON backup object.
   */
  exportBackup() {
    const backup = {
      version: DATA_VERSION,
      exportedAt: new Date().toISOString(),
      data: {},
    };

    Object.entries(STORAGE_KEYS).forEach(([, key]) => {
      const value = this.get(key);
      if (value !== null) {
        backup.data[key] = value;
      }
    });

    return backup;
  }

  /**
   * Import a backup object into localStorage.
   * Validates version before restoring.
   *
   * @param {object} backup
   * @returns {{ success: boolean, message: string }}
   */
  importBackup(backup) {
    if (!backup || typeof backup !== 'object') {
      return { success: false, message: 'ملف النسخة الاحتياطية غير صالح' };
    }

    if (!backup.version || !backup.data) {
      return {
        success: false,
        message: 'تنسيق ملف النسخة الاحتياطية غير معروف',
      };
    }

    try {
      Object.entries(backup.data).forEach(([key, value]) => {
        this.set(key, value);
      });
      return { success: true, message: 'تم استعادة النسخة الاحتياطية بنجاح' };
    } catch (err) {
      return {
        success: false,
        message: `فشل استعادة البيانات: ${err.message}`,
      };
    }
  }

  /**
   * Clear all StockFlow data from localStorage.
   * Does NOT clear other sites' data.
   */
  clearAll() {
    Object.values(STORAGE_KEYS).forEach((key) => {
      this.remove(key);
    });
  }

  /**
   * Calculate approximate storage usage in bytes.
   */
  getStorageSize() {
    let total = 0;
    Object.values(STORAGE_KEYS).forEach((key) => {
      const item = localStorage.getItem(key);
      if (item) total += item.length * 2; // UTF-16
    });
    return total;
  }
}

export const storageService = new StorageService();
