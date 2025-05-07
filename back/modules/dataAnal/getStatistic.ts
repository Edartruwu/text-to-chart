import openAiClient from "../openai/client";
import pool from "../db/pool";
import { dbSchema, enhancedSystemPrompt } from "./prompts";

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

  try {
    // Validate specific chart type data
    if (response.statistics.type === "pie_chart") {
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

      // Filter out any non-numeric values
      const validIndices = data.values
        .map((val: any, idx: number) => (!isNaN(Number(val)) ? idx : null))
        .filter((idx: number | null) => idx !== null);

      if (validIndices.length === 0) {
        return createPieChartErrorResponse(
          "Invalid pie chart data: no valid numeric values",
        );
      }

      // Keep only valid pairs
      data.labels = validIndices.map((idx: number) => data.labels[idx]);
      data.values = validIndices.map((idx: number) => Number(data.values[idx]));

      // Add default colors if not provided
      if (!data.colors) {
        data.colors = data.labels.map((_: any, i: any) => {
          const defaultColors = [
            "#4299E1", // blue
            "#48BB78", // green
            "#F56565", // red
            "#ED8936", // orange
            "#9F7AEA", // purple
            "#38B2AC", // teal
            "#F687B3", // pink
            "#ECC94B", // yellow
          ];
          return defaultColors[i % defaultColors.length];
        });
      }
    } else if (response.statistics.type === "waterfall_chart") {
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

      // Filter out any non-numeric values (except for the first value which can be 0)
      const validIndices = data.values
        .map((val: any, idx: number) => (!isNaN(Number(val)) ? idx : null))
        .filter((idx: number | null) => idx !== null);

      if (validIndices.length < 2) {
        return createWaterfallChartErrorResponse(
          "Invalid waterfall chart data: need at least 2 valid numeric values",
        );
      }

      // Keep only valid pairs
      data.categories = validIndices.map(
        (idx: number) => data.categories[idx] || `Item ${idx}`,
      );
      data.values = validIndices.map((idx: number) => Number(data.values[idx]));

      // Ensure we have proper start/end labels if this is a typical waterfall chart
      if (data.categories.length >= 2) {
        // If first value is 0, it's likely a "Start"
        if (
          data.values[0] === 0 &&
          !data.categories[0].toLowerCase().includes("start")
        ) {
          data.categories[0] = "Start";
        }

        // If last item doesn't indicate it's an end/total, rename it
        const lastIdx = data.categories.length - 1;
        if (
          !data.categories[lastIdx].toLowerCase().includes("end") &&
          !data.categories[lastIdx].toLowerCase().includes("total")
        ) {
          data.categories[lastIdx] = "End";
        }
      }

      // Add default label texts if not provided
      if (!data.increaseLabelText) data.increaseLabelText = "Increase";
      if (!data.decreaseLabelText) data.decreaseLabelText = "Decrease";
      if (!data.totalLabelText) data.totalLabelText = "Total";
    }
  } catch (error) {
    console.error("Error during validation:", error);
    return createErrorResponse(
      `Validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  return response as StatisticsResponse;
}
// Simplified pie chart schema without optional properties
const simplePieChartSchema = {
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
          enum: ["pie_chart"],
          description: "Pie chart visualization",
        },
        data: {
          type: "object",
          required: ["labels", "values"],
          additionalProperties: false,
          properties: {
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
          },
        },
      },
    },
  },
};

// Simplified waterfall chart schema without optional properties
const simpleWaterfallChartSchema = {
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
          enum: ["waterfall_chart"],
          description: "Waterfall chart visualization",
        },
        data: {
          type: "object",
          required: ["categories", "values"],
          additionalProperties: false,
          properties: {
            categories: {
              type: "array",
              items: { type: "string" },
              description: "Category labels for the waterfall chart",
            },
            values: {
              type: "array",
              items: { type: "number" },
              description: "Numeric values for each category",
            },
          },
        },
      },
    },
  },
};

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
async function generateAnalysis(
  data: any[],
  originalQuestion: string,
): Promise<StatisticsResponse> {
  // Handle empty data case
  if (!data || data.length === 0) {
    return {
      interpretation: "No data available for analysis.",
      statistics: {
        type: "pie_chart",
        data: {
          labels: ["No Data"],
          values: [100],
        },
      },
    };
  }

  // Serialize data for the OpenAI prompt
  const serializedData = JSON.stringify(data);

  // First, determine which chart type would be most appropriate
  const chartTypeResponse = await openai.responses.create({
    model: "o4-mini-2025-04-16",
    input: [
      { role: "system", content: enhancedSystemPrompt },
      {
        role: "user",
        content: `
        Analyze these query results and determine which chart type would be most appropriate: pie_chart or waterfall_chart.
        Only respond with the chart type name, nothing else.
        
        Original question: ${originalQuestion}
        
        Query results: ${serializedData}
        `,
      },
    ],
    reasoning: { effort: "high" },
  });

  const chartType = chartTypeResponse.output_text.trim().toLowerCase();

  // Select the appropriate schema based on the determined chart type
  const schema =
    chartType === "waterfall_chart"
      ? simpleWaterfallChartSchema
      : simplePieChartSchema;

  let maxRetries = 3;
  let currentRetry = 0;
  let validResponse: StatisticsResponse | null = null;

  // Do-while loop to retry with increasingly structured approaches
  do {
    try {
      let prompt = "";

      if (currentRetry === 0) {
        // First attempt - standard approach with clear instructions
        prompt = `
          Analyze these query results and generate a ${chartType} visualization.
          
          Original question: ${originalQuestion}
          
          Query results: ${serializedData}
          
          IMPORTANT REQUIREMENTS:
          1. For waterfall charts, the "categories" and "values" arrays MUST have exactly the same length.
          2. For pie charts, the "labels" and "values" arrays MUST have exactly the same length.
          3. Make sure all values in the "values" array are valid numbers.
          
          Example ${chartType} format:
          ${
            chartType === "waterfall_chart"
              ? `{
              "interpretation": "Analysis of the data...",
              "statistics": {
                "type": "waterfall_chart",
                "data": {
                  "categories": ["Start", "Revenue", "Expenses", "Taxes", "End"],
                  "values": [0, 500, -300, -50, 150]
                }
              }
            }`
              : `{
              "interpretation": "Analysis of the data...",
              "statistics": {
                "type": "pie_chart",
                "data": {
                  "labels": ["Category A", "Category B", "Category C"],
                  "values": [30, 45, 25]
                }
              }
            }`
          }
        `;
      } else if (currentRetry === 1) {
        // Second attempt - more structured approach with explicit data mapping
        prompt = `
          Create a ${chartType} visualization from the following data.
          
          Original question: ${originalQuestion}
          
          Query results: ${serializedData}
          
          FOLLOW THESE EXACT STEPS:
          1. Identify the key categories/dimensions in the data
          2. Calculate the corresponding values for each category
          3. Ensure the number of categories EXACTLY MATCHES the number of values
          4. Format the result according to the example below
          
          Example ${chartType} format:
          ${
            chartType === "waterfall_chart"
              ? `{
              "interpretation": "Brief analysis of what the data shows",
              "statistics": {
                "type": "waterfall_chart",
                "data": {
                  "categories": ["Start", "Revenue", "Expenses", "Taxes", "End"],
                  "values": [0, 500, -300, -50, 150]
                }
              }
            }`
              : `{
              "interpretation": "Brief analysis of what the data shows",
              "statistics": {
                "type": "pie_chart",
                "data": {
                  "labels": ["Category A", "Category B", "Category C"],
                  "values": [30, 45, 25]
                }
              }
            }`
          }
          
          DOUBLE-CHECK that the number of items in categories/labels matches the number of items in values.
        `;
      } else {
        // Final attempt - extremely constrained approach with direct data extraction
        if (chartType === "waterfall_chart") {
          // For waterfall chart, create a simple start-to-end structure
          prompt = `
            Create a waterfall chart with exactly 3 data points: Start, Change, and End.
            
            Original question: ${originalQuestion}
            
            Query results: ${serializedData}
            
            FOLLOW THESE EXACT STEPS:
            1. Set the Start value to 0
            2. Calculate a single Change value that represents the main insight from the data
            3. Calculate the End value as Start + Change
            4. Format as shown in the example
            
            Example format:
            {
              "interpretation": "Brief analysis of the overall change",
              "statistics": {
                "type": "waterfall_chart",
                "data": {
                  "categories": ["Start", "Change", "End"],
                  "values": [0, 100, 100]
                }
              }
            }
          `;
        } else {
          // For pie chart, limit to top 3 categories
          prompt = `
            Create a pie chart with exactly 3 data points representing the most important categories.
            
            Original question: ${originalQuestion}
            
            Query results: ${serializedData}
            
            FOLLOW THESE EXACT STEPS:
            1. Identify the 3 most important categories in the data
            2. Calculate the corresponding values for each category
            3. Format as shown in the example
            
            Example format:
            {
              "interpretation": "Brief analysis focusing on the top 3 categories",
              "statistics": {
                "type": "pie_chart",
                "data": {
                  "labels": ["Category A", "Category B", "Category C"],
                  "values": [50, 30, 20]
                }
              }
            }
          `;
        }
      }

      // Generate the analysis with the current prompt
      const response = await openai.responses.create({
        model: "o4-mini-2025-04-16",
        input: [
          { role: "system", content: enhancedSystemPrompt },
          { role: "user", content: prompt },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "StatisticsResponse",
            schema: schema,
            description: "Statistical analysis with visualization data",
            strict: true,
          },
        },
        reasoning: { effort: "high" },
      });

      // Parse the response
      const content = response.output_text;
      let parsedResponse;

      try {
        parsedResponse = JSON.parse(content);
      } catch {
        parsedResponse = content;
      }

      // Validate the response
      const validatedResponse = validateResponse(parsedResponse);

      // Check if validation succeeded (no error message in interpretation)
      if (
        !validatedResponse.interpretation.includes("Invalid") &&
        !validatedResponse.interpretation.includes("Error")
      ) {
        validResponse = validatedResponse;
        break;
      }

      // If we're here, validation failed - increment retry counter
      currentRetry++;
    } catch (error) {
      console.error(`Error in attempt ${currentRetry}:`, error);
      currentRetry++;
    }
  } while (currentRetry < maxRetries && !validResponse);

  // If we still don't have a valid response, create a simple valid one
  if (!validResponse) {
    if (chartType === "waterfall_chart") {
      return {
        interpretation:
          "Unable to generate a detailed analysis, but here's a simple overview of the data.",
        statistics: {
          type: "waterfall_chart",
          data: {
            categories: ["Start", "Change", "End"],
            values: [0, data.length, data.length],
          },
        },
      };
    } else {
      return {
        interpretation:
          "Unable to generate a detailed analysis, but here's a simple overview of the data.",
        statistics: {
          type: "pie_chart",
          data: {
            labels: ["Data Points"],
            values: [data.length],
          },
        },
      };
    }
  }

  return validResponse;
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
  // Export interfaces for external use
  PieChartData,
  WaterfallChartData,
  Statistics,
  StatisticsResponse,
};
