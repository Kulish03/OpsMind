# OpsMind Phase 9 – Advanced Features & Enterprise Operations Guide

This document provides a comprehensive technical and operational breakdown of the 10 advanced features implemented in **OpsMind Phase 9**, evolving the platform from a core MVP into an enterprise-grade AI Operations platform for SMEs.

---

## 1. Summary of Advanced Features

| # | Feature | Business Value | Architectural Tier | Primary Endpoints |
|---|---------|----------------|-------------------|-------------------|
| **1** | **CSV & Spreadsheet Data Imports** | Instant bulk onboarding of products, transactions, and expenses from legacy POS/ERP systems without manual data entry. | Backend Service (`import.service.js`) | `POST /api/import/:entityType` |
| **2** | **PDF Business Reports Generator** | One-click C-suite executive summaries with vector graphs, margin breakdowns, inventory risks, and financial audits. | Backend Service (`report.service.js`) via PDFKit | `GET /api/reports/executive-summary/pdf`<br>`GET /api/reports/executive-summary/preview` |
| **3** | **RAG for Documents & Policies** | Grounds AI Copilot in unstructured store policies, warranty rules, supplier agreements, and contracts via TF-IDF semantic chunking. | Backend & Copilot Tools (`document.service.js`) | `POST /api/documents`<br>`POST /api/documents/query`<br>Copilot Tool: `query_business_documents` |
| **4** | **Supplier Lead-Time SLA Analysis** | Computes SLA delivery variance, flags supplier delays, and assigns procurement reliability tiers (A/B/C/D). | Analytics Engine (`analytics.service.js`) | `GET /api/analytics/suppliers/lead-time`<br>Copilot Tool: `get_supplier_performance` |
| **5** | **Advanced Roles & Permissions (RBAC)** | Strict role enforcement (`admin`, `manager`, `accountant`, `staff`) with consequential action gates protecting purchase orders and financials. | Middleware (`rbacMiddleware.js`) | Middleware: `authorizeRoles(...)`<br>`requirePermission(...)` |
| **6** | **Scheduled Reports & Notifications** | Automated recurring weekly/monthly digests and operational anomaly summaries with on-demand trigger capability. | Reports Engine (`schedule.service.js`) | `GET /api/reports/schedules`<br>`POST /api/reports/schedules`<br>`POST /api/reports/schedules/:id/trigger` |
| **7** | **Advanced Demand Forecasting** | Scenario simulation incorporating promotional lifts, seasonal elasticity, and day-of-week multipliers on top of Random Forest regression. | FastAPI ML Service & Express Proxy | `POST /forecast/advanced`<br>`POST /api/ml/forecast/advanced` |
| **8** | **ML Model Monitoring & Governance** | Data drift monitoring (KS/KL divergence), rolling WAPE/ROC-AUC drift tracking, and automated retraining triggers. | Python ML Service (`model_monitor.py`) | `GET /monitoring/health`<br>`GET /api/ml/monitoring` |
| **9** | **Accounting & POS Integrations** | Real-time webhook ingestion for POS cash register transactions (auto-deducting inventory) and accounting expense bills. | Webhook Engine (`webhook.controller.js`) | `POST /api/integrations/pos/webhook`<br>`POST /api/integrations/accounting/webhook`<br>`GET /api/integrations/status` |
| **10** | **Recommendation Impact Tracking & ROI** | Measures post-action realized savings and sales protection, computing true ROI against initial ML estimates. | Recommendations Engine (`recommendation.service.js`) | `POST /api/recommendations/:id/track-impact`<br>`GET /api/recommendations/roi/summary` |

---

## 2. Feature Deep-Dives

### Feature 1: CSV and Spreadsheet Bulk Ingestion
- **Business Value:** Removes manual data entry friction for SMEs migrating hundreds of SKUs, expense receipts, or customer records from Excel, QuickBooks, or Square.
- **Architectural Components:** `backend/src/modules/business/import.service.js`, `import.controller.js`, `import.routes.js`.
- **Key Capabilities:**
  - Robust zero-dependency CSV parser handling quoted strings, internal commas, and CRLF line breaks.
  - Supports bulk ingestion for `products`, `sales`, `customers`, and `expenses`.
  - Batch validations report skipped row counts and validation errors without aborting valid rows.
  - Multi-tenant isolation: Automatically injects `req.businessId` into every persisted record.

### Feature 2: PDF Business Reports Engine
- **Business Value:** Delivers publication-ready monthly operational reviews for store managers, accountants, and bank loan officers.
- **Architectural Components:** `backend/src/modules/reports/report.service.js`, `pdfkit`.
- **Key Capabilities:**
  - High-performance vector PDF streaming directly to the HTTP response pipe.
  - Synthesizes Authoritative Financials (Gross/Net Revenue, COGS, Net Margin), High-Risk Stockout SKUs, and Realized Recommendations.
  - Supports both binary streaming download (`/pdf`) and structured JSON preview (`/preview`) for in-browser rendering.

### Feature 3: RAG for Business Documents & Policies
- **Business Value:** Enables SME owners to query complex warranty rules, customer return policies, and vendor SLA agreements in plain English.
- **Architectural Components:** `backend/src/modules/documents/businessDocument.model.js`, `document.service.js`, `copilot.tools.js`.
- **Key Capabilities:**
  - Semantic sliding-window chunking (250 tokens) with keyword tokenization and stopword filtering.
  - Scored TF-IDF chunk retrieval ranking excerpts by relevance to user query tokens.
  - Integrated with AI Copilot as approved tool `query_business_documents`, citing exact clause text and policy titles.

### Feature 4: Supplier Lead-Time Analysis
- **Business Value:** Prevents unexpected inventory stockouts by identifying unreliable suppliers whose deliveries consistently exceed contracted SLAs.
- **Architectural Components:** `backend/src/modules/analytics/analytics.service.js`, `analytics.controller.js`.
- **Key Capabilities:**
  - Computes average contracted lead time vs. observed transit variance across purchase orders.
  - Grades suppliers into Reliability Tiers (`A: 95%+ on-time`, `B: 85-94%`, `C: 75-84%`, `D: <75%`).
  - Integrated into AI Copilot tool `get_supplier_performance` for natural-language vendor audits.

### Feature 5: Advanced Business Roles & Permissions (RBAC)
- **Business Value:** Safeguards company capital and operational integrity by preventing junior staff from executing purchase orders or viewing sensitive profit margins.
- **Architectural Components:** `backend/src/middleware/rbacMiddleware.js`, `backend/src/modules/auth/user.model.js`.
- **Key Capabilities:**
  - Four granular roles:
    - `admin`: Full configuration, user management, and executive override.
    - `manager`: Full operational and recommendation execution authority.
    - `accountant`: Financial analytics, reports, and ledger access (read-only operations).
    - `staff`: Frontline point-of-sale and inventory count logging.
  - Protects consequential actions (`POST /api/recommendations/:id/execute`) with `authorizeRoles('admin', 'manager')`.

### Feature 6: Scheduled Reports and Notifications
- **Business Value:** Automates routine operational reporting, emailing management periodic digests so issues are caught before becoming crises.
- **Architectural Components:** `backend/src/modules/reports/reportSchedule.model.js`, `schedule.service.js`, `report.controller.js`.
- **Key Capabilities:**
  - Configurable cadence: `DAILY`, `WEEKLY`, `MONTHLY`.
  - Report types: `EXECUTIVE_SUMMARY`, `INVENTORY_RISK`, `FINANCIAL_DIGEST`.
  - Execution history auditing with manual trigger endpoint (`POST /schedules/:id/trigger`) for testing.

### Feature 7: Advanced Demand Forecasting
- **Business Value:** Enables SME retailers to simulate revenue and inventory needs for Black Friday promotions, seasonal spikes, or price changes.
- **Architectural Components:** `ml_service/src/services/forecasting.py`, `ml_service/src/api/v1/ml/router.py`, `backend/src/modules/ml/ml.service.js`.
- **Key Capabilities:**
  - Recursive multi-step daily Random Forest predictions.
  - Scenario simulation parameters: `promotional_lift_pct` and `price_elasticity`.
  - Compares baseline forecast vs. scenario-adjusted forecast with confidence intervals.

### Feature 8: ML Model Monitoring and Governance
- **Business Value:** Guarantees machine learning accuracy over time, detecting when changing sales trends make models stale.
- **Architectural Components:** `ml_service/src/services/monitoring/model_monitor.py`, `backend/src/modules/ml/ml.service.js`.
- **Key Capabilities:**
  - Tracks rolling WAPE (demand forecast), ROC-AUC (churn predictor), and contamination rate (anomaly detector).
  - Kolmogorov-Smirnov / KL-divergence feature drift scoring against baseline distributions.
  - Automatically raises `automated_retrain_recommended: true` when drift crosses predefined tolerances.

### Feature 9: Accounting and POS Integrations
- **Business Value:** Unifies the SME's operational source of truth by synchronizing real-time sales and expenses from external hardware and software.
- **Architectural Components:** `backend/src/modules/integrations/webhook.controller.js`, `webhook.routes.js`.
- **Key Capabilities:**
  - POS Webhook (`POST /pos/webhook`): Ingests register tickets, creates `Sale` transactions, automatically decrements `Product` current stock, and creates an `InventoryMovement` audit record.
  - Accounting Webhook (`POST /accounting/webhook`): Ingests vendor invoices and bills into `Expense` ledger.
  - Integration Status (`GET /status`): Live health and transaction sync counters.

### Feature 10: Recommendation Impact Tracking & ROI
- **Business Value:** Proves the return on investment of OpsMind's AI recommendations by quantifying actual dollars saved or protected after user execution.
- **Architectural Components:** `backend/src/modules/recommendations/recommendation.model.js`, `recommendation.service.js`, `recommendation.controller.js`.
- **Key Capabilities:**
  - Automatic impact tracking initialization upon recommendation execution (`APPLIED`).
  - Outcome verification (`POST /:id/track-impact`) records `realizedAmount`, `outcomeStatus` (`REALIZED` / `PARTIAL` / `FAILED`), and audit notes.
  - ROI Summary (`GET /roi/summary`): Computes overall realization rate (`totalRealized / totalEstimated`) and aggregate financial value protected.

---

## 3. Verification & Testing Matrix

OpsMind features an end-to-end automated testing suite with **100% passing tests**:

- **Backend Integration & Unit Tests:** 104 passed / 104 total across 8 test suites (`npm test`):
  - `phase9.advanced.test.js`: 19 tests validating all 10 advanced features.
  - `phase8.security.test.js`: 15 tests validating rate limits, payload sizes, and tenant isolation.
  - `recommendations.test.js`: 17 tests validating human-in-the-loop workflows.
  - `copilot.test.js`: 10 tests validating AI grounding and prompt injection security.
  - `ml.test.js`: 5 tests validating prediction proxies.
  - `api.test.js`: 21 tests validating core REST CRUD and domain models.
  - `validation.test.js`: 8 unit tests validating Zod schemas.
  - `queryParser.test.js`: 9 unit tests validating pagination, sorting, and regex escaping.

- **Python ML Service Tests:** 10 passed / 10 total (`tests/test_ml_endpoints.py`):
  - Health check & model status.
  - 14-day recursive demand forecasting (WAPE 29.56%).
  - Expense and sales anomaly detection (IQR & Isolation Forest).
  - Inventory stockout risk prediction with lead-time replenishment.
  - Customer inactivity and churn scoring (ROC-AUC 0.734).
  - Model registry & governance overview.
  - Advanced scenario-adjusted demand forecasting with promotional lift.
  - Model drift monitoring and retraining signals.

- **Frontend Production Build:** Vite v6 production bundling (`npm run build`) compiles cleanly in under 10 seconds.
