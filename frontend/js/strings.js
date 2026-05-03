// ============================================================
//  INTERNATIONALISATION (I18N)
//
//  Hardcoded English strings are the fallback layer.
//  Overrides and translations are loaded from the Strings sheet
//  at boot and layered on top.
//
//  Resolution order per key:
//    1. User-specific override  (sheet, current lang + user_id)
//    2. Global sheet string     (sheet, current lang, no user_id)
//    3. Hardcoded default       (STRINGS[lang])
//    4. English fallback        (STRINGS['en'])
//    5. Key itself
//
//  API:
//    t('nav.properties')                   — translate
//    t('status.synced', { time: '12:00' }) — with interpolation
//    I18n.initStrings(rows, userId)        — load sheet overrides
//    I18n.setLang('da')                    — switch language
// ============================================================

export const I18n = (() => {

  // ── Hardcoded English defaults ────────────────────────────

  const STRINGS = {
    en: {
      app: {
        title:  'LandlordGuru',
        header: 'Rental Portfolio',
      },
      nav: {
        dashboard:    'Dashboard',
        transactions: 'Transactions',
        import:       'Import',
        reports:      'Reports',
        properties:   'Properties',
        rules:        'Rules',
      },
      common: {
        save:        'Save',
        cancel:      'Cancel',
        edit:        'Edit',
        delete:      'Delete',
        clear:       'Clear',
        refresh:     '↺ Refresh',
        loading:     'Loading…',
        select:      'Select…',
        all:         'All',
        manual:      'manual',
        search:      'Search…',
        monthly:     'monthly',
        totalIncome: 'total income',
      },
      status: {
        connecting:  'Connecting to Google Sheets…',
        loadingData: 'Loading data…',
        saving:      'Saving…',
        deleting:    'Deleting…',
        importing:   'Importing…',
        savingRules: 'Saving rules…',
        synced:      'Synced {time}',
        syncError:   'Sync error',
        error:       'Error: {message}',
        connFailed:  'Connection failed: {error}',
      },
      dashboard: {
        recentTx: 'Recent transactions',
        viewAll:  'View all',
        noTx:     'No transactions yet',
        metrics: {
          activeProperties: 'Active properties',
          ytdIncome:        'YTD income',
          ytdSub:           'Jan–{month} {year} (DKK equiv.)',
          totalTx:          'Total transactions',
          txSub:            '{manual} manual · {imported} imported',
          unreconciled:     'Unreconciled',
          unreconciledSub:  'transactions to review',
        },
      },
      tx: {
        title:    'Transactions',
        addBtn:   '+ Add transaction',
        noTx:     'No transactions',
        noTxSub:  'Add one manually or import a bank statement.',
        footer:       '{count} transactions · Income: {income} · Expenses: {expenses}',
        footerPaged:  'Transactions {from} to {to} out of {total} · Income: {income} · Expenses: {expenses}',
        filter: {
          allProperties:  'All properties',
          allTypes:       'All types',
          allCats:        'All categories',
          unreconciled:   'Unreconciled only',
        },
        col: {
          date:        'Date',
          property:    'Property',
          type:        'Type',
          description: 'Description',
          category:    'Category',
          source:      'Source',
          amount:      'Amount',
          reconciled:  'Reconciled',
        },
        reconcileBtn:   '✓',
        unreconcileBtn: '○',
        modal: {
          addTitle:         'Add transaction',
          editTitle:        'Edit transaction',
          date:             'Date *',
          property:         'Property *',
          category:         'Category *',
          amount:           'Amount *',
          description:      'Description',
          notes:            'Notes',
          notesReq:         'Notes *',
          notesHint:        '⚠ Please describe what this expense was for.',
          saveBtn:          'Save transaction',
          deleteBtn:        'Delete',
          descPlaceholder:  'e.g. Rent June 2025',
          notesPlaceholder: 'Optional note…',
        },
        toast: {
          saved:        'Transaction saved.',
          updated:      'Transaction updated.',
          deleted:      'Transaction removed.',
          bulkDeleted:  '{count} transactions removed.',
          saveFailed:   'Save failed: {error}',
          delFailed:    'Delete failed: {error}',
          noneSelected: 'No transactions selected.',
          fillReq:      'Please fill in all required fields.',
          noteReq:      'Please add a note for "other expense".',
        },
        selected:           '{count} selected',
        bulkDelete:         'Delete selected',
        showConverted:      'Show in {currency}',
        confirmDelete:      'Delete this transaction? This cannot be undone.',
        confirmBulkDelete:  'Delete {count} transactions? This cannot be undone.',
      },
      import: {
        title:          'Import bank statement',
        bankProfile:    'Bank / profile',
        defaultProp:    'Default property',
        autoDetect:     'Auto-detect from rules',
        currency:       'Currency',
        dropZone:       'Drop CSV file here, or click to browse',
        dropZoneActive: 'Drop to load file',
        pasteToggle:    'or paste CSV instead',
        fileToggle:     'or upload a file instead',
        csvLabel:       'CSV data — paste your bank export here',
        csvPlaceholder: 'Paste CSV content here. The first row should be headers.\n\nExample (Jyske Bank):\nDato;Tekst;Betalingstype;Beloeb\n15.04.2025;RICHARD SABUMBA HUSLEJE;Kredit;16700,00',
        previewBtn:     'Preview import',
        previewHint:    'Select a file to enable preview',
        clearBtn:       'Clear',
        reviewNote:     'Review and adjust categories, properties, and notes. Enable bulk-update to apply changes to all selected rows at once.',
        bulkUpdate:     'Update all selected with same value',
        selectSameDesc: 'Select all with same description',
        groupToggle:    'Group by status',
        floatToggle:    'Float selected',
        sections: {
          unreviewed:  'Unreviewed',
          autoMatched: 'Auto-matched',
          reviewed:    'Reviewed',
          duplicate:   'Duplicate',
          ignored:     'Ignored',
          selected:    'Selected',
          locked:      'Finished',
        },
        lockBtn:   'Mark finished',
        unlockBtn: 'Unlock',
        nextReview:     'Next: Review →',
        mapping: {
          title:           'Column mapping',
          savedLabel:      'Saved mapping',
          noSaved:         '— no saved mappings —',
          colHeader:       'Column header',
          colSample:       'Sample value',
          colRole:         'Maps to',
          skipRows:        'Skip rows',
          dateFormat:      'Date format',
          decimal:         'Decimal separator',
          namePlaceholder: 'Mapping name…',
          saveBtn:         'Save mapping',
          deleteBtn:       'Delete',
          roles: {
            date:        'Date',
            description: 'Description',
            amount:      'Amount',
            ignore:      'Ignore',
          },
          toast: {
            saved:   "Mapping '{name}' saved.",
            deleted: "Mapping '{name}' deleted.",
            noName:  'Enter a mapping name first.',
          },
        },
        col: {
          date:         'Date',
          description:  'Description',
          property:     'Property',
          category:     'Category',
          notes:        'Notes',
          amount:       'Amount',
          ignore:       'Ignore',
          storeMapping: 'Store mapping',
        },
        staticPreview: {
          title:     'Review — ready to import',
          back:      '← Back',
          importBtn: 'Import',
          nextBtn:   'Next: Save mappings →',
        },
        mappingConfirm: {
          title:       'Save description mappings',
          newLabel:    'New mappings ({count})',
          updateLabel: 'Updated mappings ({count})',
          noChanges:   'All selected mappings already exist with the same category — nothing will change.',
          colDesc:     'Description',
          colCat:      'Category',
          colWas:      'Was',
          colNow:      'Now',
          confirmBtn:  'Confirm & Import',
          skipBtn:     'Import without saving',
          back:        '← Back',
        },
        toast: {
          noData:        'Upload a file or paste CSV data first.',
          noActiveRows:  'No rows to import — all rows are ignored.',
          parseError:    'Parse error: {error}',
          failed:        'Import failed: {error}',
          done:          'Imported {count} transactions (batch {batchId}).',
          notesRequired: '{count} row(s) have "other expense" category but no notes — please fill them in (highlighted in red).',
        },
        confirmMissing: '{count} rows have no property assigned. Import anyway?',
        history: {
          title:      'Recent imports',
          colDate:       'Date',
          colSource:     'Profile',
          colRows:       'Rows',
          colProperties: 'Properties',
          colAction:     '',
          undoBtn:    'Undo',
          empty:      'No recent imports.',
          undone:     'Import rolled back — {count} transaction(s) deleted.',
          undoFailed: 'Rollback failed: {error}',
          modal: {
            title:      'Undo import',
            subtitle:   'The following {count} transaction(s) will be permanently deleted:',
            confirmBtn: 'Delete {count} transaction(s)',
            loading:    'Loading transactions…',
          },
        },
      },
      reports: {
        ytd:           'YTD',
        lastYear:      'Last year',
        allTime:       'All time',
        incomeByCat:   'Income by category',
        expensesByCat: 'Expenses by category',
        pnlByProperty: 'P&L by property',
        noIncome:      'No income',
        noExpenses:    'No expenses',
        col: {
          category: 'Category',
          amount:   'Amount',
          count:    'Count',
          property: 'Property',
          income:   'Income',
          expenses: 'Expenses',
          net:      'Net',
        },
        metrics: {
          totalIncome:   'Total income',
          totalExpenses: 'Total expenses',
          net:           'Net',
          transactions:  'Transactions',
          dkkEquiv:      'DKK equivalent',
          inPeriod:      'in period',
        },
      },
      property: {
        title:           'Properties',
        addBtn:          '+ Add property',
        noProperties:    'No properties yet',
        noPropertiesSub: 'Add your first property.',
        model: {
          longterm: 'Long-term',
          airbnb:   'Short-term',
        },
        modal: {
          addTitle:         'Add property',
          editTitle:        'Edit property',
          name:             'Name / unit *',
          namePlaceholder:  'e.g. VB77 1tv',
          country:          'Country',
          address:          'Address',
          addrPlaceholder:  'Street, city, postcode',
          currency:         'Currency',
          currPlaceholder:  'DKK',
          model:            'Rental model',
          longTerm:         'Long-term (fixed rent)',
          shortTerm:        'Short-term / Airbnb',
          monthlyRent:      'Monthly rent',
          aconto:           'A/C heating & water',
          tenantName:       'Tenant name',
          tenantPlaceholder:'Full name',
          leaseStart:       'Lease start',
          notes:            'Notes',
          notesPlaceholder: 'Optional notes…',
          saveBtn:          'Save',
        },
        metric: {
          rent:         'Rent',
          aconto:       'A/C (heat+water)',
          totalMonthly: 'Total monthly',
          tenant:       'Tenant',
        },
        showArchived:    'Show archived',
        archivedBadge:   'Archived',
        toast: {
          saved:          'Property saved.',
          saveFailed:     'Save failed: {error}',
          nameReq:        'Name is required.',
          archiveConfirm: 'Archive this property? It will be hidden but its transaction history is preserved.',
          archived:       'Property archived.',
        },
      },
      rules: {
        title:       'Auto-categorisation rules',
        addBtn:      '+ Add rule',
        description: 'When importing, if a transaction description contains a keyword, it is automatically assigned the category and property below. Rules are tested in order — first match wins.',
        noRules:     'No rules yet',
        noRulesSub:  'Add rules to auto-categorise imported transactions.',
        saveOrder:   'Save rules order',
        defaultTitle:'Default rules',
        defaultDesc: 'Click to load a set of sensible starting rules for your portfolio.',
        loadDefault: 'Load default rules',
        col: {
          bankProfile: 'Bank profile',
          keyword:     'Keyword',
          category:    'Category',
          property:    'Property',
        },
        modal: {
          title:         'Add categorisation rule',
          bankProfile:   'Bank profile (optional)',
          anyBank:       'Any bank',
          keyword:       'Keyword *',
          kwPlaceholder: 'e.g. sabumba',
          category:      'Category *',
          property:      'Property (optional)',
          anyProperty:   'Any / not set',
          addBtn:        'Add rule',
        },
        toast: {
          saved:         'Rules saved.',
          saveFailed:    'Save failed: {error}',
          kwCatReq:      'Keyword and category are required.',
          defaultLoaded: 'Default rules loaded. Click "Save rules order" to persist.',
        },
      },
      settings: {
        title:             'Workspace Settings',
        reportingCurrency: 'Reporting Currency',
        currencyDesc:      'ISO 4217 currency code (e.g., USD, DKK, EUR) used for multi-currency reporting.',
        maxAccountDepth:   'Max Account Hierarchy Depth',
        maxDepthDesc:      'Maximum allowed depth for the account hierarchy (default: 5).',
        dateFormat:        'Date Display Format',
        dateFormatDesc:    'How dates are shown throughout the app.',
        loadFailed:        'Failed to load settings: {error}',
        saveFailed:        'Save failed: {error}',
        validationError:   'Please check your inputs.',
        savedSuccess:      'Settings saved successfully.',
      },
      country: {
        DK:    'Denmark',
        PL:    'Poland',
        OTHER: 'Other',
      },
      categories: {
        income:   'Income',
        expense:  'Expense',
        deposit:  'Deposit',
        transfer: 'Transfer',
        items: {
          rent:               'Rent',
          heating_aconto:     'Heating & water (a/c)',
          heating_settlement: 'Heating settlement',
          maintenance_repair: 'Maintenance & repair',
          property_tax:       'Property tax',
          insurance:          'Insurance',
          utilities:          'Utilities',
          management_fee:     'Management fee',
          advertising:        'Advertising',
          professional_fees:  'Professional fees',
          bank_charges:       'Bank charges',
          other_expense:      'Other expense',
          deposit_received:   'Deposit received',
          deposit_returned:   'Deposit returned',
          inter_account:      'Inter-account transfer',
        },
      },
    },
  };

  // ── Runtime state ─────────────────────────────────────────

  let _lang           = 'en';
  let _userId         = null;
  let _runtimeStrings = [];   // loaded from Strings sheet

  // ── Resolution ────────────────────────────────────────────

  function _resolve(key) {
    if (_userId) {
      const u = _runtimeStrings.find(s => s.key === key && s.lang === _lang && s.user_id === _userId);
      if (u) return u.value;
    }
    const g = _runtimeStrings.find(s => s.key === key && s.lang === _lang && !s.user_id);
    if (g) return g.value;

    const h = key.split('.').reduce((o, k) => o?.[k], STRINGS[_lang]);
    if (h !== undefined && h !== null && typeof h === 'string') return h;

    if (_lang !== 'en') {
      const e = key.split('.').reduce((o, k) => o?.[k], STRINGS['en']);
      if (e !== undefined && e !== null && typeof e === 'string') return e;
    }

    return key;
  }

  // ── Public: translate ─────────────────────────────────────

  function translate(key, vars = {}) {
    const str = _resolve(key);
    return str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
  }

  // ── Public: load sheet overrides ──────────────────────────

  function initStrings(rows, userId = null) {
    _runtimeStrings = rows || [];
    _userId = userId;
    applyI18n();
  }

  // ── Public: switch language ───────────────────────────────

  function setLang(lang) {
    _lang = lang;
    applyI18n();
  }

  // ── DOM pass ──────────────────────────────────────────────

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = translate(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = translate(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = translate(el.dataset.i18nTitle);
    });
    document.title = translate('app.title');
  }

  document.addEventListener('DOMContentLoaded', applyI18n);

  return { translate, initStrings, setLang, applyI18n };

})();

// Global shorthand — safe to call before initStrings(); falls back to hardcoded defaults
export function t(key, vars) { return I18n.translate(key, vars); }
