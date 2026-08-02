import { useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, signInWithGoogle, logout, db } from './firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Moon, Sun, LayoutDashboard, LogOut } from 'lucide-react';
import { FileMonitor, type PipelineRun } from './components/FileMonitor';
import { SummaryMetrics } from './components/SummaryMetrics';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { PriceReviewPage } from './pages/PriceReviewPage';
import { LineChart, BarChart3 } from 'lucide-react';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);
  
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'monitor' | 'analytics' | 'reporting'
  >('monitor');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setRuns([]);
      return;
    }
    const collectionName = import.meta.env.VITE_FIRESTORE_COLLECTION || 'pipeline_runs';
    const q = query(collection(db, collectionName), orderBy('detectedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PipelineRun[];
      setRuns(data);
      setRunsLoading(false);
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900 transition-colors duration-300">
        <div className="max-w-md w-full bg-white dark:bg-zinc-800 rounded-lg shadow-md p-8 text-center space-y-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Monitoring Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400">Sign in to access the dashboard</p>
          <button
            onClick={signInWithGoogle}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <header className="bg-white dark:bg-zinc-800 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <LayoutDashboard className="h-6 w-6 text-blue-600" />
              <span className="font-semibold text-lg text-gray-900 dark:text-white mr-6">Monitoring</span>
              
              <nav className="flex space-x-4">
                <button
                  onClick={() => setActiveTab('monitor')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'monitor'
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-zinc-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" /> Monitor
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'analytics'
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-zinc-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <LineChart className="h-4 w-4" /> Analytics
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('reporting')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'reporting'
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-zinc-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Price Review
                  </div>
                </button>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsDark(!isDark)}
                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">{user.email}</span>
                <button
                  onClick={logout}
                  className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors text-red-600 dark:text-red-400"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'monitor' ? (
          <>
            <SummaryMetrics runs={runs} />
            <FileMonitor runs={runs} loading={runsLoading} />
          </>
        ) : activeTab === 'analytics' ? (
          <AnalyticsPage runs={runs} />
        ) : (
          <PriceReviewPage />
        )}
      </main>
    </div>
  );
}

export default App;
