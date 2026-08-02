import type { PipelineRun } from './FileMonitor';
import { Activity, CheckCircle, Clock, Coins } from 'lucide-react';

export const SummaryMetrics = ({ runs }: { runs: PipelineRun[] }) => {
  const total = runs.length;
  const processed = runs.filter(r => r.status === 'appended').length;
  const successRate = total > 0 ? Math.round((processed / total) * 100) : 0;
  
  const completedRuns = runs.filter(r => r.status === 'appended' && r.durationMs);
  const avgLatency = completedRuns.length > 0 
    ? Math.round(completedRuns.reduce((acc, r) => acc + (r.durationMs || 0), 0) / completedRuns.length)
    : 0;
    
  const totalCost = runs.reduce((acc, r) => acc + (r.cost?.estimatedUsd || 0), 0);

  const formatDuration = (ms: number) => {
    if (ms === 0) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-5 border border-gray-200 dark:border-zinc-700 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Processed</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">{processed}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-full">
          <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
      </div>
      
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-5 border border-gray-200 dark:border-zinc-700 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Success Rate</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">{successRate}%</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-full">
          <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-lg p-5 border border-gray-200 dark:border-zinc-700 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Latency</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">{formatDuration(avgLatency)}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-full">
          <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-lg p-5 border border-gray-200 dark:border-zinc-700 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Cost</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">${totalCost.toFixed(4)}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-full">
          <Coins className="h-6 w-6 text-purple-600 dark:text-purple-400" />
        </div>
      </div>
    </div>
  );
};
