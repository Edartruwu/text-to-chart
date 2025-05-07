import {
  ChatMessage,
  StatisticsResponse,
  ApiResponse,
  SessionResponse,
} from "./types";

const API_BASE_URL = "http://localhost:3000/api";

class ApiService {
  private sessionId: string | null = null;

  /**
   * Create a new chat session
   */
  async createSession(): Promise<string> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = (await response.json()) as SessionResponse;

      if (!data.success) {
        throw new Error(data.error || "Failed to create session");
      }

      this.sessionId = data.session.id;
      return this.sessionId;
    } catch (error) {
      console.error("Error creating session:", error);
      throw error;
    }
  }

  /**
   * Get the current session ID or create a new one
   */
  async getSessionId(): Promise<string> {
    if (!this.sessionId) {
      return this.createSession();
    }
    return this.sessionId;
  }

  /**
   * Get chat history for the current session
   */
  async getChatHistory(): Promise<ChatMessage[]> {
    try {
      const sessionId = await this.getSessionId();
      const response = await fetch(`${API_BASE_URL}/chat/session/${sessionId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to get chat history");
      }

      return data.session.history;
    } catch (error) {
      console.error("Error getting chat history:", error);
      throw error;
    }
  }

  /**
   * Send a message to the chat API
   */
  async sendMessage(
    question: string,
  ): Promise<ApiResponse<StatisticsResponse>> {
    try {
      const sessionId = await this.getSessionId();
      const response = await fetch(
        `${API_BASE_URL}/chat/message/${sessionId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ question }),
        },
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  /**
   * Directly analyze a question without using a session
   */
  async analyzeQuestion(
    question: string,
  ): Promise<ApiResponse<StatisticsResponse>> {
    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error analyzing question:", error);
      throw error;
    }
  }

  /**
   * Clear the current chat session
   */
  async clearChatHistory(): Promise<void> {
    try {
      if (!this.sessionId) return;

      const response = await fetch(
        `${API_BASE_URL}/chat/session/${this.sessionId}`,
        {
          method: "DELETE",
        },
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to clear chat history");
      }
    } catch (error) {
      console.error("Error clearing chat history:", error);
      throw error;
    }
  }
}

// Create singleton instance
const apiService = new ApiService();
export default apiService;
