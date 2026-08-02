import type { PipelineRun } from './FileMonitor';
import { X, CheckCircle2, XCircle, Clock, FileText, Database, Coins, AlertTriangle } from 'lucide-react';
import { ReprocessButton } from './ReprocessButton';

const STAGES_ORDER = ['detected', 'downloaded', 'extracted', 'validated', 'routed', 'appended'];

export const FileDetailPanel = ({ run, onClose }: { run: PipelineRun; onClose: () => void }) => {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/80 rounded-t-lg">
        <h3 className="font-semibold text-gray-900 dark:text-white truncate flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-500" />
          {run.fileName}
        </h3>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition-colors text-gray-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {run.status === 'failed' || run.status === 'dead_letter' ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-red-800 dark:text-red-300">Pipeline Failed</h4>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">{run.error?.message || 'Unknown error occurred'}</p>
                  {run.error?.code && (
                    <span className="inline-block mt-2 px-2 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs rounded font-mono">
                      {run.error.code}
                    </span>
                  )}
                  <div className="mt-3 text-xs text-red-500">
                    Attempts: {run.attempts || 1}
                  </div>
                </div>
              </div>
              <ReprocessButton fileId={run.id} />
            </div>
          </div>
        ) : null}

        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Stage Timeline</h4>
          <div className="space-y-3">
            {STAGES_ORDER.map((stageName) => {
              const stageData = run.stages?.[stageName];
              const isPast = !!stageData;
              const isCurrent = run.status === stageName || (stageName === 'extracted' && run.status === 'extracting') || (stageName === 'validated' && run.status === 'validating');
              const isFailed = (run.status === 'failed' || run.status === 'dead_letter') && (!run.stages || Object.keys(run.stages).pop() === stageName || !isPast);
              
              let Icon = Clock;
              let iconColor = 'text-gray-300 dark:text-gray-600';
              if (isPast && !isFailed) { Icon = CheckCircle2; iconColor = 'text-green-500'; }
              if (isFailed && isCurrent) { Icon = XCircle; iconColor = 'text-red-500'; }
              if (isCurrent && !isPast && !isFailed) { Icon = Clock; iconColor = 'text-blue-500 animate-pulse'; }

              return (
                <div key={stageName} className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-6 h-6 shrink-0">
                     <Icon className={`h-5 w-5 ${iconColor}`} />
                  </div>
                  <div className="flex-1 p-2.5 rounded-lg bg-white dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-700/50 shadow-sm flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">{stageName}</span>
                    {stageData?.timestamp && (
                       <time className="text-xs text-gray-500 font-mono">
                         {stageData.timestamp.toDate?.().toLocaleTimeString() || '-'}
                       </time>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {run.extractSummary && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Database className="h-4 w-4" /> Extracted Data
            </h4>
            <div className="bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg p-3 text-sm">
              <dl className="space-y-2">
                {Object.entries(run.extractSummary).map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-zinc-700/50 last:border-0">
                    <dt className="text-gray-500 dark:text-gray-400 font-medium truncate w-1/2 pr-2" title={k}>{k}</dt>
                    <dd className="text-gray-900 dark:text-gray-100 truncate w-1/2 text-right" title={v as string}>{v as string || '-'}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {run.appendedRange && (
               <div className="mt-3 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10 p-2 rounded-lg border border-blue-100 dark:border-blue-900/30">
                 <Database className="h-4 w-4" />
                 <span className="truncate">Appended to: <span className="font-mono">{run.appendedRange}</span></span>
               </div>
            )}
          </div>
        )}

        {run.cost && (
           <div className="mt-6 pt-4 border-t border-gray-200 dark:border-zinc-700">
             <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
               <Coins className="h-4 w-4" /> Run Cost
             </h4>
             <div className="flex gap-4 text-sm">
                <div className="bg-white dark:bg-zinc-800/80 p-3 rounded-lg border border-gray-100 dark:border-zinc-700 flex-1 shadow-sm">
                  <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">Tokens Used</div>
                  <div className="font-medium text-gray-900 dark:text-white font-mono">{run.cost.tokens.toLocaleString()}</div>
                </div>
                <div className="bg-white dark:bg-zinc-800/80 p-3 rounded-lg border border-gray-100 dark:border-zinc-700 flex-1 shadow-sm">
                  <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">Estimated Cost</div>
                  <div className="font-medium text-gray-900 dark:text-white font-mono">${run.cost.estimatedUsd.toFixed(4)}</div>
                </div>
             </div>
           </div>
        )}
      </div>
    </div>
  );
};
