import openAiClient from "../openai/client";
import pool from "../db/pool";

// Use the imported OpenAI client
const openai = openAiClient;

// Chart data interfaces
interface PieChartData {
  labels: string[];
  values: number[];
  colors?: string[]; // Optional colors for each segment
}

interface WaterfallChartData {
  categories: string[];
  values: number[];
  increaseLabelText?: string;
  decreaseLabelText?: string;
  totalLabelText?: string;
}

// Statistics interfaces
interface PieChartStatistics {
  type: "pie_chart";
  data: PieChartData;
}

interface WaterfallChartStatistics {
  type: "waterfall_chart";
  data: WaterfallChartData;
}

type Statistics = PieChartStatistics | WaterfallChartStatistics;

interface StatisticsResponse {
  interpretation: string;
  statistics: Statistics;
}
// JSON schema definitions for response validation
const statisticsResponseSchema = {
  type: "object",
  required: ["interpretation", "statistics"],
  additionalProperties: false,
  properties: {
    interpretation: {
      type: "string",
      description: "Insightful analysis of the data",
    },
    statistics: {
      type: "object",
      required: ["type", "data"],
      additionalProperties: false,
      properties: {
        type: {
          type: "string",
          enum: ["pie_chart", "waterfall_chart"],
          description: "The type of chart to display",
        },
        data: {
          type: "object",
          // Instead of using oneOf, include all possible properties
          additionalProperties: false,
          // Include all properties as required to satisfy OpenAI
          required: [
            "labels",
            "values",
            "categories",
            "increaseLabelText",
            "decreaseLabelText",
            "totalLabelText",
            "colors",
          ],
          properties: {
            // Pie chart properties
            labels: {
              type: "array",
              items: { type: "string" },
              description: "Category labels for the pie chart",
            },
            values: {
              type: "array",
              items: { type: "number" },
              description: "Numeric values for each category",
            },
            colors: {
              type: "array",
              items: { type: "string" },
              description: "Optional hex color codes for each segment",
            },
            // Waterfall chart properties
            categories: {
              type: "array",
              items: { type: "string" },
              description: "Category labels for the waterfall chart",
            },
            increaseLabelText: {
              type: "string",
              description: "Optional label for increase values",
            },
            decreaseLabelText: {
              type: "string",
              description: "Optional label for decrease values",
            },
            totalLabelText: {
              type: "string",
              description: "Optional label for total value",
            },
          },
        },
      },
    },
  },
};

const dbSchema = `
1.1 DATABASE SCHEMA 

-- 1. Buyers / Customers
CREATE TABLE customers (
  id              SERIAL PRIMARY KEY,
  name            TEXT      NOT NULL,
  address         TEXT,
  phone           TEXT,
  email           TEXT,
  tax_id          TEXT,                             -- VAT/TIN number
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Invoices
CREATE TABLE invoices (
  id                SERIAL PRIMARY KEY,
  invoice_number    VARCHAR(50)   NOT NULL UNIQUE,   -- e.g. "INV-2025-0001"
  invoice_date      DATE          NOT NULL,
  due_date          DATE,
  customer_id       INTEGER       NOT NULL
      REFERENCES customers(id)
      ON DELETE RESTRICT,
  
  subtotal          NUMERIC(12,2) NOT NULL,          -- sum of line totals
  discount          NUMERIC(12,2) NOT NULL DEFAULT 0, -- any invoice‐level discount
  tax               NUMERIC(12,2) NOT NULL DEFAULT 0, -- VAT or sales tax
  shipping          NUMERIC(12,2) NOT NULL DEFAULT 0,
  total             NUMERIC(12,2) NOT NULL,          -- subtotal – discount + tax + shipping
  
  payment_terms     TEXT,                            -- e.g. "Net 30"
  payment_method    TEXT,                            -- e.g. "Bank Transfer", "Credit Card"
  bank_details      JSONB,                           -- { "bank": "...", "iban": "...", ... }
  
  notes             TEXT,                            -- free‐form ("Thank you", returns policy, etc.)
  
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Line‐Items on each Invoice
CREATE TABLE invoice_items (
  id             SERIAL PRIMARY KEY,
  invoice_id     INTEGER       NOT NULL
      REFERENCES invoices(id)
      ON DELETE CASCADE,
  description    TEXT          NOT NULL,
  quantity       NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price     NUMERIC(12,2) NOT NULL,
  line_total     NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

`;

// Enhanced system prompt with guidance for SQL and visualization
const enhancedSystemPrompt = `
You are an expert PostgreSQL data analyst specialized in generating visualizations with these capabilities:

1. SQL EXPERTISE:
   - Write optimized, secure, and efficient PostgreSQL queries
   - Implement proper indexing and query planning techniques
   - Use PostgreSQL-specific features appropriately
   - Prevent SQL injection through parameterization
   - Format queries with consistent indentation

1.1 DATABASE SCHEMA 

-- 1. Buyers / Customers
CREATE TABLE customers (
  id              SERIAL PRIMARY KEY,
  name            TEXT      NOT NULL,
  address         TEXT,
  phone           TEXT,
  email           TEXT,
  tax_id          TEXT,                             -- VAT/TIN number
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Invoices
CREATE TABLE invoices (
  id                SERIAL PRIMARY KEY,
  invoice_number    VARCHAR(50)   NOT NULL UNIQUE,   -- e.g. "INV-2025-0001"
  invoice_date      DATE          NOT NULL,
  due_date          DATE,
  customer_id       INTEGER       NOT NULL
      REFERENCES customers(id)
      ON DELETE RESTRICT,
  
  subtotal          NUMERIC(12,2) NOT NULL,          -- sum of line totals
  discount          NUMERIC(12,2) NOT NULL DEFAULT 0, -- any invoice‐level discount
  tax               NUMERIC(12,2) NOT NULL DEFAULT 0, -- VAT or sales tax
  shipping          NUMERIC(12,2) NOT NULL DEFAULT 0,
  total             NUMERIC(12,2) NOT NULL,          -- subtotal – discount + tax + shipping
  
  payment_terms     TEXT,                            -- e.g. "Net 30"
  payment_method    TEXT,                            -- e.g. "Bank Transfer", "Credit Card"
  bank_details      JSONB,                           -- { "bank": "...", "iban": "...", ... }
  
  notes             TEXT,                            -- free‐form ("Thank you", returns policy, etc.)
  
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Line‐Items on each Invoice
CREATE TABLE invoice_items (
  id             SERIAL PRIMARY KEY,
  invoice_id     INTEGER       NOT NULL
      REFERENCES invoices(id)
      ON DELETE CASCADE,
  description    TEXT          NOT NULL,
  quantity       NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price     NUMERIC(12,2) NOT NULL,
  line_total     NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

2. DATA VISUALIZATION GUIDELINES:
   - Pie charts: For proportions, parts of a whole, or categories summing to 100% (ideally ≤7 categories)
   - Waterfall charts: For showing transitions between values, running totals, or sequential changes

Return a valid JSON with this structure:
{
  "interpretation": "Your analysis of the data",
  "statistics": {
    "type": "pie_chart" | "waterfall_chart",
    "data": { 
      // Fields for the chosen chart type
    }
  }
}

For pie_chart:
{
  "labels": ["Category1", "Category2", ...],
  "values": [value1, value2, ...],
  "colors": ["#hex1", "#hex2", ...] // optional
}

For waterfall_chart:
{
  "categories": ["Start", "Income", "Expenses", "End", ...],
  "values": [value1, value2, ...],
  "increaseLabelText": "Increase", // optional
  "decreaseLabelText": "Decrease", // optional
  "totalLabelText": "Total" // optional
}
`;

/**
 * Execute a SQL query against PostgreSQL database
 * @param query - SQL query to execute
 * @param params - Optional query parameters
 * @returns Query result rows
 * @throws Database query error
 */
function makeQuery(query: string, params: any[] = []): Promise<any[]> {
  if (!query || typeof query !== "string" || query.trim() === "") {
    return Promise.reject(
      new Error("Invalid query: Query must be a non-empty string"),
    );
  }

  return new Promise<any[]>((resolve, reject) => {
    pool
      .query(query, params)
      .then((result) => {
        resolve(result.rows);
      })
      .catch((error: Error) => {
        console.error("Database query error:", error);
        reject(new Error(`Database error: ${error.message}`));
      });
  });
}

/**
 * Generate a SQL query for the given question using OpenAI
 * @param question - The user's statistical question
 * @param dbSchema - Optional database schema
 * @returns Generated SQL query
 * @throws If query generation fails
 */

async function generateSqlQuery(
  question: string,
  dbSchema?: string,
): Promise<string> {
  // Validate input upfront
  if (!question || typeof question !== "string" || question.trim() === "") {
    throw new Error("Invalid question: Question must be a non-empty string");
  }

  // Build the prompt, including schema if provided
  const contextPrompt = `Database schema:\n${dbSchema}\n\nGenerate a PostgreSQL query to answer: ${question}, remember to only answer with the sql query string, do not markdown format it just write the query directly`;

  try {
    // Await the OpenAI call directly
    const response = await openai.responses.create({
      model: "o4-mini-2025-04-16",
      input: [
        { role: "system", content: enhancedSystemPrompt },
        { role: "user", content: contextPrompt },
      ],
      reasoning: { effort: "high" },
    });

    console.log(JSON.stringify(response));

    // Extract SQL from output_text property
    const sqlQuery = response.output_text?.trim() ?? "";

    // Basic sanity check
    if (!sqlQuery.toUpperCase().includes("SELECT")) {
      throw new Error("Failed to generate a valid SQL query");
    }

    return sqlQuery;
  } catch (err: any) {
    console.error("OpenAI query generation error:", err);
    // Wrap and re‑throw so callers still get a rejected Promise
    throw new Error(`Failed to generate SQL query: ${err.message || err}`);
  }
}

/**
 * Generate analysis and visualization from query results
 * @param data - The query results
 * @param originalQuestion - The original question for context
 * @returns Analysis and visualization
 */
function generateAnalysis(
  data: any[],
  originalQuestion: string,
): Promise<StatisticsResponse> {
  // Handle empty data case
  if (!data || data.length === 0) {
    return Promise.resolve({
      interpretation: "No data available for analysis.",
      statistics: {
        type: "pie_chart",
        data: {
          labels: ["No Data"],
          values: [100],
        },
      },
    });
  }

  // Serialize data for the OpenAI prompt
  const serializedData = JSON.stringify(data);

  return new Promise<StatisticsResponse>((resolve, reject) => {
    openai.responses
      .create({
        model: "o4-mini-2025-04-16",
        input: [
          { role: "system", content: enhancedSystemPrompt },
          {
            role: "user",
            content: `
          Analyze these query results and generate an appropriate statistical visualization.
          
          Original question: ${originalQuestion}
          
          Query results: ${serializedData}
          
          Choose either a pie_chart or waterfall_chart based on the data characteristics.
          Return a JSON object with "interpretation" and "statistics" fields as specified.
          `,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "StatisticsResponse",
            schema: statisticsResponseSchema,
            description: "Statistical analysis with visualization data",
            strict: true,
          },
        },
        reasoning: {
          effort: "high",
        },
      })
      .then((response) => {
        try {
          const content = response.output_text;
          let parsedResponse;

          // The response should already be in JSON format due to schema specification
          try {
            parsedResponse = JSON.parse(content);
          } catch {
            // If JSON parsing fails, use the content directly (it might already be an object)
            parsedResponse = content;
          }

          // Validate and ensure the response has the correct structure
          resolve(validateResponse(parsedResponse));
        } catch (error: any) {
          console.error("Error parsing OpenAI response:", error);
          resolve(
            createErrorResponse(
              "Failed to generate visualization from query results",
            ),
          );
        }
      })
      .catch((error: Error) => {
        console.error("OpenAI analysis error:", error);
        resolve(
          createErrorResponse(`Analysis generation failed: ${error.message}`),
        );
      });
  });
}

/**
 * Validate the response structure
 * @param response - The response to validate
 * @returns Validated response or error response
 */
function validateResponse(response: any): StatisticsResponse {
  // Validate interpretation
  if (!response.interpretation || typeof response.interpretation !== "string") {
    response.interpretation =
      "Analysis generated but no interpretation provided.";
  }

  // Validate statistics existence
  if (!response.statistics || !response.statistics.type) {
    return createErrorResponse(
      "Invalid response structure: missing statistics or chart type",
    );
  }

  // Validate chart type
  if (
    response.statistics.type !== "pie_chart" &&
    response.statistics.type !== "waterfall_chart"
  ) {
    return createErrorResponse(
      `Invalid chart type: ${response.statistics.type}`,
    );
  }

  // Validate chart data existence
  if (!response.statistics.data) {
    return createErrorResponse(
      "Invalid response structure: missing chart data",
    );
  }

  // Validate specific chart type data
  if (response.statistics.type === "pie_chart") {
    return validatePieChartData(response);
  } else if (response.statistics.type === "waterfall_chart") {
    return validateWaterfallChartData(response);
  }

  return response as StatisticsResponse;
}

/**
 * Validate pie chart data
 * @param response - Response with pie chart data
 * @returns Validated response or error response
 */
function validatePieChartData(response: any): StatisticsResponse {
  const data = response.statistics.data;

  // Check for required arrays
  if (
    !data.labels ||
    !data.values ||
    !Array.isArray(data.labels) ||
    !Array.isArray(data.values)
  ) {
    return createPieChartErrorResponse(
      "Invalid pie chart data: labels and values must be arrays",
    );
  }

  // Check array lengths match
  if (data.labels.length !== data.values.length) {
    return createPieChartErrorResponse(
      "Invalid pie chart data: labels and values arrays must have the same length",
    );
  }

  // Check for non-negative values
  if (
    data.values.some((value: any) => typeof value !== "number" || value < 0)
  ) {
    return createPieChartErrorResponse(
      "Invalid pie chart data: values must be non-negative numbers",
    );
  }

  // Validate colors if present
  if (
    data.colors &&
    (!Array.isArray(data.colors) || data.colors.length !== data.labels.length)
  ) {
    delete data.colors; // Remove invalid colors
  }

  return response as StatisticsResponse;
}

/**
 * Validate waterfall chart data
 * @param response - Response with waterfall chart data
 * @returns Validated response or error response
 */
function validateWaterfallChartData(response: any): StatisticsResponse {
  const data = response.statistics.data;

  // Check for required arrays
  if (
    !data.categories ||
    !data.values ||
    !Array.isArray(data.categories) ||
    !Array.isArray(data.values)
  ) {
    return createWaterfallChartErrorResponse(
      "Invalid waterfall chart data: categories and values must be arrays",
    );
  }

  // Check array lengths match
  if (data.categories.length !== data.values.length) {
    return createWaterfallChartErrorResponse(
      "Invalid waterfall chart data: categories and values arrays must have the same length",
    );
  }

  // Check for numeric values
  if (data.values.some((value: any) => typeof value !== "number")) {
    return createWaterfallChartErrorResponse(
      "Invalid waterfall chart data: values must be numbers",
    );
  }

  return response as StatisticsResponse;
}

/**
 * Create a generic error response
 * @param message - The error message
 * @returns Error response
 */
function createErrorResponse(message: string): StatisticsResponse {
  console.error(message);
  return {
    interpretation: message,
    statistics: {
      type: "pie_chart",
      data: {
        labels: ["Error"],
        values: [100],
      },
    },
  };
}

/**
 * Create a pie chart error response
 * @param message - The error message
 * @returns Pie chart error response
 */
function createPieChartErrorResponse(message: string): StatisticsResponse {
  console.error(message);
  return {
    interpretation: message,
    statistics: {
      type: "pie_chart",
      data: {
        labels: ["Error"],
        values: [100],
      },
    },
  };
}

/**
 * Create a waterfall chart error response
 * @param message - The error message
 * @returns Waterfall chart error response
 */
function createWaterfallChartErrorResponse(
  message: string,
): StatisticsResponse {
  console.error(message);
  return {
    interpretation: message,
    statistics: {
      type: "waterfall_chart",
      data: {
        categories: ["Start", "Error", "End"],
        values: [0, 0, 0],
      },
    },
  };
}

/**
 * Main function to analyze a statistical question
 * @param userQuestion - The user's statistical question
 * @param dbSchema - Optional database schema information
 * @returns Analysis and visualization
 */
async function analyzeStatisticalQuestion(
  userQuestion: string,
): Promise<StatisticsResponse> {
  if (
    !userQuestion ||
    typeof userQuestion !== "string" ||
    userQuestion.trim() === ""
  ) {
    return Promise.resolve(
      createErrorResponse(
        "Invalid question: Question must be a non-empty string",
      ),
    );
  }

  let sqlQuery: string;

  // Step 1: Generate an appropriate SQL query
  return generateSqlQuery(userQuestion, dbSchema)
    .then((query: string) => {
      sqlQuery = query;
      console.log("Generated SQL query:", sqlQuery);

      // Step 2: Execute the query
      return makeQuery(sqlQuery);
    })
    .then((queryResults: any[]) => {
      console.log(`Query returned ${queryResults.length} results`);

      // Step 3: Generate analysis and visualization from the results
      return generateAnalysis(queryResults, userQuestion);
    })
    .catch((error: Error) => {
      console.error("Error in statistical analysis:", error);
      return createErrorResponse(`Analysis failed: ${error.message}`);
    });
}

// Export functions and types
export {
  makeQuery,
  generateSqlQuery,
  generateAnalysis,
  analyzeStatisticalQuestion,
  enhancedSystemPrompt as sysPrompt,
  // Export interfaces for external use
  PieChartData,
  WaterfallChartData,
  Statistics,
  StatisticsResponse,
};
