"use client";
import { useState, useCallback } from "react";
import { ChatMessage } from "@/lib/api-client";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: ChatMessage = { role: "user", content };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setIsLoading(true);
      setStreamingContent("");

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.content },
          ]);
        } else {
          throw new Error("Eroare de răspuns");
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "⚠️ LIPSĂ DE CONEXIUNE LA QWEN3 LOCAL (Ollama:11434)\n\nServiciul local Ollama nu este pornit sau nu răspunde. Vă rugăm să porniți modelul rulând în terminal / PowerShell:\n\nollama run qwen3:14b",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamingContent("");
  }, []);

  return { messages, isLoading, streamingContent, sendMessage, clearMessages };
}
