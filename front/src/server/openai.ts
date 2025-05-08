"use server";

import type { OCRResponse } from "@mistralai/mistralai/models/components";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define the interface for the extracted invoice data
export interface ExtractedInvoiceData {
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  customer_id?: number;
  customer_name?: string;
  subtotal: number;
  discount?: number;
  tax?: number;
  shipping?: number;
  total: number;
  payment_terms?: string;
  payment_method?: string;
  bank_details?: {
    bank?: string;
    iban?: string;
    swift?: string;
    account_number?: string;
    routing_number?: string;
  };
  notes?: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
  }>;
}

/**
 * Extracts invoice data from OCR text using OpenAI
 */
export async function extractInvoiceData(
  text: OCRResponse,
): Promise<ExtractedInvoiceData> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an invoice data extraction expert. Extract structured data from OCR text of invoice PDFs.
          Return ONLY a JSON object with no additional text. Be as accurate as possible with the data extraction.
          If you're uncertain about a value, use null or omit the field rather than guessing.
          For dates, use ISO format (YYYY-MM-DD).
          For currency values, extract numeric values only without currency symbols.
          For items, try to identify individual line items with descriptions, quantities, and unit prices.


remember to follow strictly this schema:
{
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  customer_id?: number;
  customer_name?: string;
  subtotal: number;
  discount?: number;
  tax?: number;
  shipping?: number;
  total: number;
  payment_terms?: string;
  payment_method?: string;
  bank_details?: {
    bank?: string;
    iban?: string;
    swift?: string;
    account_number?: string;
    routing_number?: string;
  };
  notes?: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
  }>;
}

`,
        },
        {
          role: "user",
          content: `Extract invoice data from this OCR text and return the valid json: ${JSON.stringify(text)}




`,
        },
      ],
    });

    const jsonResult = response.choices[0].message.content;

    if (!jsonResult) {
      throw new Error("Failed to extract invoice data");
    }

    const extractedData = JSON.parse(jsonResult) as ExtractedInvoiceData;

    // Ensure items array exists
    if (!extractedData.items || !Array.isArray(extractedData.items)) {
      extractedData.items = [];
    }

    // Ensure at least one item exists
    if (extractedData.items.length === 0) {
      extractedData.items.push({
        description: "",
        quantity: 1,
        unit_price: 0,
      });
    }

    return extractedData;
  } catch (error) {
    console.error("Error extracting invoice data:", error);
    // Return a default structure if extraction fails
    return {
      invoice_number: "",
      invoice_date: new Date().toISOString().split("T")[0],
      subtotal: 0,
      total: 0,
      items: [{ description: "", quantity: 1, unit_price: 0 }],
    };
  }
}
