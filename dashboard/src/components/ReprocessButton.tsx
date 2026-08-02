import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { RefreshCw } from 'lucide-react';

export const ReprocessButton = ({ fileId }: { fileId: string }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleReprocess = async () => {
    if (!window.confirm("Reprocess this file?")) return;
    
    setLoading(true);
    setError(null);
    try {
      const reprocessFn = httpsCallable<{ fileId: string }, any>(functions, 'reprocessPendingPdf');
      await reprocessFn({ fileId });
    } catch (err: any) {
      setError(err.message || 'Failed to reprocess file');
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col items-end relative">
      <button
        onClick={handleReprocess}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Reprocessing...' : 'Reprocess'}
      </button>
      {error && (
        <div className="absolute top-full mt-2 right-0 bg-red-100 text-red-700 px-3 py-1.5 rounded text-sm whitespace-nowrap shadow-sm border border-red-200 z-50">
          {error}
        </div>
      )}
    </div>
  );
};
