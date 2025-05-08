import pool from "../db/pool";

/**
 * Custom error class for invoice query operations
 */
export class InvoiceQueryError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "InvoiceQueryError";
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
 * Type for invoice item
 */
export interface InvoiceItem {
  id: number;
  invoice_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: Date;
}

/**
 * Type for invoice
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
}

/**
 * Type for customer basic info
 */
export interface Customer {
  id: number;
  name: string;
  email: string | null;
  tax_id: string | null;
}

/**
 * Extended invoice with customer data
 */
export interface InvoiceWithCustomer extends Invoice {
  customer: Customer;
}

/**
 * Complete invoice with customer and items
 */
export interface CompleteInvoice extends InvoiceWithCustomer {
  items: InvoiceItem[];
}

/**
 * Supported sort fields for invoices
 */
export type InvoiceSortField =
  | "id"
  | "invoice_number"
  | "invoice_date"
  | "due_date"
  | "customer_id"
  | "customer_name"
  | "subtotal"
  | "total"
  | "created_at";

/**
 * Sort direction
 */
export type SortDirection = "asc" | "desc";

/**
 * Sort specification
 */
export interface SortSpec {
  field: InvoiceSortField;
  direction: SortDirection;
}

/**
 * Date range filter
 */
export interface DateRangeFilter {
  from?: Date;
  to?: Date;
}

/**
 * Number range filter
 */
export interface NumberRangeFilter {
  min?: number;
  max?: number;
}

/**
 * Invoice filter options
 */
export interface InvoiceFilter {
  invoiceNumber?: string;
  customerName?: string;
  customerId?: number;
  invoiceDateRange?: DateRangeFilter;
  dueDateRange?: DateRangeFilter;
  totalRange?: NumberRangeFilter;
  paymentMethod?: string;
  searchTerm?: string; // Generic search across multiple fields
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
}

/**
 * Include options for related data
 */
export interface IncludeOptions {
  customer?: boolean;
  items?: boolean;
}

/**
 * Query parameters for retrieving invoices
 */
export interface GetInvoicesParams {
  pagination: PaginationOptions;
  sort?: SortSpec[];
  filter?: InvoiceFilter;
  include?: IncludeOptions;
}

/**
 * Response with pagination metadata
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/**
 * Maps frontend sort fields to database columns
 */
function mapSortFieldToColumn(field: InvoiceSortField): string {
  const mapping: Record<InvoiceSortField, string> = {
    id: "i.id",
    invoice_number: "i.invoice_number",
    invoice_date: "i.invoice_date",
    due_date: "i.due_date",
    customer_id: "i.customer_id",
    customer_name: "c.name",
    subtotal: "i.subtotal",
    total: "i.total",
    created_at: "i.created_at",
  };

  return mapping[field] || "i.id";
}

/**
 * Retrieves invoices with pagination, sorting, and filtering for a datatable
 * @param pool PostgreSQL connection pool
 * @param params Query parameters including pagination, sorting, and filtering options
 * @returns Paginated list of invoices
 * @throws {InvoiceQueryError} If the query fails
 */
export async function getInvoices(
  params: GetInvoicesParams,
): Promise<PaginatedResponse<Invoice | InvoiceWithCustomer | CompleteInvoice>> {
  try {
    const { pagination, sort, filter, include } = params;
    const { page, pageSize } = pagination;

    // Input validation
    if (page < 1) {
      throw new InvoiceQueryError("Page must be greater than or equal to 1");
    }

    if (pageSize < 1 || pageSize > 100) {
      throw new InvoiceQueryError("Page size must be between 1 and 100");
    }

    // Calculate offset
    const offset = (page - 1) * pageSize;

    // Start building queries
    const includeCustomer = include?.customer === true;
    const includeItems = include?.items === true;

    // Base query for counting total records
    let countQuery = `
      SELECT COUNT(*) as total
      FROM invoices i
    `;

    // Base query for fetching data
    let dataQuery = `
      SELECT i.*
      ${includeCustomer ? ", c.id as c_id, c.name as c_name, c.email as c_email, c.tax_id as c_tax_id" : ""}
      FROM invoices i
    `;

    // Add joins if needed
    if (
      includeCustomer ||
      filter?.customerName ||
      sort?.some((s) => s.field === "customer_name")
    ) {
      countQuery += " LEFT JOIN customers c ON i.customer_id = c.id";
      dataQuery += " LEFT JOIN customers c ON i.customer_id = c.id";
    }

    // Build WHERE clause for filtering
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (filter) {
      if (filter.invoiceNumber) {
        whereConditions.push(`i.invoice_number ILIKE $${paramIndex}`);
        queryParams.push(`%${filter.invoiceNumber}%`);
        paramIndex++;
      }

      if (filter.customerId) {
        whereConditions.push(`i.customer_id = $${paramIndex}`);
        queryParams.push(filter.customerId);
        paramIndex++;
      }

      if (filter.customerName) {
        whereConditions.push(`c.name ILIKE $${paramIndex}`);
        queryParams.push(`%${filter.customerName}%`);
        paramIndex++;
      }

      if (filter.invoiceDateRange) {
        if (filter.invoiceDateRange.from) {
          whereConditions.push(`i.invoice_date >= $${paramIndex}`);
          queryParams.push(filter.invoiceDateRange.from);
          paramIndex++;
        }

        if (filter.invoiceDateRange.to) {
          whereConditions.push(`i.invoice_date <= $${paramIndex}`);
          queryParams.push(filter.invoiceDateRange.to);
          paramIndex++;
        }
      }

      if (filter.dueDateRange) {
        if (filter.dueDateRange.from) {
          whereConditions.push(`i.due_date >= $${paramIndex}`);
          queryParams.push(filter.dueDateRange.from);
          paramIndex++;
        }

        if (filter.dueDateRange.to) {
          whereConditions.push(`i.due_date <= $${paramIndex}`);
          queryParams.push(filter.dueDateRange.to);
          paramIndex++;
        }
      }

      if (filter.totalRange) {
        if (filter.totalRange.min !== undefined) {
          whereConditions.push(`i.total >= $${paramIndex}`);
          queryParams.push(filter.totalRange.min);
          paramIndex++;
        }

        if (filter.totalRange.max !== undefined) {
          whereConditions.push(`i.total <= $${paramIndex}`);
          queryParams.push(filter.totalRange.max);
          paramIndex++;
        }
      }

      if (filter.paymentMethod) {
        whereConditions.push(`i.payment_method ILIKE $${paramIndex}`);
        queryParams.push(`%${filter.paymentMethod}%`);
        paramIndex++;
      }

      // Generic search term across multiple fields
      if (filter.searchTerm) {
        const searchValue = `%${filter.searchTerm}%`;
        whereConditions.push(`(
          i.invoice_number ILIKE $${paramIndex} OR
          i.notes ILIKE $${paramIndex} OR
          c.name ILIKE $${paramIndex}
        )`);
        queryParams.push(searchValue);
        paramIndex++;
      }
    }

    // Add WHERE clause to queries if conditions exist
    if (whereConditions.length > 0) {
      const whereClause = ` WHERE ${whereConditions.join(" AND ")}`;
      countQuery += whereClause;
      dataQuery += whereClause;
    }

    // Add ORDER BY clause for sorting
    let orderClause = " ORDER BY ";

    if (sort && sort.length > 0) {
      const sortClauses = sort.map(
        (s) => `${mapSortFieldToColumn(s.field)} ${s.direction.toUpperCase()}`,
      );
      orderClause += sortClauses.join(", ");
    } else {
      // Default sorting
      orderClause += "i.invoice_date DESC";
    }

    dataQuery += orderClause;

    // Add pagination
    dataQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const paginationParams = [pageSize, offset];

    // Get total count
    const countResult = await pool.query(countQuery, queryParams);
    const totalItems = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalItems / pageSize);

    // Get paginated data
    const dataResult = await pool.query(dataQuery, [
      ...queryParams,
      ...paginationParams,
    ]);

    // Format the results
    const invoices: (Invoice | InvoiceWithCustomer | CompleteInvoice)[] =
      dataResult.rows.map((row) => {
        // Base invoice data
        const invoice: Invoice = {
          id: row.id,
          invoice_number: row.invoice_number,
          invoice_date: row.invoice_date,
          due_date: row.due_date,
          customer_id: row.customer_id,
          subtotal: parseFloat(row.subtotal),
          discount: parseFloat(row.discount),
          tax: parseFloat(row.tax),
          shipping: parseFloat(row.shipping),
          total: parseFloat(row.total),
          payment_terms: row.payment_terms,
          payment_method: row.payment_method,
          bank_details: row.bank_details,
          notes: row.notes,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };

        // Add customer data if included
        if (includeCustomer) {
          const invoiceWithCustomer: InvoiceWithCustomer = {
            ...invoice,
            customer: {
              id: row.c_id,
              name: row.c_name,
              email: row.c_email,
              tax_id: row.c_tax_id,
            },
          };

          return invoiceWithCustomer;
        }

        return invoice;
      });

    // Get invoice items if requested
    if (includeItems && invoices.length > 0) {
      const invoiceIds = invoices.map((inv) => inv.id);

      const itemsQuery = `
        SELECT * FROM invoice_items
        WHERE invoice_id = ANY($1)
        ORDER BY invoice_id, id
      `;

      const itemsResult = await pool.query(itemsQuery, [invoiceIds]);

      // Group items by invoice_id
      const itemsByInvoiceId: Record<number, InvoiceItem[]> = {};

      for (const row of itemsResult.rows) {
        const item: InvoiceItem = {
          id: row.id,
          invoice_id: row.invoice_id,
          description: row.description,
          quantity: parseFloat(row.quantity),
          unit_price: parseFloat(row.unit_price),
          line_total: parseFloat(row.line_total),
          created_at: row.created_at,
        };

        if (!itemsByInvoiceId[item.invoice_id]) {
          itemsByInvoiceId[item.invoice_id] = [];
        }

        itemsByInvoiceId[item.invoice_id].push(item);
      }

      // Add items to invoices
      for (const invoice of invoices) {
        const items = itemsByInvoiceId[invoice.id] || [];

        if (includeCustomer) {
          (invoice as CompleteInvoice).items = items;
        } else {
          (invoice as any).items = items;
        }
      }
    }

    // Return paginated response
    return {
      data: invoices,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  } catch (error) {
    // Rethrow with proper context
    if (error instanceof InvoiceQueryError) {
      throw error;
    }

    throw new InvoiceQueryError("Failed to retrieve invoices", error);
  }
}

/**
 * Example usage:
 *
 * const pool = new Pool({
 *   // Database connection config
 * });
 *
 * try {
 *   const result = await getInvoicesForDataTable(pool, {
 *     pagination: {
 *       page: 1,
 *       pageSize: 10
 *     },
 *     sort: [
 *       { field: 'invoice_date', direction: 'desc' },
 *       { field: 'invoice_number', direction: 'asc' }
 *     ],
 *     filter: {
 *       customerName: 'Acme',
 *       invoiceDateRange: {
 *         from: new Date('2025-01-01'),
 *         to: new Date('2025-12-31')
 *       },
 *       totalRange: {
 *         min: 1000
 *       }
 *     },
 *     include: {
 *       customer: true,
 *       items: true
 *     }
 *   });
 *
 *   console.log(`Retrieved ${result.data.length} of ${result.pagination.totalItems} invoices`);
 * } catch (error) {
 *   console.error("Failed to retrieve invoices:", error);
 * }
 */
