import { faker } from "@faker-js/faker";
import pool from "./modules/db/pool";

// Configuration for data generation
const CONFIG = {
  customers: 50, // More realistic number of customers
  invoicesPerCustomer: {
    // Variable invoice counts by customer size
    small: { min: 5, max: 20 },
    medium: { min: 20, max: 100 },
    large: { min: 100, max: 500 },
  },
  dateRange: {
    // More realistic date range
    from: "2022-01-01",
    to: "2025-05-06",
  },
  batchSizes: {
    invoices: 100,
    items: 500,
  },
  itemsPerInvoice: {
    // More variable item counts
    min: 1,
    max: 15,
  },
  paymentMethods: [
    // More payment method options
    "Bank Transfer",
    "Credit Card",
    "PayPal",
    "Check",
    "Cash",
    "Crypto",
  ],
  paymentTerms: [
    // Realistic payment terms
    "Net 15",
    "Net 30",
    "Net 45",
    "Net 60",
    "Due on Receipt",
    "50% Upfront",
  ],
  productCategories: [
    // Product categories for more realistic items
    "Electronics",
    "Office Supplies",
    "Furniture",
    "Software",
    "Consulting",
    "Hardware",
    "Services",
    "Training",
  ],
  taxRates: [
    // Different tax rates
    0.0, // Tax exempt
    0.05, // 5%
    0.07, // 7%
    0.1, // 10%
    0.18, // 18%
    0.21, // 21%
  ],
};

// Customer size distribution
const CUSTOMER_SIZE_DISTRIBUTION = {
  small: 0.7, // 70% small customers
  medium: 0.25, // 25% medium customers
  large: 0.05, // 5% large customers
};

// Seasonal patterns for invoice dates
const SEASONAL_PATTERNS = {
  // Month index (0-11) to multiplier
  0: 0.8, // January - slower
  1: 0.9, // February
  2: 1.0, // March - normal
  3: 1.1, // April
  4: 1.2, // May
  5: 1.3, // June - busier
  6: 1.0, // July
  7: 0.9, // August - vacation period
  8: 1.1, // September - back to business
  9: 1.2, // October
  10: 1.4, // November - end of year rush
  11: 1.5, // December - highest volume
};

// Product catalog for consistent pricing
const PRODUCT_CATALOG: Record<
  string,
  { name: string; priceRange: { min: number; max: number } }[]
> = {};

interface Customer {
  id: number;
  name: string;
  size: "small" | "medium" | "large";
}

interface InvoiceItem {
  invoiceId: number;
  description: string;
  quantity: number;
  unitPrice: number;
  category?: string;
}

interface Invoice {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  customerId: number;
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  paymentTerms: string;
  paymentMethod: string;
  bankDetails: string; // JSON string for PostgreSQL
  notes: string;
}

// Initialize product catalog
function initializeProductCatalog() {
  CONFIG.productCategories.forEach((category) => {
    const productCount = faker.number.int({ min: 10, max: 30 });
    PRODUCT_CATALOG[category] = [];

    for (let i = 0; i < productCount; i++) {
      PRODUCT_CATALOG[category].push({
        name: faker.commerce.productName(),
        priceRange: {
          min: faker.number.int({ min: 10, max: 100 }),
          max: faker.number.int({ min: 100, max: 2000 }),
        },
      });
    }
  });
}

async function seed() {
  const client = await pool.connect();

  try {
    console.log("Starting seeding...");
    console.time("Seeding completed in");

    // Initialize product catalog for consistent pricing
    initializeProductCatalog();

    // Begin transaction
    await client.query("BEGIN");

    // 1. Clear existing data
    await client.query("DELETE FROM invoice_items");
    await client.query("DELETE FROM invoices");
    await client.query("DELETE FROM customers");

    // Reset sequences
    await client.query("ALTER SEQUENCE customers_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE invoices_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE invoice_items_id_seq RESTART WITH 1");

    // 2. Generate customers with size classification
    const customers = await createCustomers(client, CONFIG.customers);

    // 3. For each customer, generate invoices in batches
    let totalInvoices = 0;
    let totalItems = 0;

    for (const [idx, customer] of customers.entries()) {
      console.log(
        `\nSeeding invoices for customer ${customer.id} (${idx + 1}/${customers.length}): ${customer.name} (${customer.size})...`,
      );

      const { invoiceCount, itemCount } = await createInvoicesForCustomer(
        client,
        customer,
      );
      totalInvoices += invoiceCount;
      totalItems += itemCount;
    }

    // Commit transaction
    await client.query("COMMIT");
    console.timeEnd("Seeding completed in");
    console.log(
      `Generated ${customers.length} customers, ${totalInvoices} invoices, and ${totalItems} invoice items.`,
    );
  } catch (err) {
    // Rollback on error
    await client.query("ROLLBACK");
    console.error("Error during seeding:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

async function createCustomers(
  client: any,
  count: number,
): Promise<Customer[]> {
  const customers: Customer[] = [];

  for (let i = 0; i < count; i++) {
    // Determine customer size based on distribution
    const rand = Math.random();
    let size: "small" | "medium" | "large";

    if (rand < CUSTOMER_SIZE_DISTRIBUTION.small) {
      size = "small";
    } else if (
      rand <
      CUSTOMER_SIZE_DISTRIBUTION.small + CUSTOMER_SIZE_DISTRIBUTION.medium
    ) {
      size = "medium";
    } else {
      size = "large";
    }

    // Generate more realistic company name
    const companyName =
      size === "large"
        ? faker.company.name() + " " + faker.company.buzzNoun()
        : faker.company.name();

    // More structured address
    const address = `${faker.location.streetAddress({ useFullAddress: true })}, ${faker.location.city()}, ${faker.location.state({ abbreviated: true })} ${faker.location.zipCode()}, ${faker.location.country()}`;

    // More realistic phone format
    const phone = faker.phone.number({ style: "international" });

    // Company domain email
    const domain = companyName.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
    const email = `accounting@${domain}`;

    // Tax ID format varies by size
    const taxId =
      size === "large"
        ? `EIN-${faker.string.numeric(2)}-${faker.string.numeric(7)}`
        : `TIN-${faker.string.numeric(9)}`;

    const res = await client.query(
      `INSERT INTO customers (name, address, phone, email, tax_id) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [companyName, address, phone, email, taxId],
    );

    const customerId = res.rows[0].id;
    customers.push({ id: customerId, name: companyName, size });
    console.log(
      `Created customer ${i + 1}/${count}: ${companyName} (ID ${customerId}, ${size})`,
    );
  }

  return customers;
}

async function createInvoicesForCustomer(client: any, customer: Customer) {
  // Determine number of invoices based on customer size
  const sizeConfig = CONFIG.invoicesPerCustomer[customer.size];
  const totalInvoices = faker.number.int({
    min: sizeConfig.min,
    max: sizeConfig.max,
  });

  let processedCount = 0;
  let totalItemCount = 0;

  // Process in batches
  while (processedCount < totalInvoices) {
    const batchSize = Math.min(
      CONFIG.batchSizes.invoices,
      totalInvoices - processedCount,
    );
    const invoiceBatch: Invoice[] = [];
    const allItems: InvoiceItem[] = [];

    // Generate batch of invoices
    for (let j = 0; j < batchSize; j++) {
      const invoiceNum = processedCount + j + 1;
      const { invoice, items } = generateInvoice(customer, invoiceNum);
      invoiceBatch.push(invoice);
      totalItemCount += items.length;
    }

    // Insert invoices in batch
    const invoiceIds = await insertInvoiceBatch(client, invoiceBatch);

    // Generate and collect all items for all invoices in this batch
    invoiceIds.forEach((invoiceId, idx) => {
      // Determine item count based on customer size and random variation
      const baseItemCount =
        customer.size === "large" ? 5 : customer.size === "medium" ? 3 : 2;
      const itemCount = faker.number.int({
        min: CONFIG.itemsPerInvoice.min,
        max: Math.min(CONFIG.itemsPerInvoice.max, baseItemCount * 3),
      });

      for (let k = 0; k < itemCount; k++) {
        allItems.push(generateInvoiceItem(invoiceId));
      }
    });

    // Insert items in sub-batches for better performance
    await insertInvoiceItemsBatched(client, allItems);

    processedCount += batchSize;
    console.log(
      `  Inserted ${processedCount}/${totalInvoices} invoices for customer ${customer.id}`,
    );
  }

  return { invoiceCount: totalInvoices, itemCount: totalItemCount };
}

function generateInvoice(
  customer: Customer,
  invoiceNum: number,
): { invoice: Invoice; items: InvoiceItem[] } {
  // Generate more realistic invoice date with seasonal patterns
  const startDate = new Date(CONFIG.dateRange.from);
  const endDate = new Date(CONFIG.dateRange.to);

  // Apply seasonal weighting to make certain months more likely
  let invoiceDate: Date;
  do {
    invoiceDate = faker.date.between({ from: startDate, to: endDate });
    const month = invoiceDate.getMonth();
    const seasonalFactor =
      SEASONAL_PATTERNS[month as keyof typeof SEASONAL_PATTERNS];

    // Higher seasonal factor = more likely to accept this date
  } while (
    Math.random() >
    SEASONAL_PATTERNS[invoiceDate.getMonth() as keyof typeof SEASONAL_PATTERNS]
  );

  // Due date based on payment terms
  const paymentTerms = faker.helpers.arrayElement(CONFIG.paymentTerms);
  let dueDays = 30; // default

  if (paymentTerms.includes("15")) dueDays = 15;
  else if (paymentTerms.includes("30")) dueDays = 30;
  else if (paymentTerms.includes("45")) dueDays = 45;
  else if (paymentTerms.includes("60")) dueDays = 60;
  else if (paymentTerms.includes("Receipt")) dueDays = 0;

  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + dueDays);

  // More realistic invoice number format with year and sequential numbering
  const year = invoiceDate.getFullYear();
  const invoiceNumber = `INV-${year}-${customer.id.toString().padStart(3, "0")}-${invoiceNum.toString().padStart(4, "0")}`;

  // Payment method varies by customer size
  let paymentMethodPool = CONFIG.paymentMethods;
  if (customer.size === "small") {
    // Small customers more likely to use simple payment methods
    paymentMethodPool = CONFIG.paymentMethods.slice(0, 3);
  }
  const paymentMethod = faker.helpers.arrayElement(paymentMethodPool);

  // More detailed bank details based on payment method
  let bankDetails: any = {};
  if (paymentMethod === "Bank Transfer") {
    bankDetails = {
      bank: faker.finance.accountName(),
      accountNumber: faker.finance.accountNumber(),
      routingNumber: faker.finance.routingNumber(),
      iban: faker.finance.iban(),
      swift: faker.finance.bic(),
    };
  } else if (paymentMethod === "Credit Card") {
    bankDetails = {
      processor: faker.helpers.arrayElement(["Stripe", "PayPal", "Square"]),
      lastFour: faker.finance.creditCardNumber("####"),
    };
  } else if (paymentMethod === "PayPal") {
    bankDetails = {
      email: `payments@${customer.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
    };
  }

  // More realistic notes based on customer size and invoice details
  let notes = "";
  if (Math.random() < 0.3) {
    if (customer.size === "large") {
      notes = faker.helpers.arrayElement([
        `PO #${faker.string.alphanumeric(8).toUpperCase()}. Please reference on all correspondence.`,
        `Contract #${faker.string.alphanumeric(6).toUpperCase()}. Net ${dueDays} payment terms as agreed.`,
        `Approved by ${faker.person.fullName()}, Department ${faker.commerce.department()}.`,
      ]);
    } else {
      notes = faker.helpers.arrayElement([
        `Thank you for your business!`,
        `Please remit payment by due date.`,
        `Questions? Contact ${faker.person.fullName()} at ${faker.phone.number()}.`,
      ]);
    }
  }

  // Generate line items with more realistic patterns
  const baseItemCount =
    customer.size === "large" ? 5 : customer.size === "medium" ? 3 : 2;
  const itemCount = faker.number.int({
    min: CONFIG.itemsPerInvoice.min,
    max: Math.min(CONFIG.itemsPerInvoice.max, baseItemCount * 3),
  });

  const items: InvoiceItem[] = [];
  const selectedCategories = faker.helpers.arrayElements(
    CONFIG.productCategories,
    faker.number.int({ min: 1, max: 3 }),
  );

  let subtotal = 0;
  for (let k = 0; k < itemCount; k++) {
    const category = faker.helpers.arrayElement(selectedCategories);
    const product = faker.helpers.arrayElement(PRODUCT_CATALOG[category]);

    const description = `${product.name} (${category})`;
    const quantity = faker.number.int({
      min: 1,
      max: customer.size === "large" ? 20 : 10,
    });
    const unitPrice = faker.number.float({
      min: product.priceRange.min,
      max: product.priceRange.max,
    });

    subtotal += quantity * unitPrice;
    items.push({
      invoiceId: 0, // Will be updated after invoice insertion
      description,
      quantity,
      unitPrice,
      category,
    });
  }

  // Calculate totals with more realistic patterns
  let discount = 0;
  // Larger customers more likely to get discounts
  if (
    Math.random() <
    (customer.size === "large" ? 0.7 : customer.size === "medium" ? 0.4 : 0.2)
  ) {
    discount = parseFloat(
      (subtotal * faker.number.float({ min: 0.05, max: 0.15 })).toFixed(2),
    );
  }

  // Select tax rate based on customer and randomness
  const taxRate = faker.helpers.arrayElement(CONFIG.taxRates);
  const tax = parseFloat(((subtotal - discount) * taxRate).toFixed(2));

  // Shipping based on order size
  let shipping = 0;
  if (subtotal < 100) {
    shipping = parseFloat(faker.finance.amount({ min: 5, max: 15, dec: 2 }));
  } else if (subtotal < 500) {
    shipping = parseFloat(faker.finance.amount({ min: 10, max: 30, dec: 2 }));
  } else if (subtotal < 1000) {
    shipping = parseFloat(faker.finance.amount({ min: 20, max: 50, dec: 2 }));
  } else {
    // Free shipping for large orders, sometimes
    shipping =
      Math.random() < 0.7
        ? 0
        : parseFloat(faker.finance.amount({ min: 30, max: 100, dec: 2 }));
  }

  const total = parseFloat((subtotal - discount + tax + shipping).toFixed(2));

  return {
    invoice: {
      invoiceNumber,
      invoiceDate,
      dueDate,
      customerId: customer.id,
      subtotal,
      discount,
      tax,
      shipping,
      total,
      paymentTerms,
      paymentMethod,
      bankDetails: JSON.stringify(bankDetails),
      notes,
    },
    items,
  };
}

function generateInvoiceItem(invoiceId: number): InvoiceItem {
  const category = faker.helpers.arrayElement(CONFIG.productCategories);
  const product = faker.helpers.arrayElement(PRODUCT_CATALOG[category]);

  return {
    invoiceId,
    description: `${product.name} (${category})`,
    quantity: faker.number.int({ min: 1, max: 10 }),
    unitPrice: faker.number.float({
      min: product.priceRange.min,
      max: product.priceRange.max,
    }),
    category,
  };
}

async function insertInvoiceBatch(
  client: any,
  invoices: Invoice[],
): Promise<number[]> {
  // Prepare values for bulk insert
  const values = invoices
    .map(
      (inv, i) => `(
    $${i * 13 + 1}, $${i * 13 + 2}, $${i * 13 + 3}, $${i * 13 + 4}, 
    $${i * 13 + 5}, $${i * 13 + 6}, $${i * 13 + 7}, $${i * 13 + 8}, 
    $${i * 13 + 9}, $${i * 13 + 10}, $${i * 13 + 11}, $${i * 13 + 12}, 
    $${i * 13 + 13}
  )`,
    )
    .join(", ");

  const params = invoices.flatMap((inv) => [
    inv.invoiceNumber,
    inv.invoiceDate,
    inv.dueDate,
    inv.customerId,
    inv.subtotal,
    inv.discount,
    inv.tax,
    inv.shipping,
    inv.total,
    inv.paymentTerms,
    inv.paymentMethod,
    inv.bankDetails,
    inv.notes,
  ]);

  const query = `
    INSERT INTO invoices (
      invoice_number, invoice_date, due_date, customer_id, 
      subtotal, discount, tax, shipping, total,
      payment_terms, payment_method, bank_details, notes
    ) 
    VALUES ${values}
    RETURNING id
  `;

  const res = await client.query(query, params);
  return res.rows.map((row: any) => row.id);
}

async function insertInvoiceItemsBatched(client: any, items: InvoiceItem[]) {
  // Process items in sub-batches
  for (let i = 0; i < items.length; i += CONFIG.batchSizes.items) {
    const batch = items.slice(i, i + CONFIG.batchSizes.items);

    // Prepare values for bulk insert
    const values = batch
      .map(
        (_, j) => `(
      $${j * 4 + 1}, $${j * 4 + 2}, $${j * 4 + 3}, $${j * 4 + 4}
    )`,
      )
      .join(", ");

    const params = batch.flatMap((item) => [
      item.invoiceId,
      item.description,
      item.quantity,
      item.unitPrice,
    ]);

    const query = `
      INSERT INTO invoice_items (
        invoice_id, description, quantity, unit_price
      ) 
      VALUES ${values}
    `;

    await client.query(query, params);
  }
}

seed().catch((err) => {
  console.error("Error during seeding:", err);
});
