import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import connectDB from '../src/config/db.js'
import { Product, Customer, Sale } from '../src/modules/business/index.js'

const TEST_TENANT_ID = 'test_schema_verification_tenant'

const verifySchemas = async () => {
  console.log('======================================================================')
  console.log(' OPSMIND MONGOOSE SCHEMA VALIDATION & COMPILATION TEST')
  console.log('======================================================================')

  try {
    await connectDB()
    console.log('• Connected to MongoDB. Registering and synchronizing indexes...')

    await Product.syncIndexes()
    await Customer.syncIndexes()
    await Sale.syncIndexes()
    console.log('• Indexes synchronized successfully for Product, Customer, and Sale.')

    // 1. Test Product Schema
    console.log('\n--- 1. Testing Product Schema ---')
    const sampleProduct = new Product({
      businessId: TEST_TENANT_ID,
      sku: 'TEST-SKU-001',
      name: 'VINTAGE CERAMIC TEAPOT',
      category: 'Home & Kitchen',
      sellingPrice: 14.50,
      costPrice: 8.20,
      currentStock: 45,
      reorderThreshold: 15,
      targetStock: 80,
    })
    const savedProduct = await sampleProduct.save()
    console.log(`✓ Product saved: ${savedProduct.name} [SKU: ${savedProduct.sku}] - Price: £${savedProduct.sellingPrice}`)

    // 2. Test Customer Schema
    console.log('\n--- 2. Testing Customer Schema ---')
    const sampleCustomer = new Customer({
      businessId: TEST_TENANT_ID,
      customerId: '99001',
      name: 'Boutique Store London',
      country: 'United Kingdom',
      firstPurchaseDate: new Date('2021-01-15'),
      lastPurchaseDate: new Date('2021-11-20'),
      totalOrders: 12,
      totalUnitsPurchased: 240,
      totalSpend: 1850.75,
      rfm: {
        recencyDays: 14,
        frequency: 12,
        monetary: 1850.75,
        retentionStatus: 'ACTIVE',
      },
    })
    const savedCustomer = await sampleCustomer.save()
    console.log(`✓ Customer saved: ${savedCustomer.name} [ID: ${savedCustomer.customerId}] - Status: ${savedCustomer.rfm.retentionStatus}`)

    // 3. Test Sale Schema (with embedded line items)
    console.log('\n--- 3. Testing Sale Schema ---')
    const sampleSale = new Sale({
      businessId: TEST_TENANT_ID,
      invoiceId: 'TEST-INV-1001',
      transactionDate: new Date(),
      customerReference: savedCustomer.customerId,
      billingCountry: 'United Kingdom',
      status: 'completed',
      isCancellation: false,
      totalAmount: 29.00,
      totalUnits: 2,
      items: [
        {
          productSku: savedProduct.sku,
          productName: savedProduct.name,
          quantity: 2,
          unitPrice: 14.50,
          lineTotal: 29.00,
        },
      ],
    })
    const savedSale = await sampleSale.save()
    console.log(`✓ Sale saved: Invoice #${savedSale.invoiceId} - Total: £${savedSale.totalAmount} (${savedSale.items.length} item)`)

    // 4. Test Tenant Isolation Query
    console.log('\n--- 4. Testing Tenant-Isolated Query ---')
    const foundSale = await Sale.findOne({
      businessId: TEST_TENANT_ID,
      invoiceId: 'TEST-INV-1001',
    })
    console.log(`✓ Query verified: Found sale #${foundSale.invoiceId} with ${foundSale.items[0].productName}`)

    // Cleanup test records
    console.log('\n--- 5. Cleanup Test Artifacts ---')
    await Product.deleteMany({ businessId: TEST_TENANT_ID })
    await Customer.deleteMany({ businessId: TEST_TENANT_ID })
    await Sale.deleteMany({ businessId: TEST_TENANT_ID })
    console.log('✓ Cleaned up test tenant documents.')

    console.log('\n======================================================================')
    console.log(' ALL SCHEMAS, CONSTRAINTS & INDEXES VERIFIED SUCCESSFULLY')
    console.log('======================================================================')
  } catch (error) {
    console.error('Schema verification failed:', error)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
    process.exit(0)
  }
}

verifySchemas()
