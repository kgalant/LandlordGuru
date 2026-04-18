// ============================================================
//  LANDLORDGURU v2 — FRONTEND CONFIGURATION
//
//  This file is kept for reference only. v2 uses backend API.
//  No credentials are stored here — authentication is handled
//  via Google OAuth at /auth/google.
//
//  CATEGORIES and BANK_PROFILES must be defined here for CSV
//  import UI, since they are not secrets and need to be available
//  before the backend is fully loaded.
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
// Single source of truth used by UI dropdowns and reporting.
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
// Each profile defines how to parse a CSV from a specific bank.
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
