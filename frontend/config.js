// ============================================================
//  LANDLORDGURU v2 — FRONTEND CONFIGURATION
//
//  This file is kept for reference only. v2 uses backend API.
//  No credentials are stored here — authentication is handled
//  via Google OAuth at /auth/google.
// ============================================================

export const CONFIG = {
  // App display settings
  APP_NAME: 'LandlordGuru',
  BASE_CURRENCY: 'DKK',

  // Approximate exchange rates for portfolio-level summary display only.
  // These are NOT used for bookkeeping — each apartment keeps its own currency.
  // Update periodically.
  FX_RATES: {
    DKK: 1,
    PLN: 0.44,
    EUR: 7.46,
    USD: 6.89,
  }
};

// ── Category taxonomy ─────────────────────────────────────
// Single source of truth used by UI dropdowns and reporting.
export const CATEGORIES = {
  income: {
    label: 'Income',
    items: {
      rent:                { label: 'Rent' },
      heating_aconto:      { label: 'Heating & water (a/c)' },
      heating_settlement:  { label: 'Heating settlement' },
    }
  },
  expense: {
    label: 'Expense',
    items: {
      maintenance_repair:  { label: 'Maintenance & repair' },
      property_tax:        { label: 'Property tax' },
      insurance:           { label: 'Insurance' },
      utilities:           { label: 'Utilities' },
      management_fee:      { label: 'Management fee' },
      advertising:         { label: 'Advertising' },
      professional_fees:   { label: 'Professional fees' },
      bank_charges:        { label: 'Bank charges' },
      other_expense:       { label: 'Other expense', requiresNote: true },
    }
  },
  deposit: {
    label: 'Deposit',
    items: {
      deposit_received:    { label: 'Deposit received' },
      deposit_returned:    { label: 'Deposit returned' },
    }
  },
  transfer: {
    label: 'Transfer',
    items: {
      inter_account:       { label: 'Inter-account transfer' },
    }
  }
};

