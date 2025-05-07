"use client";

import type React from "react";
import type { ChatMessage as ChatMessageType } from "./types";
import ChartRenderer from "./chartRenderer";

interface ChatMessageProps {
  message: ChatMessageType;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] p-4 rounded-lg ${
          isUser
            ? "bg-blue-500 text-white rounded-tr-none"
            : "bg-gray-100 text-gray-800 rounded-tl-none"
        }`}
      >
        <div className="mb-1 text-sm">{isUser ? "You" : "Assistant"}</div>
        <div className="whitespace-pre-wrap">{message.content}</div>

        {/* Render chart if statistics exist */}
        {!isUser && message.statistics && (
          <div className="mt-4">
            <ChartRenderer statistics={message.statistics} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
