import pool from "../db/pool";

interface PostgresError extends Error {
  code?: string;
  constraint?: string;
  detail?: string;
  schema?: string;
  table?: string;
  column?: string;
  dataType?: string;
  routine?: string;
}

/**
 * Custom error class for invoice-related operations
 */
export class InvoiceError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "InvoiceError";
  }
}

/**
 * Type definition for bank details stored as JSONB
 */
export interface BankDetails {
  bank?: string;
  iban?: string;
  swift?: string;
  account_number?: string;
  routing_number?: string;
  [key: string]: string | undefined;
}

/**
 * Type for invoice item input
 */
export interface NewInvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
}

/**
 * Type for invoice input
 */
export interface NewInvoiceInput {
  invoice_number: string;
  invoice_date: Date;
  due_date?: Date | null;
  customer_id: number;
  subtotal: number;
  discount?: number;
  tax?: number;
  shipping?: number;
  total: number;
  payment_terms?: string | null;
  payment_method?: string | null;
  bank_details?: BankDetails | null;
  notes?: string | null;
}

/**
 * Complete input for inserting an invoice with its items
 */
export interface NewInvoiceData {
  invoice: NewInvoiceInput;
  items: NewInvoiceItem[];
}

/**
 * Type for invoice item returned from database
 */
export interface InvoiceItem {
  id: number;
  invoice_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number; // Generated column in the database
  created_at: Date;
}

/**
 * Type for invoice returned from database
 */
export interface Invoice {
  id: number;
  invoice_number: string;
  invoice_date: Date;
  due_date: Date | null;
  customer_id: number;
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  payment_terms: string | null;
  payment_method: string | null;
  bank_details: BankDetails | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  items?: InvoiceItem[];
}

/**
 * Validates invoice data before insertion
 * @param data The invoice data to validate
 * @throws {InvoiceError} If validation fails
 */
function validateInvoiceData(data: NewInvoiceData): void {
  // Basic validation for required fields
  if (!data.invoice.invoice_number) {
    throw new InvoiceError("Invoice number is required");
  }

  if (!data.invoice.invoice_date) {
    throw new InvoiceError("Invoice date is required");
  }

  if (!data.invoice.customer_id || data.invoice.customer_id <= 0) {
    throw new InvoiceError("Valid customer ID is required");
  }

  if (data.invoice.subtotal < 0) {
    throw new InvoiceError("Subtotal cannot be negative");
  }

  if ((data.invoice.discount ?? 0) < 0) {
    throw new InvoiceError("Discount cannot be negative");
  }

  if ((data.invoice.tax ?? 0) < 0) {
    throw new InvoiceError("Tax cannot be negative");
  }

  if ((data.invoice.shipping ?? 0) < 0) {
    throw new InvoiceError("Shipping cannot be negative");
  }

  if (data.invoice.total < 0) {
    throw new InvoiceError("Total cannot be negative");
  }

  // Verify calculated total matches provided total
  const calculatedTotal =
    data.invoice.subtotal -
    (data.invoice.discount ?? 0) +
    (data.invoice.tax ?? 0) +
    (data.invoice.shipping ?? 0);

  // Using a small epsilon for floating-point comparison
  if (Math.abs(calculatedTotal - data.invoice.total) > 0.01) {
    throw new InvoiceError(
      `Total amount (${data.invoice.total}) does not match calculated total (${calculatedTotal.toFixed(2)})`,
    );
  }

  // Validate invoice items
  if (!data.items || data.items.length === 0) {
    throw new InvoiceError("At least one invoice item is required");
  }

  // Validate each item
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];

    if (!item.description) {
      throw new InvoiceError(`Item #${i + 1} is missing a description`);
    }

    if (item.quantity <= 0) {
      throw new InvoiceError(`Item #${i + 1} must have a positive quantity`);
    }

    if (item.unit_price < 0) {
      throw new InvoiceError(
        `Item #${i + 1} cannot have a negative unit price`,
      );
    }
  }
}

/**
 * Inserts a new invoice with its items into the database
 * @param pool PostgreSQL connection pool
 * @param data The invoice data to insert
 * @returns The inserted invoice with all its items
 * @throws {InvoiceError} If the insertion fails
 */

export async function uploadInvoice(data: NewInvoiceData): Promise<Invoice> {
  // Validate the invoice data before attempting insertion
  validateInvoiceData(data);

  const client = await pool.connect();

  try {
    // First, check if the customer exists
    const customerCheck = await client.query(
      "SELECT id FROM customers WHERE id = $1",
      [data.invoice.customer_id],
    );

    if (customerCheck.rowCount === 0) {
      // Customer doesn't exist, throw a specific error
      throw new InvoiceError(
        `Customer with ID ${data.invoice.customer_id} does not exist`,
      );
    }

    // Start a transaction
    await client.query("BEGIN");

    // Insert the invoice
    const invoiceResult = await client.query<Invoice>(
      `INSERT INTO invoices (
        invoice_number, invoice_date, due_date, customer_id, 
        subtotal, discount, tax, shipping, total,
        payment_terms, payment_method, bank_details, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
      RETURNING *`,
      [
        data.invoice.invoice_number,
        data.invoice.invoice_date,
        data.invoice.due_date ?? null,
        data.invoice.customer_id,
        data.invoice.subtotal,
        data.invoice.discount ?? 0,
        data.invoice.tax ?? 0,
        data.invoice.shipping ?? 0,
        data.invoice.total,
        data.invoice.payment_terms ?? null,
        data.invoice.payment_method ?? null,
        data.invoice.bank_details
          ? JSON.stringify(data.invoice.bank_details)
          : null,
        data.invoice.notes ?? null,
      ],
    );

    if (invoiceResult.rowCount === 0) {
      throw new InvoiceError("Failed to insert invoice");
    }

    const insertedInvoice = invoiceResult.rows[0];
    const insertedItems: InvoiceItem[] = [];

    // Insert all invoice items
    for (const item of data.items) {
      const itemResult = await client.query<InvoiceItem>(
        `INSERT INTO invoice_items (
          invoice_id, description, quantity, unit_price
        ) VALUES ($1, $2, $3, $4)
        RETURNING *`,
        [insertedInvoice.id, item.description, item.quantity, item.unit_price],
      );

      if (itemResult.rowCount === 0) {
        throw new InvoiceError("Failed to insert invoice item");
      }

      insertedItems.push(itemResult.rows[0]);
    }

    // Commit the transaction
    await client.query("COMMIT");

    // Return the complete invoice with its items
    return {
      ...insertedInvoice,
      items: insertedItems,
    };
  } catch (error: unknown) {
    // Rollback the transaction in case of error
    await client.query("ROLLBACK");

    // Check if it's a Postgres error with a foreign key violation
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      "constraint" in error
    ) {
      const pgError = error as PostgresError;

      // If it's a foreign key violation for customer_id, provide a specific message
      if (
        pgError.code === "23503" &&
        pgError.constraint === "invoices_customer_id_fkey"
      ) {
        throw new InvoiceError(
          "Customer not found. Please create this customer first.",
        );
      }
    }

    // Rethrow with proper context
    if (error instanceof InvoiceError) {
      throw error;
    }

    throw new InvoiceError("Invoice insertion failed", error);
  } finally {
    // Release the client back to the pool
    client.release();
  }
}
/*
 * Example usage:
 *
 * const pool = new Pool({
 *   // Database connection config
 * });
 *
 * try {
 *   const newInvoice = await insertInvoice(pool, {
 *     invoice: {
 *       invoice_number: "INV-2025-0042",
 *       invoice_date: new Date(),
 *       due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
 *       customer_id: 123,
 *       subtotal: 1000.00,
 *       tax: 100.00,
 *       total: 1100.00,
 *       payment_terms: "Net 30",
 *       payment_method: "Bank Transfer"
 *     },
 *     items: [
 *       {
 *         description: "Consulting Services",
 *         quantity: 10,
 *         unit_price: 100.00
 *       }
 *     ]
 *   });
 *
 *   console.log("Invoice created:", newInvoice.id);
 * } catch (error) {
 *   console.error("Failed to create invoice:", error);
 * }
 */
