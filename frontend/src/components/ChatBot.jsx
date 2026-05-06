import { useState, useRef, useEffect } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function ChatBot({ roadmap, currentModule, currentResource, isOpen, onClose }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      // Changed to use roadmap?.goal for the greeting
      content: `Hi! I'm your Roadmapify AI tutor 🤖\n\nI can see you're working on: **${roadmap?.goal || "your roadmap"}**${currentModule ? `\n\nCurrently on: **${currentModule.title}**` : ""}\n\nAsk me anything — I'll explain concepts, break down confusing topics, or give you examples specific to what you're learning right now.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (currentModule) {
      setMessages((prev) => [
        prev[0],
        {
          role: "assistant",
          content: `📍 You've moved to: **${currentModule.title}**\n\n${currentModule.description || ""}\n\nWhat would you like help with in this module?`,
        },
      ]);
    }
  }, [currentModule?.id]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.content,
          roadmap: roadmap || {},
          current_module: currentModule || null,
          current_resource: currentResource || null,
          history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't connect to the AI right now. Please try again in a moment." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatMessage = (content) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.1);padding:1px 4px;border-radius:3px;font-family:monospace">$1</code>')
      .replace(/\n/g, "<br/>");
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "90px",
        right: "24px",
        width: "380px",
        maxHeight: "560px",
        background: "#111111",
        border: "1px solid rgba(220,38,38,0.3)",
        borderRadius: "16px",
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
        boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          background: "linear-gradient(135deg, #1a0000, #2d0a0a)",
          borderBottom: "1px solid rgba(220,38,38,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #dc2626, #991b1b)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
            }}
          >
            🤖
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 600, fontSize: "14px" }}>AI Tutor</div>
            {currentModule && (
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px" }}>
                {currentModule.title}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.5)",
            cursor: "pointer",
            fontSize: "18px",
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {currentResource && (
        <div
          style={{
            padding: "8px 16px",
            background: "rgba(220,38,38,0.08)",
            borderBottom: "1px solid rgba(220,38,38,0.1)",
            fontSize: "11px",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          📖 Helping with: <span style={{ color: "#dc2626" }}>{currentResource.title}</span>
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          scrollbarWidth: "none",
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "85%",
                padding: "10px 14px",
                borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background:
                  msg.role === "user"
                    ? "linear-gradient(135deg, #dc2626, #991b1b)"
                    : "rgba(255,255,255,0.06)",
                color: "#fff",
                fontSize: "13px",
                lineHeight: "1.5",
                border: msg.role === "assistant" ? "1px solid rgba(255,255,255,0.08)" : "none",
              }}
              dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
            />
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: "10px 16px",
                background: "rgba(255,255,255,0.06)",
                borderRadius: "16px 16px 16px 4px",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                {[0, 1, 2].map((j) => (
                  <div
                    key={j}
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "#dc2626",
                      animation: "pulse 1.4s ease-in-out infinite",
                      animationDelay: `${j * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          gap: "8px",
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask me anything about this module..."
          rows={1}
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "10px",
            color: "#fff",
            padding: "10px 12px",
            fontSize: "13px",
            outline: "none",
            resize: "none",
            fontFamily: "inherit",
            lineHeight: "1.4",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            background: loading || !input.trim() ? "rgba(220,38,38,0.3)" : "#dc2626",
            border: "none",
            borderRadius: "10px",
            color: "#fff",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            padding: "0 14px",
            fontSize: "16px",
            transition: "background 0.2s",
          }}
        >
          ↑
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}