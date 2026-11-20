// ============================================================
// STOCKFLOW — FORMATTERS
// Date, number, and display formatting utilities.
// ============================================================

import { format, parseISO, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';

/**
 * Format a date string for display.
 * @param {string|Date} date
 * @param {string} fmt
 */
export function formatDate(date, fmt = 'dd/MM/yyyy') {
  if (!date) return '—';
  try {
    const parsed = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(parsed)) return '—';
    return format(parsed, fmt, { locale: ar });
  } catch {
    return '—';
  }
}

/**
 * Format a date with time.
 */
export function formatDateTime(date) {
  return formatDate(date, 'dd/MM/yyyy - HH:mm');
}

/**
 * Format a number with Arabic-friendly thousands separator.
 */
export function formatNumber(num) {
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('ar-EG');
}

/**
 * Format quantity as shrinks + pieces.
 * @param {number} pieces
 * @param {number} piecesPerShrink
 */
export function formatQty(pieces, piecesPerShrink) {
  if (!pieces || pieces === 0) return '٠';
  if (!piecesPerShrink || piecesPerShrink <= 0) {
    return `${formatNumber(pieces)} ق`;
  }
  const shrinks = Math.floor(pieces / piecesPerShrink);
  const rem = pieces % piecesPerShrink;
  if (rem === 0) {
    return `${formatNumber(shrinks)} شرنك`;
  }
  return `${formatNumber(shrinks)} شرنك + ${formatNumber(rem)} ق`;
}

/**
 * Format a reference number for display.
 */
export function formatRef(ref) {
  return ref ? `#${ref}` : '—';
}

/**
 * Truncate text with ellipsis.
 */
export function truncate(text, maxLength = 40) {
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

/**
 * Get today's date as ISO string (date only).
 */
export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get current timestamp as ISO string.
 */
export function nowISO() {
  return new Date().toISOString();
}
