"use client";
import { Mistral } from "@mistralai/mistralai";
import { OCRResponse } from "@mistralai/mistralai/models/components";

const apiKey = "hJCbCqjYXksmXnMaQyUXG7ldEJTzoWu1";

if (!apiKey) {
  throw new Error("no mistral api key found");
}

/**
 * Encodes a File object to Base64
 * @param file The File object to encode
 * @returns A Promise that resolves to the Base64-encoded string
 */
async function encodeFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      // The result is a DataURL like "data:application/pdf;base64,XXXXXXX"
      const base64String = reader.result as string;
      // Extract just the Base64 part after the comma
      const base64Content = base64String.split(",")[1];
      resolve(base64Content);
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Processes a PDF file with Mistral OCR
 * @param file The PDF File object
 * @param apiKey Your Mistral API key
 * @returns Promise with the OCR response
 */
export async function processPdfWithOcr(file: File): Promise<OCRResponse> {
  try {
    const base64Pdf = await encodeFileToBase64(file);
    const client = new Mistral({ apiKey });

    const ocrResponse = await client.ocr.process({
      model: "mistral-ocr-latest",
      document: {
        type: "document_url",
        documentUrl: `data:application/pdf;base64,${base64Pdf}`,
      },
      includeImageBase64: false,
    });

    console.log(ocrResponse, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

    return ocrResponse;
  } catch (error) {
    console.error("Error processing OCR:", error);
    throw error;
  }
}
