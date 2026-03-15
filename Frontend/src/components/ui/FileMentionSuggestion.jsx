import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

export default function FileMentionSuggestion({ inputValue, onSelect }) {
  const graphNodes = useSelector((state) => state.graph?.nodes || state.graph?.graphData?.nodes || []);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    const extMatch = inputValue.match(/(\S{3,}\.(js|ts|jsx|tsx|py|java|go|rb|cs))\S*$/i);
    const keywordMatch = inputValue.match(/(?:file|module|component)\s+(\S{3,})$/i);
    const match = extMatch || keywordMatch;

    if (!match) {
      setSuggestions([]);
      return;
    }

    const query = String(match[1] || "").toLowerCase();
    const fileNodes = graphNodes.filter((n) => n?.type === "FILE");
    const next = fileNodes
      .filter((n) => String(n?.name || "").toLowerCase().includes(query))
      .slice(0, 5)
      .map((n) => n.name)
      .filter(Boolean);

    setSuggestions(next);
  }, [inputValue, graphNodes]);

  if (suggestions.length === 0) return null;

  return (
    <div
      className="absolute bottom-full left-0 z-10 mb-1 w-full max-w-md rounded border shadow-lg"
      style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
    >
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          className="block w-full truncate px-3 py-2 text-left font-mono text-sm"
          style={{ color: "var(--text)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-muted)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          onClick={() => onSelect(suggestion)}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
