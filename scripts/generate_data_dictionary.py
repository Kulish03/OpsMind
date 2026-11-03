import os
import pandas as pd

RAW_DATA_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "raw", "online_retail_raw.csv"
)

def analyze_columns():
    df = pd.read_csv(RAW_DATA_PATH, encoding="ISO-8859-1")
    
    print("=" * 80)
    print(" OPSMIND DATA ENGINEERING — DATA DICTIONARY & ATTRIBUTE PROFILING")
    print("=" * 80)
    
    # Analyze each column
    columns_info = [
        {
            "name": "InvoiceNo",
            "business_meaning": "Unique 6-digit transaction identifier. Invoices prefixed with 'C' indicate cancellations/refunds; prefixed with 'A' indicate accounting adjustments.",
            "raw_dtype": "string/object",
            "target_schema": "Sale.invoiceId (String)",
            "example": "536365, C536379, A563185",
            "cardinality": df['InvoiceNo'].nunique(),
            "notes": "9,288 cancelled line items. Standard sales are 6 digits numeric."
        },
        {
            "name": "StockCode",
            "business_meaning": "Product SKU/code. Usually 5-6 alphanumeric characters. Also includes non-product fees (POST, D, M, BANK CHARGES).",
            "raw_dtype": "string/object",
            "target_schema": "Product.sku (String), Sale.items[].productSku",
            "example": "85123A, 71053, POST, AMAZONFEE",
            "cardinality": df['StockCode'].nunique(),
            "notes": "4,070 unique codes. Non-product codes represent operational fees or manual discounts."
        },
        {
            "name": "Description",
            "business_meaning": "Product or transaction title in English. Serves as the primary human-readable item descriptor.",
            "raw_dtype": "string/object",
            "target_schema": "Product.name (String)",
            "example": "WHITE HANGING HEART T-LIGHT HOLDER",
            "cardinality": df['Description'].nunique(),
            "notes": "1,454 missing values. Some descriptions contain administrative logs (e.g. 'damaged', 'check', '?')."
        },
        {
            "name": "Quantity",
            "business_meaning": "Units of product sold per invoice line item. Positive indicates sales; negative indicates cancellations, returns, or inventory damages.",
            "raw_dtype": "int64",
            "target_schema": "Sale.items[].quantity (Number), InventoryMovement.quantity",
            "example": "6, 12, -80995",
            "cardinality": df['Quantity'].nunique(),
            "notes": "10,624 negative quantities. Correlates with 'C' invoices and stock write-offs."
        },
        {
            "name": "InvoiceDate",
            "business_meaning": "Timestamp indicating the exact minute the transaction occurred.",
            "raw_dtype": "string (format: 'M/D/YYYY H:M')",
            "target_schema": "Sale.transactionDate (ISODate), InventoryMovement.timestamp",
            "example": "12/1/2010 8:26 -> 2010-12-01T08:26:00.000Z",
            "cardinality": df['InvoiceDate'].nunique(),
            "notes": "Spans 2010-12-01 to 2011-12-09. Must be parsed to UTC ISO-8601 for time-series forecasting."
        },
        {
            "name": "UnitPrice",
            "business_meaning": "Selling price per unit of product in British Pounds (GBP). Does not represent cost price.",
            "raw_dtype": "float64",
            "target_schema": "Product.sellingPrice (Number), Sale.items[].unitPrice",
            "example": "2.55, 3.39, 0.0, -11062.06",
            "cardinality": df['UnitPrice'].nunique(),
            "notes": "2,517 rows with price <= 0. Free items, sample giveaways, or debt write-offs."
        },
        {
            "name": "CustomerID",
            "business_meaning": "Unique 5-digit identifier assigned to registered wholesale or retail clients.",
            "raw_dtype": "float64 (stored with .0 suffix due to NaNs)",
            "target_schema": "Customer.customerId (String), Sale.customerReference",
            "example": "17850.0 -> '17850'",
            "cardinality": df['CustomerID'].nunique(),
            "notes": "135,080 rows (24.9%) are NaN (guest checkouts). Valid for sales volume, omitted from RFM churn."
        },
        {
            "name": "Country",
            "business_meaning": "Country where the customer resides or where the shipment was billed.",
            "raw_dtype": "string/object",
            "target_schema": "Sale.billingCountry (String), Customer.country",
            "example": "United Kingdom (91.4%), Germany, France",
            "cardinality": df['Country'].nunique(),
            "notes": "38 distinct countries. Primary domestic market is UK, rest are export."
        }
    ]

    for item in columns_info:
        print(f"\n[{item['name'].upper()}]")
        print(f"  • Business Meaning: {item['business_meaning']}")
        print(f"  • Raw Type:         {item['raw_dtype']}")
        print(f"  • Target Schema:    {item['target_schema']}")
        print(f"  • Sample Values:    {item['example']}")
        print(f"  • Distinct Count:   {item['cardinality']:,}")
        print(f"  • Engineering Note: {item['notes']}")
        
    print("\n" + "=" * 80)
    print(" STRUCTURAL DATA GAPS IDENTIFIED (REQUIRING PHASE 1 ENGINEERING):")
    print("=" * 80)
    print("1. NO COST PRICE (COGS): Only UnitPrice (selling price) is recorded. We cannot calculate gross margin without estimating or engineering product cost prices.")
    print("2. NO INVENTORY ON HAND: The dataset records outflows (sales) but no inflows (purchases) or initial stock levels. An append-only ledger must be synthesized.")
    print("3. NO SUPPLIERS: No supplier names or lead times exist. Synthetic suppliers must be linked to product SKUs.")
    print("4. NO OPERATING EXPENSES: No records for rent, utilities, wages, or logistics. Synthetic expenses must be engineered for profit analytics.")
    print("=" * 80)

if __name__ == "__main__":
    analyze_columns()
