import React, { useState } from 'react';
import { useGetHelpTopicsQuery, useSearchHelpQuery } from '../store/slices/apiSlice';
import { Search, Info, HelpCircle, Loader2, AlertCircle } from 'lucide-react';

const Help = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const { data: allTopics, isLoading: isLoadingAll, error: errorAll } = useGetHelpTopicsQuery();
  const { data: searchResults, isLoading: isLoadingSearch, error: errorSearch } = useSearchHelpQuery(activeSearch, {
    skip: !activeSearch,
  });

  const handleSearch = (e) => {
    e.preventDefault();
    setActiveSearch(searchTerm);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setActiveSearch('');
  };

  const displayedTopics = activeSearch ? searchResults?.data : allTopics?.data;
  const isLoading = activeSearch ? isLoadingSearch : isLoadingAll;
  const error = activeSearch ? errorSearch : errorAll;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
          <HelpCircle size={24} />
        </div>
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>Help Center</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Find answers to common questions and issues.</p>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search for help topics..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none transition-all"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: '#1e3a8a', color: '#93c5fd' }}
          >
            Search
          </button>
          {activeSearch && (
            <button
              onClick={clearSearch}
              type="button"
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)' }}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      )}

      {error && !isLoading && (
        <div className="card flex items-center gap-3 p-4" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }}>
          <AlertCircle size={20} style={{ color: '#ef4444' }} />
          <p className="text-sm font-medium" style={{ color: '#ef4444' }}>Failed to load help topics.</p>
        </div>
      )}

      {!isLoading && !error && displayedTopics && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            {activeSearch ? `Search Results for "${activeSearch}"` : 'All Topics'}
          </h2>
          {displayedTopics.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No topics found.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {displayedTopics.map((topic) => (
                <div key={topic.id} className="card hover:border-blue-500 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <Info size={16} style={{ color: '#3b82f6' }} />
                    <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{topic.title}</h3>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{topic.content}</p>
                  <div className="mt-3">
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
                      {topic.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Help;
