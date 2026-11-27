// ============================================================
// STOCKFLOW — MAIN ENTRY POINT
// ============================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import './index.css';

// Automatically convert any typed or pasted Arabic numerals (٠-٩) to English digits (0-9)
if (typeof window !== 'undefined') {
  document.addEventListener(
    'input',
    (e) => {
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        if (/[٠-٩]/.test(target.value)) {
          const start = target.selectionStart;
          const end = target.selectionEnd;
          target.value = target.value.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
          if (start !== null && end !== null && target.type !== 'number') {
            try {
              target.setSelectionRange(start, end);
            } catch {
              // ignore selection range errors on unsupported input types
            }
          }
        }
      }
    },
    true
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
