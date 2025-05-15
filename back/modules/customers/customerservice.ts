import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import pool from "../db/pool"; // Same pool as used in invoice module

// Customer router
export const customers = new Hono();

/**
 * Custom error class for customer-related operations
 */
export class CustomerError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "CustomerError";
  }
}

/**
 * Type for customer input
 */
export interface NewCustomerInput {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  tax_id?: string | null;
}

/**
 * Type for customer returned from database
 */
export interface Customer {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  tax_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Validate customer data
 */
function validateCustomerData(data: NewCustomerInput): void {
  if (!data.name || data.name.trim() === "") {
    throw new CustomerError("Customer name is required");
  }
}

/**
 * Create a new customer in the database
 */
export async function createCustomer(
  data: NewCustomerInput,
): Promise<Customer> {
  validateCustomerData(data);

  const client = await pool.connect();

  try {
    const result = await client.query<Customer>(
      `INSERT INTO customers (
        name, address, phone, email, tax_id
      ) VALUES ($1, $2, $3, $4, $5) 
      RETURNING *`,
      [
        data.name,
        data.address || null,
        data.phone || null,
        data.email || null,
        data.tax_id || null,
      ],
    );

    if (result.rowCount === 0) {
      throw new CustomerError("Failed to create customer");
    }

    return result.rows[0];
  } catch (error) {
    if (error instanceof CustomerError) {
      throw error;
    }
    throw new CustomerError("Customer creation failed", error);
  } finally {
    client.release();
  }
}

/**
 * GET /api/customers
 * Retrieve all customers
 */
customers.get("/", async (c) => {
  try {
    const client = await pool.connect();

    try {
      const result = await client.query<Customer>(
        "SELECT * FROM customers ORDER BY name",
      );
      return c.json(result.rows);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error retrieving customers:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * POST /api/customers
 * Create a new customer
 */
customers.post("/", async (c) => {
  try {
    const data = (await c.req.json()) as NewCustomerInput;
    const result = await createCustomer(data);
    return c.json(result, 201);
  } catch (error) {
    console.error("Error creating customer:", error);

    if (error instanceof CustomerError) {
      return c.json({ error: error.message }, 400);
    }

    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /api/customers/:id
 * Get a specific customer by ID
 */
customers.get("/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) {
      throw new HTTPException(400, { message: "Invalid customer ID" });
    }

    const client = await pool.connect();
    try {
      const result = await client.query<Customer>(
        "SELECT * FROM customers WHERE id = $1",
        [id],
      );

      if (result.rowCount === 0) {
        return c.json({ error: "Customer not found" }, 404);
      }

      return c.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error retrieving customer:", error);

    if (error instanceof HTTPException) {
      return c.json({ error: error.message }, error.status);
    }

    return c.json({ error: "Internal server error" }, 500);
  }
});
