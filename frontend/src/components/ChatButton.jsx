import { useState } from "react";
import ChatBot from "./ChatBot";

export default function ChatButton({ roadmap, currentModule, currentResource }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ChatBot
        roadmap={roadmap}
        currentModule={currentModule}
        currentResource={currentResource}
        isOpen={open}
        onClose={() => setOpen(false)}
      />

      <button
        onClick={() => setOpen((p) => !p)}
        title="Ask AI Tutor"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: open
            ? "linear-gradient(135deg, #991b1b, #7f1d1d)"
            : "linear-gradient(135deg, #dc2626, #991b1b)",
          border: "none",
          color: "#fff",
          fontSize: "22px",
          cursor: "pointer",
          zIndex: 1001,
          boxShadow: "0 4px 20px rgba(220,38,38,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s",
        }}
      >
        {open ? "✕" : "🤖"}
      </button>
    </>
  );
}