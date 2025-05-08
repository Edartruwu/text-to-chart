import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  getInvoices,
  GetInvoicesParams,
  InvoiceQueryError,
  SortSpec,
  InvoiceFilter,
  DateRangeFilter,
  NumberRangeFilter,
  IncludeOptions,
} from "./getInvoices"; // Assuming first file is in this path
import { uploadInvoice, NewInvoiceData, InvoiceError } from "./uploadInvoice"; // Assuming second file is in this path

// Create a Hono invoices for invoice routes
export const invoices = new Hono();

/**
 * Helper function to parse date range filter
 */
const parseDateRangeFilter = (
  from?: string,
  to?: string,
): DateRangeFilter | undefined => {
  if (!from && !to) return undefined;

  const filter: DateRangeFilter = {};

  if (from) {
    const fromDate = new Date(from);
    if (isNaN(fromDate.getTime())) {
      throw new HTTPException(400, {
        message: `Invalid date format for 'from': ${from}`,
      });
    }
    filter.from = fromDate;
  }

  if (to) {
    const toDate = new Date(to);
    if (isNaN(toDate.getTime())) {
      throw new HTTPException(400, {
        message: `Invalid date format for 'to': ${to}`,
      });
    }
    filter.to = toDate;
  }

  return filter;
};

/**
 * Helper function to parse number range filter
 */
const parseNumberRangeFilter = (
  min?: string,
  max?: string,
): NumberRangeFilter | undefined => {
  if (!min && !max) return undefined;

  const filter: NumberRangeFilter = {};

  if (min) {
    const minValue = parseFloat(min);
    if (isNaN(minValue)) {
      throw new HTTPException(400, {
        message: `Invalid number format for 'min': ${min}`,
      });
    }
    filter.min = minValue;
  }

  if (max) {
    const maxValue = parseFloat(max);
    if (isNaN(maxValue)) {
      throw new HTTPException(400, {
        message: `Invalid number format for 'max': ${max}`,
      });
    }
    filter.max = maxValue;
  }

  return filter;
};

/**
 * GET /api/invoices
 * Retrieve invoices with pagination, filtering, and sorting
 */
invoices.get("/", async (c) => {
  try {
    // Parse query parameters
    const query = c.req.query();

    // Parse pagination
    const pageStr = query.page || "1";
    const pageSizeStr = query.pageSize || "10";

    let page: number;
    let pageSize: number;

    try {
      page = parseInt(pageStr, 10);
      if (isNaN(page) || page < 1) {
        throw new HTTPException(400, {
          message: "Page must be a positive integer",
        });
      }
    } catch (e) {
      throw new HTTPException(400, {
        message: `Invalid page parameter: ${pageStr}`,
      });
    }

    try {
      pageSize = parseInt(pageSizeStr, 10);
      if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
        throw new HTTPException(400, {
          message: "Page size must be between 1 and 100",
        });
      }
    } catch (e) {
      throw new HTTPException(400, {
        message: `Invalid page size parameter: ${pageSizeStr}`,
      });
    }

    // Parse sort parameters
    let sort: SortSpec[] | undefined;
    if (query.sort) {
      try {
        sort = JSON.parse(query.sort);
        // Validate sort structure
        if (!Array.isArray(sort)) {
          throw new HTTPException(400, {
            message: "Sort parameter must be an array",
          });
        }

        for (const sortSpec of sort) {
          if (!sortSpec.field || !sortSpec.direction) {
            throw new HTTPException(400, {
              message:
                "Each sort specification must have a field and direction",
            });
          }

          if (!["asc", "desc"].includes(sortSpec.direction.toLowerCase())) {
            throw new HTTPException(400, {
              message: 'Sort direction must be "asc" or "desc"',
            });
          }
        }
      } catch (e) {
        if (e instanceof HTTPException) throw e;
        throw new HTTPException(400, {
          message: `Invalid sort parameter format: ${e}`,
        });
      }
    }

    // Parse filter parameters
    let filter: InvoiceFilter | undefined;
    const invoiceNumber = query.invoiceNumber;
    const customerName = query.customerName;
    const customerId = query.customerId
      ? parseInt(query.customerId, 10)
      : undefined;
    const invoiceDateFrom = query.invoiceDateFrom;
    const invoiceDateTo = query.invoiceDateTo;
    const dueDateFrom = query.dueDateFrom;
    const dueDateTo = query.dueDateTo;
    const totalMin = query.totalMin;
    const totalMax = query.totalMax;
    const paymentMethod = query.paymentMethod;
    const searchTerm = query.searchTerm;

    if (
      invoiceNumber ||
      customerName ||
      customerId ||
      invoiceDateFrom ||
      invoiceDateTo ||
      dueDateFrom ||
      dueDateTo ||
      totalMin ||
      totalMax ||
      paymentMethod ||
      searchTerm
    ) {
      filter = {};

      if (invoiceNumber) filter.invoiceNumber = invoiceNumber;
      if (customerName) filter.customerName = customerName;

      if (customerId !== undefined) {
        if (isNaN(customerId)) {
          throw new HTTPException(400, {
            message: `Invalid customer ID: ${query.customerId}`,
          });
        }
        filter.customerId = customerId;
      }

      try {
        if (invoiceDateFrom || invoiceDateTo) {
          filter.invoiceDateRange = parseDateRangeFilter(
            invoiceDateFrom,
            invoiceDateTo,
          );
        }

        if (dueDateFrom || dueDateTo) {
          filter.dueDateRange = parseDateRangeFilter(dueDateFrom, dueDateTo);
        }

        if (totalMin || totalMax) {
          filter.totalRange = parseNumberRangeFilter(totalMin, totalMax);
        }
      } catch (error) {
        if (error instanceof HTTPException) throw error;
        throw new HTTPException(400, { message: `${error}` });
      }

      if (paymentMethod) filter.paymentMethod = paymentMethod;
      if (searchTerm) filter.searchTerm = searchTerm;
    }

    // Parse include options
    let include: IncludeOptions | undefined;
    const includeCustomer = query.includeCustomer === "true";
    const includeItems = query.includeItems === "true";

    if (includeCustomer || includeItems) {
      include = {
        customer: includeCustomer,
        items: includeItems,
      };
    }

    // Construct params object
    const params: GetInvoicesParams = {
      pagination: { page, pageSize },
    };

    if (sort) params.sort = sort;
    if (filter) params.filter = filter;
    if (include) params.include = include;

    // Call the getInvoices function
    const result = await getInvoices(params);

    // Return the result
    return c.json(result);
  } catch (error) {
    console.error("Error retrieving invoices:", error);

    if (error instanceof HTTPException) {
      return c.json({ error: error.message }, error.status);
    }

    if (error instanceof InvoiceQueryError) {
      return c.json({ error: error.message }, 400);
    }

    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * POST /api/invoices
 * Create a new invoice with items
 */
invoices.post("/", async (c) => {
  try {
    // Parse request body
    const data = (await c.req.json()) as NewInvoiceData;

    // Convert string dates to Date objects if needed
    if (
      data.invoice.invoice_date &&
      typeof data.invoice.invoice_date === "string"
    ) {
      const date = new Date(data.invoice.invoice_date);
      if (isNaN(date.getTime())) {
        throw new HTTPException(400, {
          message: `Invalid invoice date: ${data.invoice.invoice_date}`,
        });
      }
      data.invoice.invoice_date = date;
    }

    if (data.invoice.due_date && typeof data.invoice.due_date === "string") {
      const date = new Date(data.invoice.due_date);
      if (isNaN(date.getTime())) {
        throw new HTTPException(400, {
          message: `Invalid due date: ${data.invoice.due_date}`,
        });
      }
      data.invoice.due_date = date;
    }

    // Call the uploadInvoice function (validation hinvoicesens inside)
    const result = await uploadInvoice(data);

    // Return the created invoice with a 201 status
    return c.json(result, 201);
  } catch (error) {
    console.error("Error creating invoice:", error);

    if (error instanceof HTTPException) {
      return c.json({ error: error.message }, error.status);
    }

    if (error instanceof InvoiceError) {
      return c.json({ error: error.message }, 400);
    }

    return c.json({ error: "Internal server error" }, 500);
  }
});
