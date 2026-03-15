import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { createChatSession, sendChatMessage } from "../../services/api";
import FileMentionSuggestion from "./FileMentionSuggestion";

const quickActions = [
  { label: "List all files", prompt: "List all files in this repository" },
  { label: "High-risk files", prompt: "Which files have the most reverse dependencies (highest risk)?" },
  { label: "Entry points", prompt: "What are the entry point files of this repository?" },
  { label: "Circular deps?", prompt: "Are there any circular dependencies in this codebase?" },
];

export default function DependencyChatPanel({ repoId, scanId, onClose = null }) {
  const [sessionId, setSessionId] = useState(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  const disabled = useMemo(() => !repoId, [repoId]);

  useEffect(() => {
    let active = true;
    async function initSession() {
      if (!repoId) return;
      try {
        setError("");
        const payload = await createChatSession(repoId, scanId);
        const id = payload?.data?.id || null;
        if (active) setSessionId(id);
      } catch (err) {
        if (active) setError(err?.response?.data?.message || "Failed to initialize chat session.");
      }
    }
    initSession();
    return () => { active = false; };
  }, [repoId, scanId]);

  const send = async (text) => {
    if (!sessionId || !String(text || "").trim() || isSending) return;
    const userText = String(text).trim();
    setIsSending(true);
    setError("");
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setInput("");

    try {
      const payload = await sendChatMessage(sessionId, userText, repoId, scanId);
      const data = payload?.data || {};
      setMessages((prev) => [...prev, { role: "assistant", content: data?.assistantMessage?.content || "No response.", meta: data?.meta || null }]);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="rounded-xl border p-3" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Dependency Chat</div>
        {onClose && (
          <button
            type="button"
            className="rounded-md p-1"
            onClick={onClose}
            aria-label="Close chat"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        {quickActions.map((action) => (
          <button
            key={action.label}
            type="button"
            className="rounded-full px-2.5 py-1 text-xs"
            style={{ background: "rgba(59,130,246,0.12)", color: "#2563eb" }}
            onClick={() => send(action.prompt)}
            disabled={disabled || !sessionId || isSending}
          >
            {action.label}
          </button>
        ))}
      </div>

      <div className="mb-3 max-h-56 overflow-auto rounded-lg border p-2" style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--text)" }}>
        {messages.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>Ask about file dependencies and impact.</p>}
        {messages.map((msg, idx) => (
          <div key={`${msg.role}-${idx}`} className="mb-2">
            <div className="text-xs font-semibold" style={{ color: msg.role === "user" ? "#0ea5e9" : "#10b981" }}>{msg.role}</div>
            <div className="text-sm whitespace-pre-wrap" style={{ color: "var(--text)" }}>{msg.content}</div>
            {msg.role === "assistant" && msg.meta?.fileContextFound && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs" style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6" }}>
                Graph context: {msg.meta.detectedFile} ({msg.meta.graphNodes} nodes · {msg.meta.graphEdges} edges)
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="relative">
        <FileMentionSuggestion inputValue={input} onSelect={(name) => setInput(name)} />
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
            placeholder={disabled ? "Scan/select a repo to enable chat" : "Ask: what imports auth.service.js?"}
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--text)" }}
            disabled={disabled || !sessionId || isSending}
          />
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm"
            style={{ background: "#2563eb", color: "#fff" }}
            onClick={() => send(input)}
            disabled={disabled || !sessionId || isSending}
          >
            Send
          </button>
        </div>
      </div>

      {error && <div className="mt-2 text-xs text-red-500">{error}</div>}
    </div>
  );
}
