"use server";
import { OCRResponse } from "@mistralai/mistralai/models/components";

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function getCompletition(text: OCRResponse) {
  const res = client.responses.create({
    model: "gpt-4o",
    input: `${text}`,
  });
}
