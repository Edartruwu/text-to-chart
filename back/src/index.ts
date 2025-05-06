import { Hono } from "hono";
import { cors } from "hono/cors";
import { validator } from "hono/validator";
import { logger } from "hono/logger";
import { analyzeStatisticalQuestion } from "../modules/dataAnal/getStatistic";
import type { Statistics } from "../modules/dataAnal/getStatistic";

interface ChatHistoryEntry {
  role: "user" | "system";
  content: string;
  timestamp: number;
  statistics?: Statistics;
}

interface ChatSession {
  id: string;
  history: ChatHistoryEntry[];
  createdAt: number;
  updatedAt: number;
}

// In-memory storage for chat sessions (in production, use a database)
const chatSessions = new Map<string, ChatSession>();

// Initialize the Hono app
const app = new Hono();

// Add middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*", // In production, you should restrict this
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    maxAge: 86400,
  }),
);

// Validate the request
const requestValidator = validator("json", (value, c) => {
  const body = value as Record<string, unknown>;

  if (
    !body.question ||
    typeof body.question !== "string" ||
    body.question.trim() === ""
  ) {
    return c.json({ success: false, error: "Question is required" }, 400);
  }

  if (body.schema && typeof body.schema !== "string") {
    return c.json({ success: false, error: "Schema must be a string" }, 400);
  }

  return {
    question: body.question as string,
    schema: (body.schema as string) || undefined,
  };
});

// Helper function to generate a session ID
function generateSessionId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

// Create a chat route group
const chatGroup = new Hono();

// Create a new chat session
chatGroup.post("/session", async (c) => {
  const sessionId = generateSessionId();

  const session: ChatSession = {
    id: sessionId,
    history: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  chatSessions.set(sessionId, session);

  return c.json({
    success: true,
    session: {
      id: sessionId,
      createdAt: session.createdAt,
    },
  });
});

// Get chat history for a session
chatGroup.get("/session/:id", async (c) => {
  const sessionId = c.req.param("id");
  const session = chatSessions.get(sessionId);

  if (!session) {
    return c.json({ success: false, error: "Session not found" }, 404);
  }

  return c.json({
    success: true,
    session: {
      id: session.id,
      history: session.history,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    },
  });
});

// Process a message in a chat session
chatGroup.post("/message/:sessionId", requestValidator, async (c) => {
  try {
    const sessionId = c.req.param("sessionId");
    const { question, schema } = c.req.valid("json");

    // Get or create session
    let session = chatSessions.get(sessionId);
    if (!session) {
      return c.json({ success: false, error: "Session not found" }, 404);
    }

    // Add user message to history
    session.history.push({
      role: "user",
      content: question,
      timestamp: Date.now(),
    });

    // Process the question
    console.log(`Processing question in session ${sessionId}: ${question}`);

    const result = await analyzeStatisticalQuestion(question, schema);

    // Add system response to history
    session.history.push({
      role: "system",
      content: result.interpretation,
      timestamp: Date.now(),
      statistics: result.statistics,
    });

    // Update session
    session.updatedAt = Date.now();
    chatSessions.set(sessionId, session);

    return c.json({
      success: true,
      result,
      sessionId,
    });
  } catch (error: any) {
    console.error("Error in chat analysis:", error);

    return c.json(
      {
        success: false,
        error: error.message || "An unknown error occurred",
      },
      500,
    );
  }
});

// Clear chat history
chatGroup.delete("/session/:id", async (c) => {
  const sessionId = c.req.param("id");
  const session = chatSessions.get(sessionId);

  if (!session) {
    return c.json({ success: false, error: "Session not found" }, 404);
  }

  // Clear history but keep the session
  session.history = [];
  session.updatedAt = Date.now();
  chatSessions.set(sessionId, session);

  return c.json({
    success: true,
    message: "Chat history cleared",
  });
});

// Mount the chat group under /api/chat
app.route("/api/chat", chatGroup);

// Main endpoint for analyzing questions (standalone)
app.post("/api/analyze", requestValidator, async (c) => {
  try {
    const { question } = c.req.valid("json");

    console.log(`Processing analysis request: ${question}`);

    const result = await analyzeStatisticalQuestion(question);

    return c.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error("Error in analysis:", error);

    return c.json(
      {
        success: false,
        error: error.message || "An unknown error occurred",
      },
      500,
    );
  }
});

// Health check endpoint
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: Date.now(),
  });
});

// Clean up old sessions periodically (run every hour)
setInterval(
  () => {
    const now = Date.now();
    const MAX_SESSION_AGE = 24 * 60 * 60 * 1000; // 24 hours

    chatSessions.forEach((session, id) => {
      if (now - session.updatedAt > MAX_SESSION_AGE) {
        chatSessions.delete(id);
        console.log(`Deleted inactive session: ${id}`);
      }
    });
  },
  60 * 60 * 1000,
);

// Start the server
const port = process.env.PORT || 3000;
console.log(`Server starting on port ${port}`);

export default app;
