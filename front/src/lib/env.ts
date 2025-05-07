const backUrl = process.env.BACKEND_URL;

if (!backUrl) {
  throw new Error("no back url was set");
}

export const BACKEND_URL = backUrl;
