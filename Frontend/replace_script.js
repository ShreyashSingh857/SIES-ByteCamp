const fs = require('fs');
let content = fs.readFileSync('src/pages/GraphView.jsx', 'utf8');

// 1. the gridStyle definition
const oldGridStyle = \const gridStyle = useMemo(() => {
    const z = Math.max(0.2, Math.min(3, viewportZoom));
    const major = Math.max(36, Math.round(80 * z));
    const minor = Math.max(10, Math.round(20 * z));
    const majorAlpha = Math.min(0.22, 0.08 + z * 0.03);
    const minorAlpha = Math.min(0.12, 0.04 + z * 0.02);
    // Use slate-200 equivalent (226, 232, 240) for a subtle grid pattern on the background.
    const gridRgb = '226,232,240';

    return {
      backgroundColor: 'var(--bg)',
      backgroundImage:
        \\\linear-gradient(rgba(\\\,\\\) 1px, transparent 1px), \\\ +
        \\\linear-gradient(90deg, rgba(\\\,\\\) 1px, transparent 1px), \\\ +
        \\\linear-gradient(rgba(\\\,\\\) 1px, transparent 1px), \\\ +
        \\\linear-gradient(90deg, rgba(\\\,\\\) 1px, transparent 1px)\\\,
      backgroundSize: \\\\\\px \\\px, \\\px \\\px, \\\px \\\px, \\\px \\\px\\\,
      border: '1px solid var(--border)',
      minHeight: 0,
    };
  }, [viewportZoom, themeMode]);\;

const newGridStyle = \const gridStyle = useMemo(() => {
    const z = Math.max(0.2, Math.min(3, viewportZoom));
    const major = Math.max(40, Math.round(80 * z));
    const minor = Math.max(10, Math.round(20 * z));
    const majorAlpha = Math.min(0.8, 0.8 + z * 0.03);
    const minorAlpha = Math.min(0.6, 0.6 + z * 0.02);
    const gridRgb = '226,232,240'; // slate-200

    return {
      backgroundColor: '#f8fafc', // slate-50 background for enterprise contrast
      backgroundImage:
        \\\linear-gradient(rgba(\\\,\\\) 1px, transparent 1px), \\\ +
        \\\linear-gradient(90deg, rgba(\\\,\\\) 1px, transparent 1px), \\\ +
        \\\linear-gradient(rgba(\\\,\\\) 1px, transparent 1px), \\\ +
        \\\linear-gradient(90deg, rgba(\\\,\\\) 1px, transparent 1px)\\\,
      backgroundSize: \\\\\\px \\\px, \\\px \\\px, \\\px \\\px, \\\px \\\px\\\,
      border: '1px solid #e2e8f0', // slate-200
      minHeight: 0,
    };
  }, [viewportZoom, themeMode]);\;

content = content.replace(oldGridStyle, newGridStyle);

content = content.replace(/className="flex flex-col gap-3" style=\{\{ height: 'calc\\(100vh - 7rem\\)' \}\}/, 'className="flex flex-col gap-3 relative" style={{ height: \\'calc(100vh - 7rem)\\' }}');

// 2. Toolbar
const toolbarRegex = /\{\/\* Toolbar \*\/\}[\\s\\S]*?\{\/\* Filter panel \*\/\}/;

const newToolbar = \{/* Toolbar Enterprise Redesign */}
      <div className="flex items-center gap-4 flex-wrap bg-white p-2 rounded-lg border border-slate-200 shadow-sm z-10 mx-2 mt-2 absolute top-0 left-0 right-0">
        
        {/* Group 1: Zoom/Refresh */}
        <div className="flex items-center gap-1 border-r border-slate-200 pr-4">
          <button onClick={handleZoomIn} className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent transition-colors" title="Zoom in"><ZoomIn size={16} /></button>
          <button onClick={handleZoomOut} className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent transition-colors" title="Zoom out"><ZoomOut size={16} /></button>
          <button onClick={handleFit} className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent transition-colors" title="Fit"><Maximize2 size={16} /></button>
          <button onClick={handleReset} className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent transition-colors" title="Reset"><RefreshCw size={16} /></button>
        </div>

        {/* Group 2: View Modes */}
        <div className="flex items-center gap-1 border-r border-slate-200 pr-4">
          {['structure', 'all'].map((value) => (
            <button
              key={value}
              onClick={() => setPerspective(value)}
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={{
                background: perspective === value ? '#e0e7ff' : 'transparent', // indigo-100
                color: perspective === value ? '#3730a3' : '#64748b', // indigo-800 or slate-500
              }}
            >
              {value === 'all' ? 'Combined' : 'Structure'}
            </button>
          ))}
          <div className="w-px h-6 bg-slate-200 mx-2"></div>
          {['overview', 'local'].map((value) => (
            <button
              key={value}
              onClick={() => setScope(value)}
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={{
                background: scope === value ? '#e0e7ff' : 'transparent',
                color: scope === value ? '#3730a3' : '#64748b',
              }}
            >
              {value === 'overview' ? 'Overview' : \\\Local \\\\\\}
            </button>
          ))}
        </div>

        {/* Group 3: Search */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 bg-slate-50 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
          <Search size={14} className="text-slate-400" />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') handleSearchFocus(); }}
            placeholder="Search resources..."
            className="bg-transparent outline-none text-sm w-48 text-slate-700 placeholder-slate-400"
          />
          <button onClick={handleSearchFocus} className="text-xs px-2 py-1 rounded bg-indigo-700 hover:bg-indigo-800 text-white font-medium transition-colors">
            Focus
          </button>
        </div>

        {/* Group 4: Toggles */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border"
            style={{
              background: showFilters ? '#eeb' : 'transparent', 
              color: showFilters ? '#4338ca' : '#475569',
              borderColor: showFilters ? '#4338ca' : 'transparent', 
            }}
          >
            <Filter size={14} /> Filters
          </button>
          <div className="flex items-center gap-3 text-xs text-slate-500 ml-2">
            <span>\\\ nodes</span>
            <span>\\\ edges</span>
          </div>
        </div>
      </div>

      {/* Filter panel */}
\;

content = content.replace(toolbarRegex, newToolbar);

// 3. Filter Popover Redesign
const filterRegex = /\{\/\* Filter panel \*\/\}[\\s\\S]*?\{\/\* Legend \*\/\}/;

const newFilter = \{/* Filter Panel (Popover) */}
      {showFilters && (
        <div className="absolute top-16 right-4 z-50 bg-white border border-slate-200 shadow-xl rounded-lg p-4 w-96">
          <div className="mb-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Node Types</span>
            <div className="flex flex-wrap gap-2">
              {nodeTypes.map((type) => {
                const cfg = GRAPH_NODE_TYPE_CONFIG[type] || {};
                const active = effectiveFilterTypes.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => {
                      const base = filterTypes.length > 0 ? filterTypes : defaultTypes;
                      const next = base.includes(type) ? base.filter((t) => t !== type) : [...base, type];
                      dispatch(setFilterTypes(next));
                    }}
                    className="text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors border flex items-center"
                    style={{
                      background: active ? '#f8fafc' : '#ffffff',
                      color: active ? '#0f172a' : '#64748b',
                      borderColor: active ? '#4338ca' : '#cbd5e1',
                    }}
                  >
                    <img src={cfg.icon || fileIcon} alt={type} className="inline-block w-3 h-3 mr-1.5 opacity-80" />
                    {cfg.label || type}
                  </button>
                );
              })}
            </div>
            {filterTypes.length > 0 && (
              <button onClick={() => dispatch(setFilterTypes([]))} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-2">
                Reset type filters
              </button>
            )}
          </div>

          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Languages</span>
            <div className="flex flex-wrap gap-2">
              {availableLangs.map((lang) => {
                const active = filterLangs.length === 0 || filterLangs.includes(lang);
                return (
                  <button
                    key={lang}
                    onClick={() => {
                      const next = filterLangs.includes(lang) ? filterLangs.filter((value) => value !== lang) : [...filterLangs, lang];
                      dispatch(setFilterLangs(next));
                    }}
                    className="text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors border"
                    style={{
                      background: active ? '#f8fafc' : '#ffffff',
                      color: active ? '#0f172a' : '#64748b',
                      borderColor: active ? '#4338ca' : '#cbd5e1',
                    }}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
            {filterLangs.length > 0 && (
              <button onClick={() => dispatch(setFilterLangs([]))} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-2">
                Reset language filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Legend Map Index */}
\;

content = content.replace(filterRegex, newFilter);

// 4. Map Index Legend Redesign
const legendRegex = /\{\/\* Legend Map Index \*\/\}[\\s\\S]*?(?=\{\/\* Selected node info bar \*\/\})/;

const newLegend = \{/* Legend Map Index Component */}
      <div className="absolute bottom-6 right-6 z-50 bg-white/95 backdrop-blur-sm border border-slate-200 shadow-lg rounded-lg outline font-sans w-72 transition-transform hover:scale-105 transform origin-bottom-right">
        <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 rounded-t-lg flex justify-between items-center cursor-pointer" onClick={() => setShowLegend(v => !v)}>
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1"><Info size={14} className="text-indigo-600"/> Map Index</span>
          <span className="text-slate-400 text-xs">{showLegend ? '?' : '?'}</span>
        </div>
        
        {showLegend && (
          <div className="p-3 max-h-96 overflow-y-auto space-y-4">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Entities</span>
              <div className="grid grid-cols-2 gap-2">
                {['folder', ...nodeTypes].map((type) => {
                  const cfg = GRAPH_NODE_TYPE_CONFIG[type] || {};
                  return (
                    <div key={type} className="flex items-center gap-2 text-xs text-slate-600">
                      <img src={cfg.icon || fileIcon} alt={type} className="w-4 h-4" />
                      {cfg.label || type}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Relationships</span>
              <div className="grid grid-cols-1 gap-2">
                {Object.keys(edgeConfig).map((type) => {
                  const cfg = edgeConfig[type] || {};
                  return (
                    <div key={type} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="inline-block w-6" style={{ borderTop: \\\2px \\\ \\\\\\ }} />
                      {cfg.label || type}
                    </div>
                  );
                })}
              </div>
            </div>

             <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Status Indicators</span>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="w-4 h-4 rounded-sm border-2 inline-block border-red-500 bg-red-50" /> Selected
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="w-4 h-4 rounded-sm border-2 inline-block border-orange-500 bg-orange-50" /> Direct Impact
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="w-4 h-4 rounded-sm border-2 inline-block border-yellow-500 bg-yellow-50" /> Transitive
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      \;
      
/// replace legend map 
content = content.replace(legendRegex, newLegend);
fs.writeFileSync('src/pages/GraphView.jsx', content, 'utf8');

console.log('Script completed.');
