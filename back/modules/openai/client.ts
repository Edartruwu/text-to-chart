import OpenAI from "openai";
import { OPENAI_API_KEY } from "../env";

const openAiClient = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

export default openAiClient;
