// ============================================================
//  LANDLORDGURU — CONFIGURATION TEMPLATE
//
//  Copy this file to config.js and fill in your values.
//  config.js is gitignored and must never be committed.
//  Credentials are never stored here — they are served by key.php.
//  See docs/SETUP.md for step-by-step instructions.
// ============================================================

// ============================================================
//  LANDLORDGURU v2 — FRONTEND CONFIGURATION
//
//  This file is kept for reference only. v2 uses backend API.
//  No configuration is needed on the frontend — authentication
//  is handled via Google OAuth at /auth/google.
// ============================================================

const CONFIG = {
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
const CATEGORIES = {
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

// ── Bank import profiles ──────────────────────────────────
const BANK_PROFILES = {
  jyske_bank: {
    label: 'Jyske Bank (DK)',
    currency: 'DKK',
    delimiter: ';',
    date_col: 0,
    date_format: 'DD.MM.YYYY',
    description_col: 2,
    amount_col: 3,
    amount_decimal: ',',
    skip_rows: 1,
  },
  nordea_dk: {
    label: 'Nordea (DK)',
    currency: 'DKK',
    delimiter: ';',
    date_col: 0,
    date_format: 'DD-MM-YYYY',
    description_col: 3,
    amount_col: 4,
    amount_decimal: ',',
    skip_rows: 1,
  },
  mbank_pl: {
    label: 'mBank (PL)',
    currency: 'PLN',
    delimiter: ';',
    date_col: 0,
    date_format: 'YYYY-MM-DD',
    description_col: 3,
    amount_col: 6,
    amount_decimal: ',',
    skip_rows: 1,
  },
  generic_csv: {
    label: 'Generic CSV (date, description, amount)',
    currency: null,
    delimiter: ',',
    date_col: 0,
    date_format: 'YYYY-MM-DD',
    description_col: 1,
    amount_col: 2,
    amount_decimal: '.',
    skip_rows: 1,
  }
};
