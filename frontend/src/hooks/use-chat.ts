"use client";
import { useState, useCallback, useEffect } from "react";
import { ChatMessage } from "@/lib/api-client";

const CHAT_STORAGE_KEY = "optifleet_ai_chat_session";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);

  // Restaurare istoric conversație din localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch (e) {
      console.error("Eroare la citire istoric chat din localStorage:", e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Salvare istoric conversație în localStorage la fiecare actualizare
  useEffect(() => {
    if (!isInitialized) return;
    try {
      if (messages.length > 0) {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
      } else {
        localStorage.removeItem(CHAT_STORAGE_KEY);
      }
    } catch (e) {
      console.error("Eroare la salvare istoric chat în localStorage:", e);
    }
  }, [messages, isInitialized]);

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
    try {
      localStorage.removeItem(CHAT_STORAGE_KEY);
    } catch {}
  }, []);

  return { messages, isLoading, streamingContent, sendMessage, clearMessages };
}
