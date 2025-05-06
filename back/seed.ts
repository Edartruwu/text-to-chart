import { faker } from "@faker-js/faker";
import pool from "./modules/db/pool";

// Batch size for better performance
const INVOICE_BATCH_SIZE = 100;
const ITEMS_BATCH_SIZE = 500;

interface Customer {
  id: number;
  name: string;
}

interface InvoiceItem {
  invoiceId: number;
  description: string;
  quantity: number;
  unitPrice: number;
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

async function seed() {
  const client = await pool.connect();

  try {
    console.log("Starting seeding...");

    // Begin transaction
    await client.query("BEGIN");

    // 1. Clear existing data
    await client.query("DELETE FROM invoice_items");
    await client.query("DELETE FROM invoices");
    await client.query("DELETE FROM customers");

    // 2. Generate customers
    const customers = await createCustomers(client, 3);

    // 3. For each customer, generate invoices in batches
    for (const [idx, customer] of customers.entries()) {
      console.log(
        `\nSeeding invoices for customer ${customer.id} (${idx + 1}/${customers.length})...`,
      );
      await createInvoicesForCustomer(client, customer);
    }

    // Commit transaction
    await client.query("COMMIT");
    console.log("Seeding complete.");
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
    const name = faker.company.name();
    const address = `${faker.location.streetAddress({ useFullAddress: true })}, ${faker.location.city()}, ${faker.location.country()}`;
    const phone = faker.phone.number();
    const email = faker.internet.email();
    const taxId = faker.string.numeric(9);

    const res = await client.query(
      `INSERT INTO customers (name, address, phone, email, tax_id) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name, address, phone, email, taxId],
    );

    const customerId = res.rows[0].id;
    customers.push({ id: customerId, name });
    console.log(
      `Created customer ${i + 1}/${count}: ${name} (ID ${customerId})`,
    );
  }

  return customers;
}

async function createInvoicesForCustomer(client: any, customer: Customer) {
  const totalInvoices = 10000;
  let processedCount = 0;

  // Process in batches
  while (processedCount < totalInvoices) {
    const batchSize = Math.min(
      INVOICE_BATCH_SIZE,
      totalInvoices - processedCount,
    );
    const invoiceBatch: Invoice[] = [];
    const allItems: InvoiceItem[] = [];

    // Generate batch of invoices with their items
    for (let j = 0; j < batchSize; j++) {
      const invoiceNum = processedCount + j + 1;
      const { invoice, items } = generateInvoice(customer.id, invoiceNum);
      invoiceBatch.push(invoice);
    }

    // Insert invoices in batch
    const invoiceIds = await insertInvoiceBatch(client, invoiceBatch);

    // Generate and collect all items for all invoices in this batch
    invoiceIds.forEach((invoiceId, idx) => {
      const itemCount = faker.number.int({ min: 1, max: 5 });
      for (let k = 0; k < itemCount; k++) {
        allItems.push(generateInvoiceItem(invoiceId));
      }
    });

    // Insert items in sub-batches for better performance
    await insertInvoiceItemsBatched(client, allItems);

    processedCount += batchSize;
    console.log(
      `  Inserted ${processedCount} invoices for customer ${customer.id}`,
    );
  }
}

function generateInvoice(
  customerId: number,
  invoiceNum: number,
): { invoice: Invoice; items: InvoiceItem[] } {
  // Generate invoice header data
  const invoiceDate = faker.date.between({
    from: "2023-01-01",
    to: "2025-05-06",
  });
  const dueDate = faker.date.soon({ days: 30, refDate: invoiceDate });
  const invoiceNumber = `INV-${customerId}-${invoiceNum}`;
  const paymentTerms = "Net 30";
  const paymentMethod = faker.helpers.arrayElement([
    "Bank Transfer",
    "Credit Card",
    "PayPal",
  ]);
  const bankDetails = JSON.stringify({
    bank: faker.finance.accountName(),
    iban: faker.finance.iban(),
  });
  const notes = faker.lorem.sentence();

  // Generate line items
  const itemCount = faker.number.int({ min: 1, max: 5 });
  const items: InvoiceItem[] = [];

  let subtotal = 0;
  for (let k = 0; k < itemCount; k++) {
    const description = faker.commerce.productName();
    const quantity = faker.number.int({ min: 1, max: 10 });
    const unitPrice = parseFloat(
      faker.commerce.price({ min: 1, max: 1000, dec: 2 }),
    );

    subtotal += quantity * unitPrice;
    items.push({
      invoiceId: 0, // Will be updated after invoice insertion
      description,
      quantity,
      unitPrice,
    });
  }

  // Calculate totals
  const discount = parseFloat(
    faker.finance.amount({ min: 0, max: subtotal * 0.1, dec: 2 }),
  );
  const tax = parseFloat(((subtotal - discount) * 0.18).toFixed(2)); // 18% VAT
  const shipping = parseFloat(
    faker.finance.amount({ min: 0, max: 50, dec: 2 }),
  );
  const total = parseFloat((subtotal - discount + tax + shipping).toFixed(2));

  return {
    invoice: {
      invoiceNumber,
      invoiceDate,
      dueDate,
      customerId,
      subtotal,
      discount,
      tax,
      shipping,
      total,
      paymentTerms,
      paymentMethod,
      bankDetails,
      notes,
    },
    items,
  };
}

function generateInvoiceItem(invoiceId: number): InvoiceItem {
  return {
    invoiceId,
    description: faker.commerce.productName(),
    quantity: faker.number.int({ min: 1, max: 10 }),
    unitPrice: parseFloat(faker.commerce.price({ min: 1, max: 1000, dec: 2 })),
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
  for (let i = 0; i < items.length; i += ITEMS_BATCH_SIZE) {
    const batch = items.slice(i, i + ITEMS_BATCH_SIZE);

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
