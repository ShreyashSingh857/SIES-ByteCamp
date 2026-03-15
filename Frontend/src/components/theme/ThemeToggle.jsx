import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Moon, Sun } from "lucide-react";

import { toggleTheme } from "../../store/slices/themeSlice";

export default function ThemeToggle() {
    const dispatch = useDispatch();
    const mode = useSelector((state) => state.theme.mode);

    const isDark = mode === "dark";
    const label = isDark ? "Switch to light mode" : "Switch to dark mode";

    return (
        <button
            type="button"
            onClick={() => dispatch(toggleTheme())}
            aria-label={label}
            title={label}
            className="p-2 rounded-md border transition-colors hover:opacity-80"
            style={{
                borderColor: "var(--border)",
                color: "var(--text-muted)",
                background: "transparent",
            }}
        >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
    );
}
