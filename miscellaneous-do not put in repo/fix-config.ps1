# fix-config.ps1
# Run this from the folder containing your downloaded JSON key file.
# It will generate a correct config.js with the private key properly formatted.
#
# Usage:
#   1. Place this script in the same folder as your JSON key file
#   2. Open PowerShell in that folder
#   3. Run: .\fix-config.ps1 -JsonFile "your-key-file.json"
#   4. Upload the generated config.js to the NAS

param(
  [Parameter(Mandatory=$true)]
  [string]$JsonFile
)

# Read and parse the JSON key file
$json = Get-Content $JsonFile -Raw | ConvertFrom-Json

$clientEmail = $json.client_email
$privateKey  = $json.private_key

# Verify we got the values
if (-not $clientEmail) { Write-Error "Could not find client_email in JSON file"; exit 1 }
if (-not $privateKey)  { Write-Error "Could not find private_key in JSON file";  exit 1 }

# Ensure the private key uses \n literals, not real newlines
# (PowerShell's ConvertFrom-Json will have converted \n to real newlines)
$privateKey = $privateKey -replace "`r`n", "\n" -replace "`n", "\n"

# Write config.js
$output = @"
const CONFIG = {

  SPREADSHEET_ID: '1vHfLOEJW3dDB7XsaNfj7Q13c706QZO-ot5QebmmKRhQ',

  SERVICE_ACCOUNT: {
    client_email: '$clientEmail',
    private_key:  '$privateKey',
  },

  APP_NAME: 'Rental Portfolio',
  BASE_CURRENCY: 'DKK',

  FX_RATES: {
    DKK: 1,
    PLN: 0.44,
    EUR: 7.46,
    USD: 6.89,
  },

  SHEETS: {
    APARTMENTS:   'apartments',
    TRANSACTIONS: 'transactions',
    RULES:        'rules',
    FX_LOG:       'fx_log',
  }
};

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
"@

$output | Out-File -FilePath "config.js" -Encoding UTF8
Write-Host "config.js written successfully." -ForegroundColor Green
Write-Host "Upload this file to /volume1/web/rental/config.js on your NAS." -ForegroundColor Cyan
