# Landlord Guru - Design Discussion

## Project Overview

Landlord Guru is a web-based management application for small landlords to track income and expenses, produce yearly statements, and manage reporting. The application is currently transitioning from a local prototype (with Google Sheets backend) to a development server with a PostgreSQL database.

## High-Level Architecture

### Core Concept

The application is designed as a multi-user, multi-workspace SaaS system where:
- Users log in and gain access to workspaces (data spaces)
- Multiple users can have access to the same workspace
- Individual users must be given explicit access to individual workspaces
- Each workspace is a separate data silo

### Main Functional Areas

1. **Administration & Workspace Management**
   - Workspace creation
   - User access management
   - User role and permission management (planned for later)

2. **Properties & Accounts**
   - Properties: Basic data storage about properties under management
   - Accounts: A flexible accounting container that bridges transactions and properties
   - Accounts can represent individual properties, buildings, or any logical grouping
   - Different workspaces can organize accounts differently based on user needs

3. **Transaction Management**
   - Income transactions (e.g., tenant rent payments)
   - Expense transactions (e.g., management fees, repairs)
   - Transactions can be associated with accounts or the business as a whole
   - **Key Feature**: Seamless bulk import capability via CSV to avoid manual entry
   - Transaction schema designed to be flexible for future tenant linking

4. **Reporting & Analytics**
   - Income statements
   - Tax reports
   - Data export (Excel, Google Sheets, etc.)
   - Pivot table-based approach for flexible data slicing

## Key Design Decisions

### Accounts Model

**Definition**: An account is a flexible unit of accounting that serves as a container for transactions. It bridges properties and transactions. The account structure is workspace-level — all users in a workspace share the same account hierarchy.

**Hierarchy**: Accounts form a parent-child tree. The workspace default account is always the root; it cannot be a child of any other account. Additional accounts can be standalone top-level accounts or children of existing accounts. The hierarchy is freeform — the system enforces no semantic meaning on levels. Different workspaces can use accounts to represent companies, buildings, units, tenants, or any other grouping that suits them.

**Roll-up and filtering**: A parent account aggregates the figures of all its descendants. Filtering a report by an account implicitly includes all descendant accounts. These two properties are the primary value of the hierarchy.

**Maximum depth**: Each workspace carries a `max_account_depth` setting (default: 5, no system ceiling). Workspaces with unusual structures can raise this setting.

**Simplicity for simple users**: The default account is the catch-all. Users who never configure accounts never encounter the hierarchy — every transaction and property resolves to the default account automatically.

**Extensibility**: The accounts model is designed to eventually support tenant and lease management and account structure versioning (building a new hierarchy alongside the old, then activating it while archiving the old) without destroying historical data. Both are explicitly post-MVP.

### Optional Complexity

The system must support both simple and complex use cases:
- **Simple case**: One property, one tenant, minimal complexity—user doesn't interact with advanced features
- **Complex case**: Multiple properties, multiple tenants, detailed tracking—user enables optional complexity features
- **Implementation approach**: Features like tenant tracking are optional per workspace, not mandatory system-wide

### Transaction Schema

**Current design principle**: Transactions are flexible enough to eventually support tenant references without forcing the implementation now.

**Future extensibility**: 
- Transactions can optionally link to tenants when that feature is enabled
- Untagged transactions (without tenant data) remain valid
- No requirement to retroactively tag historical transactions when tenant tracking is added

### Reporting Approach

**Pivot table model**: Reporting is built around pivot tables rather than hardcoded report types.

**Flexibility**:
- If a dimension (e.g., tenant) is not available in a workspace, it simply isn't an option to pivot on
- Sparse or optional data is handled gracefully
- Users can slice and dice data based on what's actually in their workspace
- Avoids complexity in the reporting engine by accepting optional dimensions

## Planned Epics

Based on this discussion, the backlog will be organized into five main epics:

1. **Workspace and User Management**
   - Workspace creation and initialization
   - User invitations and access control
   - Permission and role management

2. **Account and Property Management**
   - Property creation and management
   - Account creation and management
   - Account-property relationships
   - (Future) Tenant and lease management support

3. **Transaction Management**
   - Transaction creation and editing
   - Bulk import from CSV
   - Transaction validation
   - Field mapping and parser support

4. **Reporting and Analytics**
   - Pivot table implementation
   - Data export functionality
   - Report generation

5. **Integrations and Data Import**
   - CSV parsing and validation
   - Field mapping configuration
   - Bulk import workflows
   - Data transformation pipelines

### Multi-Currency

Workspaces can contain properties and transactions in multiple currencies. The system handles this as follows:

- **Source currency**: every transaction is stored in its native currency. Amounts are never silently converted on write.
- **Reporting currency**: each workspace has a single `reporting_currency` setting. In any view that aggregates or displays multiple amounts, a toggle offers display in native currency or in the reporting currency. When the reporting currency is selected, non-native amounts show both the raw value and a converted value; the converted value is used for all arithmetic and aggregation.
- **Dated bilateral rates**: exchange rates are stored as `(from_currency, to_currency, effective_date, rate)` scoped to the workspace. A rate is valid from its `effective_date` until the next rate for the same pair — users control validity by controlling how often they update rates. Rates are workspace-specific; different workspaces can use different rates for the same day.
- **Rate requirement**: any transaction in a non-reporting currency requires a valid rate on or before its transaction date. Transactions without a resolvable rate are rejected at import and blocked at manual entry.
- **Rate lookup rule**: the most recent rate where `effective_date ≤ transaction date` is used. There is no exact-date requirement.
- **Automated refresh**: workspaces can configure automated rate refresh from a public data source at a configurable frequency (source TBD — see F2-10).

## Next Steps

- Create structured backlog files in the repository
- Flesh out each epic with specific features and acceptance criteria
- Identify dependencies and blockers
- Begin work on MVP features while keeping extensibility in mind

## Design Principles

1. **Flexibility over prescription**: The system should accommodate different organizational approaches rather than forcing a single model
2. **Optional complexity**: Advanced features should be opt-in per workspace
3. **Extensibility**: Architecture should support future features (tenant management, lease tracking) without major refactors
4. **Graceful data handling**: The system handles sparse or optional data without requiring users to fill in every field
5. **User-centric import**: Bulk import is a core feature, not an afterthought

---

**Date**: April 2026  
**Project**: Landlord Guru  
**Status**: Design planning phase (MVP definition)