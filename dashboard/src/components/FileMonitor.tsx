import { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Search, Filter, AlertCircle, AlertTriangle, FileText, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { FileDetailPanel } from './FileDetailPanel';

export type PipelineStatus = 'detected' | 'downloaded' | 'extracting' | 'extracted' | 'validating' | 'routing' | 'appended' | 'failed' | 'dead_letter';

export interface PipelineRun {
  id: string;
  fileName: string;
  detectedAt: Timestamp;
  status: PipelineStatus;
  year?: number;
  durationMs?: number;
  attempts: number;
  stages: Record<string, any>;
  extractSummary?: Record<string, string>;
  appendedRange?: string;
  error?: {
    message: string;
    code?: string;
  };
  cost?: {
    tokens?: number;
    estimatedUsd?: number;
  };
  gemini?: {
    tokensIn?: number;
    tokensOut?: number;
    thinkingTokens?: number;
    totalTokens?: number;
    estCostUsd?: number;
  };
  targetTab?: string;
  qualityOutliers?: {
    key: string;
    label: string;
    value: number;
    baseline: number;
    deviationPct: number;
  }[];
}

const getStatusConfig = (status: PipelineStatus) => {
  switch (status) {
    case 'detected': return { color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', icon: Clock, animate: false };
    case 'downloaded': return { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: Clock, animate: false };
    case 'extracting': return { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: Loader2, animate: true };
    case 'extracted': return { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: Clock, animate: false };
    case 'validating': return { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: Loader2, animate: true };
    case 'routing': return { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: Loader2, animate: true };
    case 'appended': return { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle2, animate: false };
    case 'failed': return { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: XCircle, animate: false };
    case 'dead_letter': return { color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', icon: AlertCircle, animate: false };
    default: return { color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', icon: Clock, animate: false };
  }
};

const formatTimeAgo = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const formatDuration = (ms?: number) => {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

type StatusFilter = 'all' | 'attention' | 'in_progress' | 'completed';

const IN_PROGRESS_STATUSES: PipelineStatus[] = [
  'detected', 'downloaded', 'extracting', 'extracted', 'validating', 'routing',
];

const STATUS_FILTERS: { id: StatusFilter, label: string }[] = [
  { id: 'all', label: 'All files' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
];

const matchesStatusFilter = (
  status: PipelineStatus, filter: StatusFilter,
): boolean => {
  switch (filter) {
    case 'attention': return status === 'failed' || status === 'dead_letter';
    case 'in_progress': return IN_PROGRESS_STATUSES.includes(status);
    case 'completed': return status === 'appended';
    default: return true;
  }
};

export const FileMonitor = ({ runs, loading }: { runs: PipelineRun[], loading: boolean }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<PipelineRun | null>(null);

  useEffect(() => {
    if (selectedRun) {
      const updated = runs.find(r => r.id === selectedRun.id);
      if (updated) setSelectedRun(updated);
    }
  }, [runs, selectedRun]);

  const filteredRuns = runs.filter(run =>
    (run.fileName?.toLowerCase() || "").includes(search.toLowerCase()) &&
    matchesStatusFilter(run.status, statusFilter)
  );

  const failedCount = runs.filter(r => r.status === 'failed' || r.status === 'dead_letter').length;

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-6 relative overflow-hidden">
      <div className={`flex-1 flex flex-col bg-white dark:bg-zinc-800/80 shadow-sm rounded-lg overflow-hidden transition-all duration-300 border border-gray-200 dark:border-zinc-700 ${selectedRun ? 'md:mr-[35%]' : ''}`}>
        
        {failedCount > 0 && (
          <button
            onClick={() => setStatusFilter(
              statusFilter === 'attention' ? 'all' : 'attention'
            )}
            className="w-full text-left bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-4 py-3 text-sm font-medium flex items-center gap-2 border-b border-red-100 dark:border-red-900/30 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            <AlertCircle className="h-4 w-4" />
            {failedCount} files need attention
            <span className="ml-auto text-xs font-normal opacity-80">
              {statusFilter === 'attention' ? 'show all' : 'view'}
            </span>
          </button>
        )}

        <div className="p-4 border-b border-gray-200 dark:border-zinc-700 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-800/30">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search files..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 transition-shadow shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setFilterOpen((o) => !o)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors font-medium ${
                statusFilter !== 'all'
                  ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700'
              }`}
            >
              <Filter className="h-4 w-4" />
              {statusFilter === 'all'
                ? 'Filters'
                : STATUS_FILTERS.find((f) => f.id === statusFilter)?.label}
            </button>
            {filterOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setFilterOpen(false)}
                />
                <div className="absolute right-0 mt-1 z-20 w-48 rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg py-1">
                  {STATUS_FILTERS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => { setStatusFilter(f.id); setFilterOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-100 dark:hover:bg-zinc-700 ${
                        statusFilter === f.id
                          ? 'text-blue-700 dark:text-blue-300 font-medium'
                          : 'text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {f.label}
                      {statusFilter === f.id && <CheckCircle2 className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading...
            </div>
          ) : filteredRuns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="bg-gray-100 dark:bg-zinc-700 p-4 rounded-full mb-4">
                <FileText className="h-8 w-8 text-gray-400 dark:text-gray-500" />
              </div>
              {runs.length > 0 ? (
                <>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No matching files</h3>
                  <p className="text-gray-500 dark:text-gray-400 max-w-sm text-sm">
                    No files match the current search or filter.
                    {(search || statusFilter !== 'all') && (
                      <button
                        onClick={() => { setSearch(''); setStatusFilter('all'); }}
                        className="ml-1 text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Clear filters
                      </button>
                    )}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No files processed yet</h3>
                  <p className="text-gray-500 dark:text-gray-400 max-w-sm text-sm">
                    Drop a PDF into the watched Drive folder and it'll appear here automatically.
                  </p>
                </>
              )}
            </div>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm text-gray-600 dark:text-gray-400">
              <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-zinc-800/80 sticky top-0 z-10 border-b border-gray-200 dark:border-zinc-700">
                <tr>
                  <th className="px-6 py-3 font-semibold">File</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Detected</th>
                  <th className="px-6 py-3 font-semibold">Year → Tab</th>
                  <th className="px-6 py-3 font-semibold">Duration</th>
                  <th className="px-6 py-3 font-semibold">Attempts</th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map((run) => {
                  const statusConf = getStatusConfig(run.status);
                  const Icon = statusConf.icon;
                  const isSelected = selectedRun?.id === run.id;
                  
                  return (
                    <tr 
                      key={run.id}
                      onClick={() => setSelectedRun(run)}
                      className={`border-b border-gray-100 dark:border-zinc-700/50 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-zinc-700/50'}`}
                    >
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="truncate max-w-xs">{run.fileName}</span>
                        {run.qualityOutliers && run.qualityOutliers.length > 0 && (
                          <span
                            title={`${run.qualityOutliers.length} value(s) look off vs recent weeks — check details`}
                            className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 text-xs font-normal">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {run.qualityOutliers.length}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium gap-1.5 border border-transparent ${statusConf.color}`}>
                          <Icon className={`h-3 w-3 ${statusConf.animate ? 'animate-spin' : ''}`} />
                          <span className="capitalize">{run.status.replace('_', ' ')}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {run.detectedAt ? formatTimeAgo(typeof run.detectedAt.toDate === 'function' ? run.detectedAt.toDate() : new Date(run.detectedAt as any)) : '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                        {run.year ? `${run.year} → ${run.targetTab || run.year}` : '-' }
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400 font-mono text-xs">
                        {formatDuration(run.durationMs)}
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                        {run.attempts || 1}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      
      <div className={`absolute top-0 right-0 h-full w-full md:w-[33%] bg-white dark:bg-zinc-800 shadow-2xl rounded-lg border border-gray-200 dark:border-zinc-700 transform transition-transform duration-300 ease-in-out z-20 ${selectedRun ? 'translate-x-0' : 'translate-x-[110%]'}`}>
        {selectedRun && (
          <FileDetailPanel run={selectedRun} onClose={() => setSelectedRun(null)} />
        )}
      </div>
    </div>
  );
};
