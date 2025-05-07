"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
import apiService from "./api";
import ChatMessage from "./chatMessage";
import type { ChatMessage as ChatMessageType } from "./types";
import { Send } from "lucide-react";

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history on mount
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const history = await apiService.getChatHistory();
        setMessages(history);
      } catch (error) {
        console.error("Failed to load chat history:", error);
      }
    };

    loadChatHistory();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea height
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    // Add user message to chat
    const userMessage: ChatMessageType = {
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Send message to API
      const response = await apiService.sendMessage(userMessage.content);

      if (response.success && response.result) {
        // Add system response to chat
        const systemMessage: ChatMessageType = {
          role: "system",
          content: response.result.interpretation,
          timestamp: Date.now(),
          statistics: response.result.statistics,
        };

        setMessages((prev) => [...prev, systemMessage]);
      } else {
        // Handle error
        const errorMessage: ChatMessageType = {
          role: "system",
          content:
            response.error ||
            "An error occurred while processing your request.",
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error("Error sending message:", error);

      // Show error message
      const errorMessage: ChatMessageType = {
        role: "system",
        content: "Failed to send message. Please try again.",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = async () => {
    try {
      await apiService.clearChatHistory();
      setMessages([]);
    } catch (error) {
      console.error("Failed to clear chat:", error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex justify-between items-center p-4 border-b">
        <h1 className="text-xl font-semibold">Data Analysis Chat</h1>
        <button
          onClick={clearChat}
          className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
        >
          Clear Chat
        </button>
      </div>

      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-500">
            <p>Ask a question about your data to get started!</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t p-4">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your data..."
              className="w-full p-3 pr-10 border rounded-lg resize-none min-h-[50px] max-h-[150px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={1}
              disabled={isLoading}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className={`p-3 rounded-lg ${
              !input.trim() || isLoading
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600 text-white"
            } transition-colors`}
          >
            <Send size={20} />
          </button>
        </div>
        {isLoading && (
          <div className="mt-2 text-sm text-gray-500">
            Processing your question...
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
