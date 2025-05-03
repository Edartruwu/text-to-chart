const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("no database url was found");
}

export const DATABASE_URL: string = databaseUrl;

const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
  throw new Error("no database url was found");
}

export const OPENAI_API_KEY: string = openaiApiKey;
