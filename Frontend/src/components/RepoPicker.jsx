import React, { useMemo, useState } from 'react';
import { Github, Loader2, Search, Star, X } from 'lucide-react';
import { useGetMyReposQuery } from '../store/slices/apiSlice';

export default function RepoPicker({ open, onClose, onSelect }) {
  const [q, setQ] = useState('');
  const { data = [], isLoading, isError } = useGetMyReposQuery(undefined, { skip: !open });

  const repos = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data;
    return data.filter((r) => (r.full_name || r.name || '').toLowerCase().includes(s));
  }, [data, q]);

  if (!open) return null;

  const pick = (repo) => {
    onSelect?.({
      url: repo.clone_url,
      branch: repo.default_branch || 'main',
      name: repo.name,
    });
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40 p-4" onClick={onClose}>
      <div className="mx-auto mt-10 w-full max-w-3xl rounded-xl border border-(--border) bg-(--card)" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-(--border) p-4">
          <h3 className="font-semibold text-(--text)">Browse My Repos</h3>
          <button type="button" onClick={onClose} className="p-1 text-(--text-muted)"><X size={16} /></button>
        </div>

        <div className="border-b border-(--border) p-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--text-muted)" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search repositories" className="w-full rounded-lg border border-(--border) bg-(--bg) py-2 pl-9 pr-3 text-sm text-(--text) outline-none" />
          </div>
        </div>

        <div className="max-h-[58vh] overflow-auto">
          {isLoading && <div className="flex items-center gap-2 p-6 text-sm text-(--text-muted)"><Loader2 className="animate-spin" size={14} /> Loading repositories...</div>}
          {isError && <div className="p-6 text-sm text-red-600">Failed to load repositories.</div>}
          {!isLoading && !isError && repos.length === 0 && <div className="p-6 text-sm text-(--text-muted)">No repositories found.</div>}
          {!isLoading && !isError && repos.map((repo) => (
            <button key={repo.id} type="button" onClick={() => pick(repo)} className="w-full border-b border-(--border) p-4 text-left hover:bg-(--bg)">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-medium text-(--text)"><Github size={14} /> {repo.full_name || repo.name}</div>
                  <div className="mt-1 text-xs text-(--text-muted)">{repo.language || 'Unknown'} • {repo.private ? 'Private' : 'Public'} • {new Date(repo.updated_at).toLocaleDateString()}</div>
                </div>
                <div className="inline-flex items-center gap-1 text-xs text-(--text-muted)"><Star size={12} /> {repo.stargazers_count ?? 0}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
