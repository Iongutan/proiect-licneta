"use client";

import { useState, useRef, useEffect } from "react";
import Sidebar from "@/components/ui/Sidebar";
import { useChat } from "@/hooks/use-chat";

export default function ChatPage() {
  const { messages, isLoading, streamingContent, sendMessage, clearMessages } = useChat();
  const [input, setInput] = useState("");
  const [aiConnected, setAiConnected] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const checkConnection = async () => {
    try {
      const res = await fetch("/api/chat");
      const data = await res.json();
      setAiConnected(data.connected === true);
    } catch {
      setAiConnected(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage(text);
    checkConnection();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = [
    "Care sunt comenzile mele active în tranzit?",
    "Estimează economiile pentru comenzi grupate pe traseul Chișinău - Bălți",
    "Găsește camioane disponibile cu agregat frigorific",
    "Explică procesul de semnare contract B2B și facturare",
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar activePath="/chat" />

      <div className="ml-64 flex-1 h-screen flex flex-col bg-white">
        {/* Header */}
        <header className="px-6 py-4 flex items-center justify-between border-b border-slate-200 bg-white">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base text-slate-900">Asistent Inteligent Logistic Qwen3</h1>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 ${
                  aiConnected === true
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : aiConnected === false
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-slate-50 text-slate-600 border-slate-200"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    aiConnected === true ? "bg-emerald-500" : aiConnected === false ? "bg-amber-500" : "bg-slate-400"
                  }`}
                />
                {aiConnected === true ? "Qwen3:14B Local Conectat" : "Ollama 11434 Deconectat"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Model local privat pentru interogări de flotă, coridoare rutiere și tarife Moldova
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={checkConnection}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
            >
              ↻ Verifică Conexiunea
            </button>
            <button
              onClick={clearMessages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Conversație Nouă
            </button>
          </div>
        </header>

        {/* Alertă Deconectare */}
        {aiConnected === false && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
            <div>
              <span className="font-bold">⚠️ Serverul local Ollama nu răspunde pe portul 11434.</span>
              <span className="ml-2 text-amber-700">Pentru a porni asistentul, rulați:</span>
              <code className="ml-1.5 bg-white px-2 py-0.5 rounded border border-amber-300 font-mono font-bold text-slate-900">
                ollama run qwen3:14b
              </code>
            </div>
            <button
              onClick={checkConnection}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs"
            >
              Reîncearcă
            </button>
          </div>
        )}

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4 bg-slate-50">
          {messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 max-w-xl mx-auto text-center my-auto">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-bold text-xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                  AI
                </div>
                <h2 className="text-lg font-bold text-slate-900 mb-1">
                  Asistent OptiFleet pentru Expeditori & Cărăuși
                </h2>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Adresează întrebări despre disponibilitatea vehiculelor, gruparea pe trasee M5/R1 sau verificarea documentelor de transport.
                </p>
              </div>

              {/* Suggestions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(s)}
                    className="p-3 text-left text-xs bg-white border border-slate-200 rounded-lg hover:border-blue-600 hover:text-blue-600 text-slate-700 transition-all shadow-sm"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                  msg.role === "user"
                    ? "bg-slate-800 text-white"
                    : "bg-blue-600 text-white"
                }`}
              >
                {msg.role === "user" ? "TU" : "AI"}
              </div>
              <div
                className={`max-w-2xl px-4 py-2.5 rounded-xl text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white font-medium"
                    : "bg-white border border-slate-200 text-slate-900 shadow-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Streaming response */}
          {streamingContent && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex-shrink-0 flex items-center justify-center text-[10px] font-bold">
                AI
              </div>
              <div className="max-w-2xl px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs shadow-sm">
                {streamingContent}
                <span className="inline-block w-1.5 h-3.5 ml-1 bg-blue-600 animate-pulse" />
              </div>
            </div>
          )}

          {isLoading && !streamingContent && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex-shrink-0 flex items-center justify-center text-[10px] font-bold">
                AI
              </div>
              <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:0.3s]" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="flex gap-2 items-end max-w-4xl mx-auto">
            <textarea
              className="flex-1 resize-none rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              rows={1}
              placeholder="Scrie o întrebare pentru asistentul logistic (Enter pentru trimitere)..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ minHeight: "42px", maxHeight: "120px" }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Trimite
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-2">
            Date sincronizate cu nodurile de transport din Chișinău, Bălți și Cahul
          </p>
        </div>
      </div>
    </div>
  );
}
