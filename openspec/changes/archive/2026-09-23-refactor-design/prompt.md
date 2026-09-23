# Prompt

Use this HTML to refactor the design:

<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OpenSpec Dashboard</title>

  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Google Fonts: Inter & JetBrains Mono -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <!-- Lucide Icons -->
  <script src="https://unpkg.com/lucide@latest"></script>

  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace'],
          },
          colors: {
            brand: {
              50: '#eef2ff',
              100: '#e0e7ff',
              500: '#6366f1',
              600: '#4f46e5',
              700: '#4338ca',
            },
            dark: {
              950: '#090a0f',
              900: '#0e1117',
              850: '#141822',
              800: '#1b202e',
              700: '#283044',
              600: '#3a445d',
            }
          }
        }
      }
    };
  </script>

  <style>
    /* Custom scrollbars */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(148, 163, 184, 0.2);
      border-radius: 9999px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(148, 163, 184, 0.4);
    }
    
    .glass-panel {
      background: rgba(14, 17, 23, 0.75);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .light .glass-panel {
      background: rgba(255, 255, 255, 0.85);
    }

    .shimmer-card {
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .shimmer-card:hover {
      transform: translateY(-2px);
    }

    /* Column drop zones */
    .kanban-col {
      min-height: 520px;
    }
  </style>
</head>

<body class="bg-[#090a0f] text-slate-100 font-sans antialiased min-h-screen flex flex-col selection:bg-indigo-500 selection:text-white transition-colors duration-200">

  <header class="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#0e1117]/80 backdrop-blur-md px-4 lg:px-7 transition-colors">
    <div class="flex items-center justify-between h-14 max-w-[1720px] mx-auto">
      
      <!-- Left: Logo & Project context -->
      <div class="flex items-center gap-4">
        <!-- Logo -->
        <a href="#" class="flex items-center gap-2.5 group">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <i data-lucide="layers" class="w-4 h-4 text-white"></i>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-bold tracking-tight text-white text-base">OpenSpec</span>
            <span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">v0.8.4</span>
          </div>
        </a>

        <!-- Repository Selector -->
        <div class="hidden sm:flex items-center">
          <div class="h-4 w-[1px] bg-slate-800 mx-2"></div>
          <button class="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-white/[0.06] text-xs font-mono text-slate-300 transition-colors border border-transparent hover:border-white/[0.08]">
            <i data-lucide="git-branch" class="w-3.5 h-3.5 text-slate-400"></i>
            <span class="font-medium text-slate-200">acme-corp</span>
            <span class="text-slate-500">/</span>
            <span class="text-indigo-400">platform-engine</span>
            <i data-lucide="chevrons-up-down" class="w-3 h-3 text-slate-500 ml-1"></i>
          </button>
        </div>

        <!-- Git Sync Pill -->
        <div class="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Git Synced</span>
        </div>
      </div>

      <!-- Center: Main Navigation Tabs -->
      <nav class="hidden md:flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] p-1 rounded-lg" id="main-nav">
        <button onclick="switchTab('board')" id="nav-tab-board" class="px-3.5 py-1 rounded-md text-xs font-medium transition-all text-white bg-indigo-600/30 border border-indigo-500/40 shadow-sm flex items-center gap-1.5">
          <i data-lucide="kanban" class="w-3.5 h-3.5"></i>
          <span>Board</span>
          <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-500/20 text-indigo-300 font-mono" id="nav-count-active">8</span>
        </button>
        <button onclick="switchTab('specs')" id="nav-tab-specs" class="px-3.5 py-1 rounded-md text-xs font-medium transition-all text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] flex items-center gap-1.5">
          <i data-lucide="file-code-2" class="w-3.5 h-3.5"></i>
          <span>Specs Library</span>
          <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-400 font-mono">24</span>
        </button>
        <button onclick="switchTab('archive')" id="nav-tab-archive" class="px-3.5 py-1 rounded-md text-xs font-medium transition-all text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] flex items-center gap-1.5">
          <i data-lucide="archive" class="w-3.5 h-3.5"></i>
          <span>Archive</span>
        </button>
        <button onclick="switchTab('analytics')" id="nav-tab-analytics" class="px-3.5 py-1 rounded-md text-xs font-medium transition-all text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] flex items-center gap-1.5">
          <i data-lucide="bar-chart-3" class="w-3.5 h-3.5"></i>
          <span>Spec Deltas</span>
        </button>
      </nav>

      <!-- Right: Search trigger, theme, help, and user profile -->
      <div class="flex items-center gap-2">
        <!-- Quick search command trigger -->
        <button onclick="openCommandPalette()" class="hidden sm:flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-400 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] rounded-md transition-all">
          <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400"></i>
          <span>Search or command...</span>
          <kbd class="font-mono text-[10px] bg-white/[0.08] px-1.5 py-0.5 rounded text-slate-300 border border-white/[0.08]">⌘K</kbd>
        </button>

        <!-- Theme Toggle -->
        <button onclick="toggleTheme()" class="p-2 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-colors" title="Toggle Theme">
          <i data-lucide="moon" id="theme-icon" class="w-4 h-4"></i>
        </button>

        <!-- Terminal Assistant Helper -->
        <button onclick="openCliModal()" class="p-2 rounded-md text-slate-400 hover:text-indigo-400 hover:bg-white/[0.05] transition-colors" title="Quick CLI & AI Assist">
          <i data-lucide="terminal" class="w-4 h-4"></i>
        </button>

        <div class="h-4 w-[1px] bg-slate-800 mx-1"></div>

        <!-- User profile -->
        <button class="flex items-center gap-2 p-1 pl-1.5 rounded-full hover:bg-white/[0.05] border border-transparent hover:border-white/[0.08] transition-all">
          <div class="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 to-indigo-500 flex items-center justify-center text-[11px] font-bold text-white shadow-sm">
            FL
          </div>
          <span class="text-xs font-medium text-slate-300 hidden lg:inline">Felix</span>
          <i data-lucide="chevron-down" class="w-3 h-3 text-slate-500"></i>
        </button>
      </div>

    </div>
  </header>

  <section class="border-b border-white/[0.06] bg-[#0c0e14]/60 px-4 lg:px-7 py-3.5">
    <div class="max-w-[1720px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
      
      <!-- Metrics & context headline -->
      <div class="flex flex-wrap items-center gap-3">
        <div>
          <h1 class="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Change Workflow</span>
            <span class="text-xs font-normal text-slate-400 font-mono">(/openspec/changes)</span>
          </h1>
        </div>

        <div class="h-4 w-[1px] bg-slate-800 hidden sm:block"></div>

        <!-- Metric Badges -->
        <div class="flex items-center gap-2 flex-wrap text-xs">
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.07] text-slate-300">
            <span class="text-slate-400">Active Changes:</span>
            <span class="font-mono font-semibold text-white" id="stat-active">8</span>
          </div>
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono">
            <span>Spec Deltas:</span>
            <span class="font-bold">+18 / ~4</span>
          </div>
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono">
            <span>Review Pending:</span>
            <span class="font-bold">2</span>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2.5 self-start md:self-auto">
        <!-- Quick prompt / CLI copy action -->
        <button onclick="openCliModal()" class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.1] text-xs font-medium text-slate-200 transition-all hover:border-slate-400/40">
          <i data-lucide="terminal" class="w-3.5 h-3.5 text-indigo-400"></i>
          <span>CLI / AI Prompt</span>
        </button>

        <!-- New Change Button (Primary CTA) -->
        <button onclick="openNewChangeDrawer()" class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]">
          <i data-lucide="plus" class="w-4 h-4 stroke-[2.5]"></i>
          <span>New Change</span>
          <kbd class="hidden sm:inline font-mono text-[9px] bg-white/20 px-1 py-0.5 rounded text-white/90">C</kbd>
        </button>
      </div>

    </div>
  </section>

  <section class="border-b border-white/[0.06] bg-[#090a0f] px-4 lg:px-7 py-2.5">
    <div class="max-w-[1720px] mx-auto flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
      
      <!-- Left: Search & Filter Dropdowns -->
      <div class="flex items-center gap-2 flex-wrap flex-1">
        
        <!-- Live Instant Search -->
        <div class="relative min-w-[240px] flex-1 sm:flex-initial">
          <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
          <input 
            type="text" 
            id="filter-search" 
            oninput="handleSearchChange(this.value)" 
            placeholder="Filter changes by name, slug, spec..." 
            class="w-full bg-[#121620] border border-white/[0.08] rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
          <button onclick="clearSearch()" id="search-clear-btn" class="hidden absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        </div>

        <!-- Filter Dropdown: Status -->
        <div class="relative">
          <select id="filter-status" onchange="applyFilters()" class="appearance-none bg-[#121620] border border-white/[0.08] hover:border-white/[0.16] rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer">
            <option value="all">All Stages</option>
            <option value="draft">Draft & Proposal</option>
            <option value="spec">Design & Spec Delta</option>
            <option value="progress">In Progress (Tasks)</option>
            <option value="review">Review & Ready</option>
          </select>
          <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
        </div>

        <!-- Filter Dropdown: Domain / Category -->
        <div class="relative">
          <select id="filter-domain" onchange="applyFilters()" class="appearance-none bg-[#121620] border border-white/[0.08] hover:border-white/[0.16] rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer">
            <option value="all">All Domains</option>
            <option value="Auth">Domain: Auth</option>
            <option value="Storage">Domain: Storage</option>
            <option value="API">Domain: API</option>
            <option value="Telemetry">Domain: Telemetry</option>
            <option value="CLI">Domain: CLI</option>
          </select>
          <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
        </div>

        <!-- Filter Dropdown: Artifact State -->
        <div class="relative">
          <select id="filter-artifact" onchange="applyFilters()" class="appearance-none bg-[#121620] border border-white/[0.08] hover:border-white/[0.16] rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer">
            <option value="all">Artifact State: Any</option>
            <option value="tasks-incomplete">Has Incomplete Tasks</option>
            <option value="spec-modified">Has Spec Deltas (+)</option>
            <option value="design-ready">Design Completed</option>
          </select>
          <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
        </div>

        <!-- Active Filter Reset Button -->
        <button onclick="resetFilters()" id="btn-reset-filters" class="hidden text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded transition-colors flex items-center gap-1">
          <i data-lucide="rotate-ccw" class="w-3 h-3"></i>
          <span>Clear filters</span>
        </button>

      </div>

      <!-- Right: View switchers & density -->
      <div class="flex items-center gap-3 self-end lg:self-auto">
        <div class="flex items-center bg-[#121620] p-1 rounded-lg border border-white/[0.08]">
          <button onclick="setViewMode('board')" id="btn-view-board" class="p-1 px-2 rounded text-xs font-medium flex items-center gap-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <i data-lucide="columns" class="w-3.5 h-3.5"></i>
            <span class="hidden sm:inline">Board</span>
          </button>
          <button onclick="setViewMode('table')" id="btn-view-table" class="p-1 px-2 rounded text-xs font-medium flex items-center gap-1.5 text-slate-400 hover:text-slate-200">
            <i data-lucide="list" class="w-3.5 h-3.5"></i>
            <span class="hidden sm:inline">Table</span>
          </button>
        </div>

        <div class="text-[11px] font-mono text-slate-500 hidden sm:block">
          Showing <span id="filtered-count" class="text-slate-300 font-semibold">8</span> changes
        </div>
      </div>

    </div>

    <!-- Active filter tags strip -->
    <div id="active-tags-container" class="max-w-[1720px] mx-auto mt-2 flex items-center gap-2 flex-wrap empty:hidden"></div>
  </section>

  <main class="flex-1 px-4 lg:px-7 py-6 max-w-[1720px] mx-auto w-full">
    
    <!-- TAB 1: KANBAN BOARD VIEW -->
    <div id="tab-board-view" class="block">
      <!-- 4 Standard OpenSpec Lifecycle Columns -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        
        <!-- Column 1: Draft & Proposal -->
        <div class="kanban-col bg-[#0f121a]/80 border border-white/[0.06] rounded-xl flex flex-col p-3.5">
          <div class="flex items-center justify-between mb-3 px-1">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
              <h2 class="text-xs font-semibold text-slate-200 uppercase tracking-wider">Draft & Proposal</h2>
              <span class="text-[11px] font-mono px-1.5 py-0.2 rounded bg-white/[0.06] text-slate-400 col-count" id="count-col-draft">2</span>
            </div>
            <button onclick="openNewChangeDrawer('draft')" class="text-slate-400 hover:text-white p-1 hover:bg-white/[0.06] rounded" title="Add change to draft">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            </button>
          </div>
          <!-- Card List -->
          <div id="col-cards-draft" class="flex flex-col gap-3 min-h-[400px]"></div>
        </div>

        <!-- Column 2: Design & Spec Delta -->
        <div class="kanban-col bg-[#0f121a]/80 border border-white/[0.06] rounded-xl flex flex-col p-3.5">
          <div class="flex items-center justify-between mb-3 px-1">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
              <h2 class="text-xs font-semibold text-slate-200 uppercase tracking-wider">Design & Spec Delta</h2>
              <span class="text-[11px] font-mono px-1.5 py-0.2 rounded bg-white/[0.06] text-slate-400 col-count" id="count-col-spec">2</span>
            </div>
            <button onclick="openNewChangeDrawer('spec')" class="text-slate-400 hover:text-white p-1 hover:bg-white/[0.06] rounded">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            </button>
          </div>
          <!-- Card List -->
          <div id="col-cards-spec" class="flex flex-col gap-3 min-h-[400px]"></div>
        </div>

        <!-- Column 3: In Progress (Tasks) -->
        <div class="kanban-col bg-[#0f121a]/80 border border-white/[0.06] rounded-xl flex flex-col p-3.5">
          <div class="flex items-center justify-between mb-3 px-1">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <h2 class="text-xs font-semibold text-slate-200 uppercase tracking-wider">In Progress (Tasks)</h2>
              <span class="text-[11px] font-mono px-1.5 py-0.2 rounded bg-white/[0.06] text-slate-400 col-count" id="count-col-progress">2</span>
            </div>
            <button onclick="openNewChangeDrawer('progress')" class="text-slate-400 hover:text-white p-1 hover:bg-white/[0.06] rounded">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            </button>
          </div>
          <!-- Card List -->
          <div id="col-cards-progress" class="flex flex-col gap-3 min-h-[400px]"></div>
        </div>

        <!-- Column 4: Review & Ready to Archive -->
        <div class="kanban-col bg-[#0f121a]/80 border border-white/[0.06] rounded-xl flex flex-col p-3.5">
          <div class="flex items-center justify-between mb-3 px-1">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <h2 class="text-xs font-semibold text-slate-200 uppercase tracking-wider">Review & Archive Ready</h2>
              <span class="text-[11px] font-mono px-1.5 py-0.2 rounded bg-white/[0.06] text-slate-400 col-count" id="count-col-review">2</span>
            </div>
            <button onclick="openNewChangeDrawer('review')" class="text-slate-400 hover:text-white p-1 hover:bg-white/[0.06] rounded">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            </button>
          </div>
          <!-- Card List -->
          <div id="col-cards-review" class="flex flex-col gap-3 min-h-[400px]"></div>
        </div>

      </div>
    </div>

    <!-- TAB 1-ALT: TABLE / LIST VIEW -->
    <div id="tab-table-view" class="hidden">
      <div class="rounded-xl border border-white/[0.08] bg-[#0f121a] overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-slate-300">
            <thead class="bg-white/[0.03] text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-white/[0.06]">
              <tr>
                <th class="py-3 px-4">Change Identifier / Slug</th>
                <th class="py-3 px-4">Title & Intent</th>
                <th class="py-3 px-4">Stage</th>
                <th class="py-3 px-4">Artifact Pipeline</th>
                <th class="py-3 px-4">Spec Deltas</th>
                <th class="py-3 px-4">Tasks</th>
                <th class="py-3 px-4">Domain</th>
                <th class="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="table-body-rows" class="divide-y divide-white/[0.04]">
              <!-- Injected via JavaScript -->
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 2: SPECS LIBRARY TAB (Overview of truth specs) -->
    <div id="tab-specs-view" class="hidden">
      <div class="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-lg font-bold text-white">OpenSpec Specifications Directory</h2>
          <p class="text-xs text-slate-400">Source of truth specs tracked in <code class="font-mono text-indigo-400">openspec/specs/</code></p>
        </div>
        <div class="flex items-center gap-2">
          <button class="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-slate-200">
            Validate Specs (CLI)
          </button>
          <button class="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-xs text-white font-medium">
            + New Spec Document
          </button>
        </div>
      </div>

      <!-- Specs Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="specs-directory-grid">
        <!-- Sample Spec Items -->
      </div>
    </div>

    <!-- TAB 3: ARCHIVE TAB -->
    <div id="tab-archive-view" class="hidden">
      <div class="p-8 text-center border border-dashed border-white/[0.1] rounded-2xl bg-white/[0.01]">
        <div class="w-12 h-12 rounded-xl bg-slate-800/60 mx-auto flex items-center justify-center text-slate-400 mb-3">
          <i data-lucide="archive" class="w-6 h-6"></i>
        </div>
        <h3 class="text-base font-semibold text-white">Archived Changes History</h3>
        <p class="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-4">
          Completed changes merged into main specs. Run <code class="font-mono text-indigo-400">openspec archive --sync</code> to update your local archive catalog.
        </p>
        <button class="px-3.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-xs text-slate-300 border border-white/[0.08]">
          Fetch Historical Merges (38 completed)
        </button>
      </div>
    </div>

    <!-- TAB 4: ANALYTICS / SPEC DELTAS -->
    <div id="tab-analytics-view" class="hidden">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="p-4 rounded-xl border border-white/[0.08] bg-[#0e1117]">
          <span class="text-xs text-slate-400">Total System Requirements</span>
          <div class="text-2xl font-bold font-mono text-white mt-1">142</div>
          <span class="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-mono">
            <i data-lucide="trending-up" class="w-3 h-3"></i> +12 this sprint
          </span>
        </div>
        <div class="p-4 rounded-xl border border-white/[0.08] bg-[#0e1117]">
          <span class="text-xs text-slate-400">Task Completion Rate</span>
          <div class="text-2xl font-bold font-mono text-white mt-1">78.4%</div>
          <span class="text-[11px] text-indigo-400 flex items-center gap-1 mt-1 font-mono">
            44 of 56 tasks verified
          </span>
        </div>
        <div class="p-4 rounded-xl border border-white/[0.08] bg-[#0e1117]">
          <span class="text-xs text-slate-400">Avg. Cycle Time to Archive</span>
          <div class="text-2xl font-bold font-mono text-white mt-1">4.2 days</div>
          <span class="text-[11px] text-slate-400 flex items-center gap-1 mt-1 font-mono">
            Across last 20 changes
          </span>
        </div>
      </div>
    </div>

  </main>

  <div id="drawer-overlay" onclick="closeNewChangeDrawer()" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 hidden transition-opacity"></div>
  
  <aside id="new-change-drawer" class="fixed top-0 right-0 h-full w-full max-w-lg bg-[#0e1118] border-l border-white/[0.09] shadow-2xl z-50 transform translate-x-full transition-transform duration-300 ease-out flex flex-col">
    <!-- Drawer Header -->
    <div class="p-5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
          <i data-lucide="file-plus-2" class="w-4 h-4"></i>
        </div>
        <div>
          <h2 class="text-sm font-bold text-white tracking-tight">Create New OpenSpec Change</h2>
          <p class="text-[11px] text-slate-400 font-mono">Scaffolds openspec/changes/&lt;id&gt;/</p>
        </div>
      </div>
      <button onclick="closeNewChangeDrawer()" class="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/[0.05]">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    </div>

    <!-- Drawer Body Form -->
    <div class="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
      
      <!-- Change Title -->
      <div>
        <label class="block text-slate-300 font-medium mb-1.5">Change Title <span class="text-rose-400">*</span></label>
        <input 
          type="text" 
          id="form-title" 
          oninput="handleTitleSlugSync(this.value)" 
          placeholder="e.g. Add Redis cache adapter for session store" 
          class="w-full bg-[#141824] border border-white/[0.1] rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs" 
        />
      </div>

      <!-- Generated Slug / Directory name -->
      <div>
        <label class="block text-slate-300 font-medium mb-1.5 flex items-center justify-between">
          <span>Change Identifier Slug (Directory)</span>
          <span class="text-[10px] text-slate-400 font-mono">kebab-case</span>
        </label>
        <div class="relative">
          <input 
            type="text" 
            id="form-slug" 
            placeholder="add-redis-cache-adapter" 
            class="w-full bg-[#141824] border border-white/[0.1] rounded-lg px-3 py-2 text-indigo-300 font-mono text-xs focus:outline-none focus:border-indigo-500" 
          />
        </div>
      </div>

      <!-- Schema Type -->
      <div>
        <label class="block text-slate-300 font-medium mb-1.5">Change Schema / Template</label>
        <div class="grid grid-cols-3 gap-2">
          <label class="border border-indigo-500/40 bg-indigo-500/10 rounded-lg p-2.5 cursor-pointer flex flex-col gap-1 schema-option" onclick="selectSchema(this, 'feature')">
            <span class="font-semibold text-white">Feature</span>
            <span class="text-[10px] text-slate-400">Spec-driven feature with design & tasks</span>
          </label>
          <label class="border border-white/[0.08] hover:border-white/[0.2] bg-white/[0.02] rounded-lg p-2.5 cursor-pointer flex flex-col gap-1 schema-option" onclick="selectSchema(this, 'fix')">
            <span class="font-semibold text-slate-200">Bug Fix</span>
            <span class="text-[10px] text-slate-400">Targeted delta with regression test tasks</span>
          </label>
          <label class="border border-white/[0.08] hover:border-white/[0.2] bg-white/[0.02] rounded-lg p-2.5 cursor-pointer flex flex-col gap-1 schema-option" onclick="selectSchema(this, 'rfc')">
            <span class="font-semibold text-slate-200">RFC</span>
            <span class="text-[10px] text-slate-400">Exploratory design without spec diff</span>
          </label>
        </div>
      </div>

      <!-- Domain & Initial Column -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-slate-300 font-medium mb-1.5">Domain Tag</label>
          <select id="form-domain" class="w-full bg-[#141824] border border-white/[0.1] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500">
            <option value="Auth">Auth</option>
            <option value="Storage">Storage</option>
            <option value="API">API</option>
            <option value="CLI">CLI</option>
            <option value="Telemetry">Telemetry</option>
          </select>
        </div>
        <div>
          <label class="block text-slate-300 font-medium mb-1.5">Initial Stage</label>
          <select id="form-status" class="w-full bg-[#141824] border border-white/[0.1] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500">
            <option value="draft">Draft & Proposal</option>
            <option value="spec">Design & Spec Delta</option>
            <option value="progress">In Progress</option>
          </select>
        </div>
      </div>

      <!-- Target Specs Touched -->
      <div>
        <label class="block text-slate-300 font-medium mb-1.5">Target Specs Affected</label>
        <div class="space-y-1.5 border border-white/[0.08] bg-[#141824] p-2.5 rounded-lg max-h-28 overflow-y-auto">
          <label class="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer">
            <input type="checkbox" name="target-spec" value="specs/auth/tokens.md" class="rounded border-slate-700 text-indigo-600 focus:ring-0" checked />
            <span class="font-mono text-[11px]">specs/auth/tokens.md</span>
          </label>
          <label class="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer">
            <input type="checkbox" name="target-spec" value="specs/storage/driver.md" class="rounded border-slate-700 text-indigo-600 focus:ring-0" />
            <span class="font-mono text-[11px]">specs/storage/driver.md</span>
          </label>
          <label class="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer">
            <input type="checkbox" name="target-spec" value="specs/cli/commands.md" class="rounded border-slate-700 text-indigo-600 focus:ring-0" />
            <span class="font-mono text-[11px]">specs/cli/commands.md</span>
          </label>
        </div>
      </div>

      <!-- Proposal Summary -->
      <div>
        <label class="block text-slate-300 font-medium mb-1.5">Proposal Intent Summary</label>
        <textarea 
          id="form-summary" 
          rows="2" 
          placeholder="Brief summary of why this change is needed and key architectural impact..." 
          class="w-full bg-[#141824] border border-white/[0.1] rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        ></textarea>
      </div>

      <!-- Generated OpenSpec CLI command preview -->
      <div class="p-3 bg-black/40 border border-white/[0.08] rounded-lg">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
            <i data-lucide="terminal" class="w-3 h-3 text-indigo-400"></i>
            Equivalent OpenSpec CLI Command
          </span>
          <button onclick="copyGeneratedCommand()" class="text-[10px] text-indigo-400 hover:text-indigo-300 font-mono">
            Copy
          </button>
        </div>
        <code id="cli-preview-text" class="text-[11px] font-mono text-emerald-400 break-all">
          openspec new change --id add-redis-cache --schema feature
        </code>
      </div>

    </div>

    <!-- Drawer Footer Actions -->
    <div class="p-4 border-t border-white/[0.08] bg-[#0c0e14] flex items-center justify-end gap-2.5">
      <button onclick="closeNewChangeDrawer()" class="px-3.5 py-1.5 rounded-lg border border-white/[0.1] hover:bg-white/[0.05] text-slate-300 text-xs">
        Cancel
      </button>
      <button onclick="submitNewChange()" class="px-4 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-xs shadow-lg shadow-indigo-500/20">
        Create Change
      </button>
    </div>
  </aside>

  <div id="detail-modal" class="fixed inset-0 bg-black/75 backdrop-blur-md z-50 hidden flex items-center justify-center p-4">
    <div class="bg-[#0e1118] border border-white/[0.1] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      
      <!-- Modal Header -->
      <div class="p-5 border-b border-white/[0.08] flex items-start justify-between bg-white/[0.02]">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span id="detail-slug" class="font-mono text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">feat-auth-rate-limiting</span>
            <span id="detail-domain" class="text-[10px] font-semibold px-2 py-0.5 rounded bg-white/[0.06] text-slate-300">Auth</span>
            <span id="detail-status" class="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">In Progress</span>
          </div>
          <h2 id="detail-title" class="text-base font-bold text-white tracking-tight">Add Token Bucket Rate Limiting for Public Endpoints</h2>
        </div>
        <button onclick="closeDetailModal()" class="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/[0.05]">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <!-- Modal Body (Artifact Tabs) -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
        
        <!-- Artifacts Status Bar -->
        <div class="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] grid grid-cols-4 gap-2 text-center">
          <div class="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span class="block text-[10px] font-mono text-emerald-400">PROPOSAL</span>
            <span class="font-semibold text-emerald-300 text-xs">✓ Complete</span>
          </div>
          <div class="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span class="block text-[10px] font-mono text-emerald-400">DESIGN</span>
            <span class="font-semibold text-emerald-300 text-xs">✓ Approved</span>
          </div>
          <div class="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <span class="block text-[10px] font-mono text-indigo-400">SPEC DELTA</span>
            <span id="detail-spec-delta" class="font-semibold text-indigo-300 text-xs">+3 Requirements</span>
          </div>
          <div class="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <span class="block text-[10px] font-mono text-amber-400">TASKS</span>
            <span id="detail-tasks-progress" class="font-semibold text-amber-300 text-xs">4 of 6 Done</span>
          </div>
        </div>

        <!-- Proposal Preview -->
        <div>
          <h3 class="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
            <i data-lucide="file-text" class="w-3.5 h-3.5 text-indigo-400"></i>
            <span>Proposal Intent (proposal.md)</span>
          </h3>
          <p id="detail-desc" class="text-slate-300 leading-relaxed bg-[#121622] p-3.5 rounded-lg border border-white/[0.06] font-sans">
            Implement sliding window / token bucket rate limiting on public unauthenticated endpoints to prevent brute-force attacks and abuse.
          </p>
        </div>

        <!-- Task Checklist (Interactive) -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <i data-lucide="check-square" class="w-3.5 h-3.5 text-emerald-400"></i>
              <span>Implementation Tasks (tasks.md)</span>
            </h3>
            <span class="text-[11px] font-mono text-slate-500">Auto-saved to change catalog</span>
          </div>
          <div id="detail-tasks-list" class="space-y-2">
            <!-- Injected dynamically -->
          </div>
        </div>

        <!-- Spec Deltas / Diff snippet -->
        <div>
          <h3 class="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
            <i data-lucide="git-pull-request" class="w-3.5 h-3.5 text-indigo-400"></i>
            <span>Spec Deltas (specs/auth/rate-limit.md)</span>
          </h3>
          <div class="font-mono text-[11px] bg-black/50 border border-white/[0.08] rounded-lg p-3 space-y-1 text-slate-300">
            <div class="text-emerald-400">+ ## REQ-AUTH-088: Public Endpoints Rate Limiter</div>
            <div class="text-emerald-400">+ The system MUST limit unauthenticated /login attempts to 5 per minute per IP.</div>
            <div class="text-emerald-400">+ On breach, HTTP 429 Too Many Requests MUST be returned with Retry-After header.</div>
            <div class="text-slate-500">  ## REQ-AUTH-089: Authenticated Tier Limits</div>
          </div>
        </div>

        <!-- CLI Quick Trigger -->
        <div class="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-xl flex items-center justify-between">
          <div class="flex items-center gap-2">
            <i data-lucide="terminal" class="w-4 h-4 text-indigo-400"></i>
            <span class="font-mono text-[11px] text-slate-300" id="detail-cli-cmd">openspec run feat-auth-rate-limiting</span>
          </div>
          <button onclick="copyText('detail-cli-cmd')" class="px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 font-medium text-[11px]">
            Copy CLI
          </button>
        </div>

      </div>

      <!-- Modal Footer -->
      <div class="p-4 border-t border-white/[0.08] bg-[#0c0e14] flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xs text-slate-400">Move stage:</span>
          <select id="modal-change-stage-select" onchange="moveCurrentChangeStage(this.value)" class="bg-[#141824] border border-white/[0.1] rounded px-2 py-1 text-xs text-slate-200">
            <option value="draft">Draft & Proposal</option>
            <option value="spec">Design & Spec Delta</option>
            <option value="progress">In Progress</option>
            <option value="review">Review & Ready</option>
          </select>
        </div>
        <button onclick="closeDetailModal()" class="px-4 py-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.12] text-xs font-medium text-white">
          Close Inspector
        </button>
      </div>

    </div>
  </div>

  <div id="cli-modal" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
    <div class="bg-[#0f121a] border border-white/[0.1] rounded-2xl w-full max-w-xl p-5 shadow-2xl">
      <div class="flex items-center justify-between pb-3 border-b border-white/[0.08]">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <i data-lucide="terminal" class="w-4 h-4"></i>
          </div>
          <h3 class="text-sm font-bold text-white">OpenSpec CLI & Prompt Copier</h3>
        </div>
        <button onclick="closeCliModal()" class="text-slate-400 hover:text-white">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <div class="py-4 space-y-4 text-xs">
        <div>
          <label class="block text-slate-400 font-medium mb-1">Slash Command for Cursor / Claude Code / Copilot</label>
          <div class="flex items-center justify-between p-2.5 rounded-lg bg-black/50 border border-white/[0.08] font-mono text-emerald-400">
            <span id="prompt-ai-cmd">/opsx:propose Implement session expiration event bus</span>
            <button onclick="copyText('prompt-ai-cmd')" class="text-slate-400 hover:text-white ml-2">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <div>
          <label class="block text-slate-400 font-medium mb-1">Terminal Terminal Scaffold Command</label>
          <div class="flex items-center justify-between p-2.5 rounded-lg bg-black/50 border border-white/[0.08] font-mono text-sky-400">
            <span id="prompt-cli-cmd">openspec change new --interactive</span>
            <button onclick="copyText('prompt-cli-cmd')" class="text-slate-400 hover:text-white ml-2">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <div>
          <label class="block text-slate-400 font-medium mb-1">Validate All Local Specs & Deltas</label>
          <div class="flex items-center justify-between p-2.5 rounded-lg bg-black/50 border border-white/[0.08] font-mono text-amber-300">
            <span id="prompt-val-cmd">openspec validate --strict --all</span>
            <button onclick="copyText('prompt-val-cmd')" class="text-slate-400 hover:text-white ml-2">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="pt-3 border-t border-white/[0.08] flex justify-end">
        <button onclick="closeCliModal()" class="px-3.5 py-1.5 rounded-lg bg-white/[0.08] text-xs text-white">Done</button>
      </div>
    </div>
  </div>

  <div id="toast-box" class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none"></div>

  <script>
    // Initial Realistic Sample OpenSpec Dataset
    let changesData = [
      {
        id: 'feat-auth-rate-limiting',
        slug: 'auth-rate-limiting',
        title: 'Token Bucket Rate Limiting for Public Endpoints',
        summary: 'Enforce 5 req/min on public login & token exchange endpoints using Redis sliding window.',
        status: 'progress', // draft, spec, progress, review
        domain: 'Auth',
        author: 'FL',
        updated: '2h ago',
        artifacts: {
          proposal: true,
          design: true,
          specDeltaCount: 3,
          tasksTotal: 6,
          tasksCompleted: 4
        },
        tasks: [
          { text: 'Add token bucket schema in config.yaml', done: true },
          { text: 'Implement Redis sliding window counter algorithm', done: true },
          { text: 'Attach rate-limiter middleware to auth routes', done: true },
          { text: 'Return HTTP 429 with Retry-After header', done: true },
          { text: 'Unit test high-throughput edge cases', done: false },
          { text: 'Update openspec/specs/auth/tokens.md delta', done: false }
        ]
      },
      {
        id: 'feat-webhook-retry-v2',
        slug: 'webhook-retry-v2',
        title: 'Exponential Backoff Webhook Delivery Engine',
        summary: 'RFC proposal to replace cron webhook retries with asynchronous queue jitter backoff.',
        status: 'draft',
        domain: 'API',
        author: 'AL',
        updated: '4h ago',
        artifacts: {
          proposal: true,
          design: false,
          specDeltaCount: 0,
          tasksTotal: 4,
          tasksCompleted: 0
        },
        tasks: [
          { text: 'Draft proposal.md and architectural trade-offs', done: true },
          { text: 'Review idempotency key generation spec', done: false },
          { text: 'Draft failure circuit-breaker thresholds', done: false },
          { text: 'Team architectural sign-off', done: false }
        ]
      },
      {
        id: 'feat-streaming-cli-output',
        slug: 'streaming-cli-output',
        title: 'Server-Sent Events for Realtime CLI Stream',
        summary: 'Spec delta introducing SSE transport to stream compiler diagnostic events into CLI stdout.',
        status: 'spec',
        domain: 'CLI',
        author: 'TR',
        updated: '1d ago',
        artifacts: {
          proposal: true,
          design: true,
          specDeltaCount: 2,
          tasksTotal: 5,
          tasksCompleted: 1
        },
        tasks: [
          { text: 'Specify SSE event frame packet layout', done: true },
          { text: 'Define client auto-reconnect fallback mechanism', done: false },
          { text: 'Draft specs/cli/stream-protocol.md', done: false },
          { text: 'Implement terminal spinner cancellation', done: false },
          { text: 'Integration test with ANSI terminal escape codes', done: false }
        ]
      },
      {
        id: 'feat-s3-cold-storage',
        slug: 's3-cold-storage-tier',
        title: 'Object Storage Lifecycle Policy for Blobs',
        summary: 'Move audit log artifacts older than 90 days to Glacier/Cold storage classes.',
        status: 'progress',
        domain: 'Storage',
        author: 'FL',
        updated: 'Yesterday',
        artifacts: {
          proposal: true,
          design: true,
          specDeltaCount: 4,
          tasksTotal: 8,
          tasksCompleted: 7
        },
        tasks: [
          { text: 'Define lifecycle XML policy templates', done: true },
          { text: 'Implement multi-region bucket resolver', done: true },
          { text: 'Add IAM KMS key encryption delegation', done: true },
          { text: 'Verify automated transition lifecycle in staging', done: true },
          { text: 'Validate cost metric dashboard reporting', done: true },
          { text: 'Add restore on-demand CLI command', done: true },
          { text: 'Audit trail logging verification', done: true },
          { text: 'Run final spec compliance check', done: false }
        ]
      },
      {
        id: 'feat-multi-tenant-rbac',
        slug: 'multi-tenant-rbac',
        title: 'Granular Role-Based Access Scopes for Teams',
        summary: 'Specification update adding organization workspace scoping to authorization checks.',
        status: 'spec',
        domain: 'Auth',
        author: 'MK',
        updated: '2d ago',
        artifacts: {
          proposal: true,
          design: true,
          specDeltaCount: 5,
          tasksTotal: 5,
          tasksCompleted: 2
        },
        tasks: [
          { text: 'Define role hierarchy graph in design.md', done: true },
          { text: 'Add spec delta for OrgAdmin, Member, and Auditor', done: true },
          { text: 'Draft migration path for legacy single-tenant users', done: false },
          { text: 'Security review with external audit guidelines', done: false },
          { text: 'Finalize specs/auth/rbac.md', done: false }
        ]
      },
      {
        id: 'fix-token-rotation-race',
        slug: 'token-rotation-race',
        title: 'Fix Refresh Token Concurrent Rotation Race',
        summary: 'Introduce 15-second grace period on rotated refresh tokens to mitigate mobile packet retry dupes.',
        status: 'review',
        domain: 'Auth',
        author: 'FL',
        updated: '3h ago',
        artifacts: {
          proposal: true,
          design: true,
          specDeltaCount: 1,
          tasksTotal: 4,
          tasksCompleted: 4
        },
        tasks: [
          { text: 'Document race condition reproduction test case', done: true },
          { text: 'Add atomic Redis SETNX locking on token exchange', done: true },
          { text: 'Implement 15-second grace window reuse tolerance', done: true },
          { text: 'Verify zero logout dropouts in load test', done: true }
        ]
      },
      {
        id: 'feat-opentelemetry-traces',
        slug: 'opentelemetry-traces',
        title: 'W3C TraceContext Distributed Span Propagation',
        summary: 'Standardize telemetry header propagation across microservice RPC boundaries.',
        status: 'draft',
        domain: 'Telemetry',
        author: 'JS',
        updated: '3d ago',
        artifacts: {
          proposal: true,
          design: false,
          specDeltaCount: 0,
          tasksTotal: 3,
          tasksCompleted: 1
        },
        tasks: [
          { text: 'Evaluate OpenTelemetry SDK memory footprint', done: true },
          { text: 'Design traceparent HTTP header extractor', done: false },
          { text: 'Draft proposal.md impact summary', done: false }
        ]
      },
      {
        id: 'feat-api-schema-v2',
        slug: 'api-schema-v2',
        title: 'OpenAPI 3.1 Strict Type Compatibility Delta',
        summary: 'Upgrade all core schemas to 3.1 supporting nullability and webhooks specifications.',
        status: 'review',
        domain: 'API',
        author: 'AL',
        updated: '1d ago',
        artifacts: {
          proposal: true,
          design: true,
          specDeltaCount: 8,
          tasksTotal: 5,
          tasksCompleted: 5
        },
        tasks: [
          { text: 'Convert all anyOf nullable fields to type arrays', done: true },
          { text: 'Validate schemas against JSON Schema 2020-12', done: true },
          { text: 'Regenerate SDK client typings', done: true },
          { text: 'Update specs/api/openapi.yaml', done: true },
          { text: 'Run backward compatibility test suite', done: true }
        ]
      }
    ];

    // Reference specs directory dataset
    const specsLibrary = [
      { id: 'auth-tokens', path: 'specs/auth/tokens.md', name: 'Authentication & Token Management', version: 'v2.4', requirements: 24, lastTouched: '2 hours ago' },
      { id: 'auth-rbac', path: 'specs/auth/rbac.md', name: 'Role-Based Access Control (RBAC)', version: 'v1.8', requirements: 18, lastTouched: '2 days ago' },
      { id: 'storage-blobs', path: 'specs/storage/driver.md', name: 'Blob Storage & Tiering Driver', version: 'v3.1', requirements: 31, lastTouched: 'Yesterday' },
      { id: 'api-gateway', path: 'specs/api/gateway.md', name: 'Gateway Routing & Rate Limits', version: 'v2.0', requirements: 19, lastTouched: '3 days ago' },
      { id: 'cli-specs', path: 'specs/cli/commands.md', name: 'CLI Command Line Interface Spec', version: 'v1.2', requirements: 14, lastTouched: '1 week ago' },
      { id: 'telemetry', path: 'specs/telemetry/traces.md', name: 'Distributed Observability & Spans', version: 'v0.9', requirements: 11, lastTouched: '4 days ago' },
    ];

    let currentSelectedChangeId = null;
    let currentViewMode = 'board'; // 'board' or 'table'
    let currentSearchTerm = '';

    document.addEventListener('DOMContentLoaded', () => {
      renderBoard();
      renderTable();
      renderSpecsGrid();
      lucide.createIcons();

      // Keyboard shortcuts
      window.addEventListener('keydown', (e) => {
        // Press 'C' outside inputs to open new change drawer
        if ((e.key === 'c' || e.key === 'C') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
          e.preventDefault();
          openNewChangeDrawer();
        }
        // Press '/' to search
        if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
          e.preventDefault();
          const searchInput = document.getElementById('filter-search');
          if (searchInput) searchInput.focus();
        }
        // Press Cmd+K or Ctrl+K
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          openCommandPalette();
        }
        // ESC closes modals
        if (e.key === 'Escape') {
          closeNewChangeDrawer();
          closeDetailModal();
          closeCliModal();
        }
      });
    });

    function getFilteredChanges() {
      const search = currentSearchTerm.toLowerCase().trim();
      const statusFilter = document.getElementById('filter-status').value;
      const domainFilter = document.getElementById('filter-domain').value;
      const artifactFilter = document.getElementById('filter-artifact').value;

      return changesData.filter(item => {
        // Search match
        const matchesSearch = !search || 
          item.title.toLowerCase().includes(search) || 
          item.slug.toLowerCase().includes(search) || 
          item.summary.toLowerCase().includes(search) ||
          item.domain.toLowerCase().includes(search);

        // Status match
        const matchesStatus = (statusFilter === 'all') || (item.status === statusFilter);

        // Domain match
        const matchesDomain = (domainFilter === 'all') || (item.domain === domainFilter);

        // Artifact state match
        let matchesArtifact = true;
        if (artifactFilter === 'tasks-incomplete') {
          matchesArtifact = item.artifacts.tasksCompleted < item.artifacts.tasksTotal;
        } else if (artifactFilter === 'spec-modified') {
          matchesArtifact = item.artifacts.specDeltaCount > 0;
        } else if (artifactFilter === 'design-ready') {
          matchesArtifact = item.artifacts.design === true;
        }

        return matchesSearch && matchesStatus && matchesDomain && matchesArtifact;
      });
    }

    function handleSearchChange(val) {
      currentSearchTerm = val;
      const clearBtn = document.getElementById('search-clear-btn');
      if (val) {
        clearBtn.classList.remove('hidden');
      } else {
        clearBtn.classList.add('hidden');
      }
      applyFilters();
    }

    function clearSearch() {
      const input = document.getElementById('filter-search');
      input.value = '';
      currentSearchTerm = '';
      document.getElementById('search-clear-btn').classList.add('hidden');
      applyFilters();
      input.focus();
    }

    function applyFilters() {
      updateActiveFilterPills();
      renderBoard();
      renderTable();
    }

    function updateActiveFilterPills() {
      const container = document.getElementById('active-tags-container');
      const resetBtn = document.getElementById('btn-reset-filters');
      container.innerHTML = '';

      const status = document.getElementById('filter-status').value;
      const domain = document.getElementById('filter-domain').value;
      const artifact = document.getElementById('filter-artifact').value;
      const hasActive = currentSearchTerm || status !== 'all' || domain !== 'all' || artifact !== 'all';

      if (hasActive) {
        resetBtn.classList.remove('hidden');
      } else {
        resetBtn.classList.add('hidden');
      }

      if (currentSearchTerm) {
        createTag(container, `Search: "${currentSearchTerm}"`, () => clearSearch());
      }
      if (status !== 'all') {
        createTag(container, `Stage: ${status}`, () => {
          document.getElementById('filter-status').value = 'all';
          applyFilters();
        });
      }
      if (domain !== 'all') {
        createTag(container, `Domain: ${domain}`, () => {
          document.getElementById('filter-domain').value = 'all';
          applyFilters();
        });
      }
      if (artifact !== 'all') {
        createTag(container, `Artifact: ${artifact}`, () => {
          document.getElementById('filter-artifact').value = 'all';
          applyFilters();
        });
      }
    }

    function createTag(parent, text, onRemove) {
      const tag = document.createElement('div');
      tag.className = 'flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-[11px] font-mono';
      tag.innerHTML = `
        <span>${text}</span>
        <button class="hover:text-white ml-1">✕</button>
      `;
      tag.querySelector('button').onclick = onRemove;
      parent.appendChild(tag);
    }

    function resetFilters() {
      document.getElementById('filter-search').value = '';
      currentSearchTerm = '';
      document.getElementById('filter-status').value = 'all';
      document.getElementById('filter-domain').value = 'all';
      document.getElementById('filter-artifact').value = 'all';
      document.getElementById('search-clear-btn').classList.add('hidden');
      applyFilters();
    }

    function renderBoard() {
      const filtered = getFilteredChanges();
      document.getElementById('filtered-count').innerText = filtered.length;
      document.getElementById('stat-active').innerText = changesData.length;

      const columns = {
        draft: document.getElementById('col-cards-draft'),
        spec: document.getElementById('col-cards-spec'),
        progress: document.getElementById('col-cards-progress'),
        review: document.getElementById('col-cards-review'),
      };

      // Clear columns
      Object.values(columns).forEach(col => col.innerHTML = '');

      // Group counts
      const counts = { draft: 0, spec: 0, progress: 0, review: 0 };

      filtered.forEach(item => {
        counts[item.status] = (counts[item.status] || 0) + 1;
        const colContainer = columns[item.status];
        if (!colContainer) return;

        // Card HTML
        const card = document.createElement('div');
        card.className = 'shimmer-card rounded-xl border border-white/[0.08] bg-[#121622]/90 hover:bg-[#161c2a] hover:border-indigo-500/40 p-3.5 flex flex-col gap-2.5 cursor-pointer shadow-sm group';
        card.onclick = () => openDetailModal(item.id);

        // Progress percentage for tasks
        const taskPct = item.artifacts.tasksTotal > 0 
          ? Math.round((item.artifacts.tasksCompleted / item.artifacts.tasksTotal) * 100)
          : 0;

        card.innerHTML = `
          <!-- Top Row: Slug & Domain Tag -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 overflow-hidden">
              <span class="font-mono text-[11px] text-indigo-400 group-hover:text-indigo-300 font-medium truncate">
                ${item.slug}
              </span>
            </div>
            <span class="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-300 border border-white/[0.06] shrink-0">
              ${item.domain}
            </span>
          </div>

          <!-- Title & Intent -->
          <div>
            <h3 class="text-xs font-semibold text-white group-hover:text-indigo-200 transition-colors line-clamp-1">
              ${item.title}
            </h3>
            <p class="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">
              ${item.summary}
            </p>
          </div>

          <!-- OpenSpec Artifact Pipeline Indicator Badges -->
          <div class="flex items-center gap-1 pt-1 border-t border-white/[0.05] text-[10px] font-mono">
            <!-- Proposal badge -->
            <span class="px-1.5 py-0.5 rounded flex items-center gap-1 ${item.artifacts.proposal ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'}" title="Proposal artifact">
              <span>P</span>
              <span>${item.artifacts.proposal ? '✓' : '—'}</span>
            </span>

            <!-- Design badge -->
            <span class="px-1.5 py-0.5 rounded flex items-center gap-1 ${item.artifacts.design ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'}" title="Design spec artifact">
              <span>D</span>
              <span>${item.artifacts.design ? '✓' : '—'}</span>
            </span>

            <!-- Spec Delta badge -->
            <span class="px-1.5 py-0.5 rounded flex items-center gap-1 ${item.artifacts.specDeltaCount > 0 ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30' : 'bg-slate-800 text-slate-500'}" title="Spec requirements altered">
              <span>S</span>
              <span>${item.artifacts.specDeltaCount > 0 ? `+${item.artifacts.specDeltaCount}` : '0'}</span>
            </span>

            <!-- Tasks count badge -->
            <span class="px-1.5 py-0.5 rounded flex items-center gap-1 ${item.artifacts.tasksCompleted === item.artifacts.tasksTotal ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}" title="Checklist progress">
              <span>T</span>
              <span>${item.artifacts.tasksCompleted}/${item.artifacts.tasksTotal}</span>
            </span>
          </div>

          <!-- Task progress mini bar -->
          <div class="w-full bg-slate-800/80 rounded-full h-1 overflow-hidden">
            <div class="h-1 rounded-full ${taskPct === 100 ? 'bg-emerald-400' : 'bg-indigo-500'}" style="width: ${taskPct}%"></div>
          </div>

          <!-- Card Footer: Author, Updated, and quick advance -->
          <div class="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
            <div class="flex items-center gap-1.5">
              <span class="w-5 h-5 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-[9px] font-bold text-slate-200">
                ${item.author}
              </span>
              <span class="text-[10px] text-slate-500 font-mono">${item.updated}</span>
            </div>

            <!-- Quick stage move arrow -->
            <button onclick="event.stopPropagation(); advanceChangeStage('${item.id}')" class="p-1 hover:bg-white/[0.08] rounded text-slate-400 hover:text-indigo-300 transition-colors" title="Advance to next OpenSpec stage">
              <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        `;

        colContainer.appendChild(card);
      });

      // Update counters
      document.getElementById('count-col-draft').innerText = counts.draft || 0;
      document.getElementById('count-col-spec').innerText = counts.spec || 0;
      document.getElementById('count-col-progress').innerText = counts.progress || 0;
      document.getElementById('count-col-review').innerText = counts.review || 0;

      // Re-initialize dynamic lucide icons
      lucide.createIcons();
    }

    function renderTable() {
      const tbody = document.getElementById('table-body-rows');
      tbody.innerHTML = '';
      const filtered = getFilteredChanges();

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" class="text-center py-8 text-slate-500 font-mono text-xs">
              No matching OpenSpec changes found for the active filter set.
            </td>
          </tr>
        `;
        return;
      }

      filtered.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-white/[0.03] transition-colors cursor-pointer';
        row.onclick = () => openDetailModal(item.id);

        const statusMap = {
          draft: '<span class="text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded font-mono">Draft</span>',
          spec: '<span class="text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded font-mono border border-indigo-500/20">Spec Delta</span>',
          progress: '<span class="text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded font-mono border border-amber-500/20">In Progress</span>',
          review: '<span class="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-mono border border-emerald-500/20">Review</span>'
        };

        row.innerHTML = `
          <td class="py-3 px-4 font-mono font-medium text-indigo-400 whitespace-nowrap">
            ${item.slug}
          </td>
          <td class="py-3 px-4 max-w-xs">
            <div class="font-semibold text-white truncate">${item.title}</div>
            <div class="text-[11px] text-slate-400 truncate">${item.summary}</div>
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
            ${statusMap[item.status]}
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
            <span class="font-mono text-[11px] text-slate-300">
              P:${item.artifacts.proposal ? '✓' : '—'} D:${item.artifacts.design ? '✓' : '—'}
            </span>
          </td>
          <td class="py-3 px-4 whitespace-nowrap font-mono text-xs ${item.artifacts.specDeltaCount > 0 ? 'text-indigo-400 font-semibold' : 'text-slate-500'}">
            ${item.artifacts.specDeltaCount > 0 ? `+${item.artifacts.specDeltaCount} reqs` : '0'}
          </td>
          <td class="py-3 px-4 whitespace-nowrap font-mono text-xs text-slate-300">
            ${item.artifacts.tasksCompleted}/${item.artifacts.tasksTotal} (${Math.round((item.artifacts.tasksCompleted / item.artifacts.tasksTotal) * 100)}%)
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
            <span class="px-2 py-0.5 rounded bg-white/[0.05] text-[11px] font-mono text-slate-300">${item.domain}</span>
          </td>
          <td class="py-3 px-4 text-right whitespace-nowrap" onclick="event.stopPropagation()">
            <button onclick="advanceChangeStage('${item.id}')" class="p-1 hover:bg-white/[0.08] rounded text-slate-400 hover:text-indigo-300 mr-1" title="Next Stage">
              <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="openDetailModal('${item.id}')" class="p-1 hover:bg-white/[0.08] rounded text-slate-400 hover:text-white" title="Inspect">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i>
            </button>
          </td>
        `;

        tbody.appendChild(row);
      });
      lucide.createIcons();
    }

    function renderSpecsGrid() {
      const container = document.getElementById('specs-directory-grid');
      container.innerHTML = '';

      specsLibrary.forEach(spec => {
        const item = document.createElement('div');
        item.className = 'p-4 rounded-xl border border-white/[0.08] bg-[#121622] hover:border-indigo-500/40 hover:bg-[#151a28] transition-all flex flex-col justify-between gap-3';
        item.innerHTML = `
          <div>
            <div class="flex items-center justify-between text-[11px] font-mono text-indigo-400 mb-1.5">
              <span>${spec.path}</span>
              <span class="text-slate-400 bg-white/[0.05] px-1.5 py-0.5 rounded">${spec.version}</span>
            </div>
            <h3 class="text-sm font-semibold text-white">${spec.name}</h3>
            <p class="text-xs text-slate-400 mt-1">Contains active authoritative requirements & constraints.</p>
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs text-slate-400 font-mono">
            <span>${spec.requirements} strict REQs</span>
            <span class="text-[11px] text-slate-500">${spec.lastTouched}</span>
          </div>
        `;
        container.appendChild(item);
      });
    }

    function advanceChangeStage(id) {
      const stages = ['draft', 'spec', 'progress', 'review'];
      const item = changesData.find(c => c.id === id);
      if (!item) return;

      const currentIndex = stages.indexOf(item.status);
      if (currentIndex < stages.length - 1) {
        item.status = stages[currentIndex + 1];
        showToast(`Moved "${item.slug}" to ${item.status.toUpperCase()}`);
      } else {
        showToast(`"${item.slug}" is ready to be archived into specs!`);
      }
      renderBoard();
      renderTable();
    }

    function moveCurrentChangeStage(newStage) {
      if (!currentSelectedChangeId) return;
      const item = changesData.find(c => c.id === currentSelectedChangeId);
      if (!item) return;

      item.status = newStage;
      document.getElementById('detail-status').innerText = newStage.toUpperCase();
      renderBoard();
      renderTable();
      showToast(`Updated stage to ${newStage.toUpperCase()}`);
    }

    function setViewMode(mode) {
      currentViewMode = mode;
      const boardView = document.getElementById('tab-board-view');
      const tableView = document.getElementById('tab-table-view');
      const btnBoard = document.getElementById('btn-view-board');
      const btnTable = document.getElementById('btn-view-table');

      if (mode === 'board') {
        boardView.classList.remove('hidden');
        tableView.classList.add('hidden');
        btnBoard.className = 'p-1 px-2 rounded text-xs font-medium flex items-center gap-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';
        btnTable.className = 'p-1 px-2 rounded text-xs font-medium flex items-center gap-1.5 text-slate-400 hover:text-slate-200';
      } else {
        boardView.classList.add('hidden');
        tableView.classList.remove('hidden');
        btnTable.className = 'p-1 px-2 rounded text-xs font-medium flex items-center gap-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';
        btnBoard.className = 'p-1 px-2 rounded text-xs font-medium flex items-center gap-1.5 text-slate-400 hover:text-slate-200';
      }
    }

    function switchTab(tab) {
      const tabs = ['board', 'specs', 'archive', 'analytics'];
      tabs.forEach(t => {
        const view = document.getElementById(`tab-${t}-view`);
        const navBtn = document.getElementById(`nav-tab-${t}`);
        if (view) {
          if (t === tab) {
            view.classList.remove('hidden');
          } else {
            view.classList.add('hidden');
          }
        }
        if (navBtn) {
          if (t === tab) {
            navBtn.className = 'px-3.5 py-1 rounded-md text-xs font-medium transition-all text-white bg-indigo-600/30 border border-indigo-500/40 shadow-sm flex items-center gap-1.5';
          } else {
            navBtn.className = 'px-3.5 py-1 rounded-md text-xs font-medium transition-all text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] flex items-center gap-1.5';
          }
        }
      });
      lucide.createIcons();
    }

    function openDetailModal(id) {
      currentSelectedChangeId = id;
      const item = changesData.find(c => c.id === id);
      if (!item) return;

      document.getElementById('detail-slug').innerText = item.slug;
      document.getElementById('detail-domain').innerText = item.domain;
      document.getElementById('detail-status').innerText = item.status.toUpperCase();
      document.getElementById('detail-title').innerText = item.title;
      document.getElementById('detail-desc').innerText = item.summary;
      document.getElementById('detail-spec-delta').innerText = `+${item.artifacts.specDeltaCount} Requirements`;
      document.getElementById('detail-tasks-progress').innerText = `${item.artifacts.tasksCompleted} of ${item.artifacts.tasksTotal} Done`;
      document.getElementById('modal-change-stage-select').value = item.status;
      document.getElementById('detail-cli-cmd').innerText = `openspec change run ${item.slug}`;

      // Render tasks checklist
      const taskList = document.getElementById('detail-tasks-list');
      taskList.innerHTML = '';
      item.tasks.forEach((t, index) => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2.5 p-2 rounded-lg bg-[#141824] border border-white/[0.04] hover:border-white/[0.1]';
        row.innerHTML = `
          <input 
            type="checkbox" 
            ${t.done ? 'checked' : ''} 
            onchange="toggleTask(${index})" 
            class="rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
          />
          <span class="text-xs ${t.done ? 'line-through text-slate-500' : 'text-slate-200'}">${t.text}</span>
        `;
        taskList.appendChild(row);
      });

      document.getElementById('detail-modal').classList.remove('hidden');
      lucide.createIcons();
    }

    function toggleTask(index) {
      if (!currentSelectedChangeId) return;
      const item = changesData.find(c => c.id === currentSelectedChangeId);
      if (!item || !item.tasks[index]) return;

      item.tasks[index].done = !item.tasks[index].done;
      item.artifacts.tasksCompleted = item.tasks.filter(t => t.done).length;

      // Refresh inspector view
      openDetailModal(item.id);
      renderBoard();
      renderTable();
    }

    function closeDetailModal() {
      document.getElementById('detail-modal').classList.add('hidden');
      currentSelectedChangeId = null;
    }

    function openNewChangeDrawer(defaultStatus = 'draft') {
      document.getElementById('drawer-overlay').classList.remove('hidden');
      const drawer = document.getElementById('new-change-drawer');
      drawer.classList.remove('translate-x-full');
      document.getElementById('form-status').value = defaultStatus;
      document.getElementById('form-title').focus();
    }

    function closeNewChangeDrawer() {
      document.getElementById('drawer-overlay').classList.add('hidden');
      document.getElementById('new-change-drawer').classList.add('translate-x-full');
    }

    function handleTitleSlugSync(val) {
      const slug = val.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      document.getElementById('form-slug').value = slug;
      document.getElementById('cli-preview-text').innerText = `openspec new change --id ${slug || 'my-change'}`;
    }

    function selectSchema(element, schemaName) {
      document.querySelectorAll('.schema-option').forEach(el => {
        el.className = 'border border-white/[0.08] hover:border-white/[0.2] bg-white/[0.02] rounded-lg p-2.5 cursor-pointer flex flex-col gap-1 schema-option';
      });
      element.className = 'border border-indigo-500/40 bg-indigo-500/10 rounded-lg p-2.5 cursor-pointer flex flex-col gap-1 schema-option';
      const slug = document.getElementById('form-slug').value || 'my-change';
      document.getElementById('cli-preview-text').innerText = `openspec new change --id ${slug} --schema ${schemaName}`;
    }

    function submitNewChange() {
      const title = document.getElementById('form-title').value.trim();
      const slug = document.getElementById('form-slug').value.trim() || 'new-feature';
      const domain = document.getElementById('form-domain').value;
      const status = document.getElementById('form-status').value;
      const summary = document.getElementById('form-summary').value.trim() || 'New OpenSpec change proposal scaffolded.';

      if (!title) {
        showToast('Please provide a title for the change.', 'rose');
        return;
      }

      const newChange = {
        id: `feat-${slug}`,
        slug: slug,
        title: title,
        summary: summary,
        status: status,
        domain: domain,
        author: 'FL',
        updated: 'Just now',
        artifacts: {
          proposal: true,
          design: false,
          specDeltaCount: 1,
          tasksTotal: 3,
          tasksCompleted: 0
        },
        tasks: [
          { text: 'Draft requirements in proposal.md', done: false },
          { text: 'Verify spec deltas and constraints', done: false },
          { text: 'Run openspec validate suite', done: false }
        ]
      };

      changesData.unshift(newChange);
      closeNewChangeDrawer();
      renderBoard();
      renderTable();
      showToast(`Created OpenSpec change: ${slug}`);

      // Reset form
      document.getElementById('form-title').value = '';
      document.getElementById('form-slug').value = '';
      document.getElementById('form-summary').value = '';
    }

    function openCliModal() {
      document.getElementById('cli-modal').classList.remove('hidden');
    }
    function closeCliModal() {
      document.getElementById('cli-modal').classList.add('hidden');
    }

    function openCommandPalette() {
      const search = document.getElementById('filter-search');
      search.focus();
      search.select();
      showToast('Search & filter focused (⌘K)');
    }

    function toggleTheme() {
      const html = document.documentElement;
      const icon = document.getElementById('theme-icon');
      if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        html.classList.add('light');
        document.body.className = 'bg-[#f8fafc] text-slate-900 font-sans antialiased min-h-screen flex flex-col transition-colors duration-200';
        icon.setAttribute('data-lucide', 'sun');
      } else {
        html.classList.add('dark');
        html.classList.remove('light');
        document.body.className = 'bg-[#090a0f] text-slate-100 font-sans antialiased min-h-screen flex flex-col transition-colors duration-200';
        icon.setAttribute('data-lucide', 'moon');
      }
      lucide.createIcons();
    }

    function copyGeneratedCommand() {
      const text = document.getElementById('cli-preview-text').innerText;
      navigator.clipboard.writeText(text);
      showToast('Copied CLI command to clipboard!');
    }

    function copyText(elementId) {
      const text = document.getElementById(elementId).innerText;
      navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!');
    }

    function showToast(message, color = 'indigo') {
      const container = document.getElementById('toast-box');
      const toast = document.createElement('div');
      toast.className = `p-3 px-4 rounded-xl shadow-xl text-xs font-mono flex items-center gap-2 border bg-[#141824] border-white/[0.1] text-white animate-in slide-in-from-bottom duration-200`;
      toast.innerHTML = `
        <span class="w-2 h-2 rounded-full ${color === 'rose' ? 'bg-rose-400' : 'bg-indigo-400'}"></span>
        <span>${message}</span>
      `;
      container.appendChild(toast);
      setTimeout(() => {
        toast.remove();
      }, 2600);
    }
  </script>
</body>
</html>
