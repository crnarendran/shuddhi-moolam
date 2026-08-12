import { useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, signInWithGoogle, logout, db } from './firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import {
  Moon, Sun, LayoutDashboard, LogOut, BarChart3, TrendingUp, MessageSquare,
  Calculator, Shuffle, Settings, Lightbulb,
} from 'lucide-react';
import { FileMonitor, type PipelineRun } from './components/FileMonitor';
import { SummaryMetrics } from './components/SummaryMetrics';
import { PriceReviewPage } from './pages/PriceReviewPage';
import { SeasonalPage } from './pages/SeasonalPage';
import { CostImpactPage } from './pages/CostImpactPage';
import { SpreadsPage } from './pages/SpreadsPage';
import { SettingsSection } from './components/SettingsSection';
import { GuidancePage } from './pages/GuidancePage';
import { SubTabs, type SubTab } from './components/SubTabs';
import { AIChatPanel } from './components/AIChatPanel';
import { toCanonicalPriceRecord, type PriceRecord } from './lib/reporting';

// Top-level sections keep the primary nav to three items (no scroll).
type Section = 'reports' | 'monitor' | 'settings';
type Report =
  | 'price-review' | 'seasonal' | 'cost-impact' | 'spreads' | 'guidance';

const SECTIONS: { id: Section; label: string; icon: typeof BarChart3 }[] = [
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'monitor', label: 'Monitor', icon: LayoutDashboard },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// Guidance leads — it's the default landing report under Reports.
const REPORT_TABS: SubTab<Report>[] = [
  { id: 'guidance', label: 'Guidance', icon: Lightbulb },
  { id: 'price-review', label: 'Price Review', icon: BarChart3 },
  { id: 'seasonal', label: 'Seasonal', icon: TrendingUp },
  { id: 'cost-impact', label: 'Cost Impact', icon: Calculator },
  { id: 'spreads', label: 'Spreads', icon: Shuffle },
];
const REPORT_IDS = REPORT_TABS.map((t) => t.id) as Report[];
const DEFAULT_REPORT: Report = 'guidance';

// Hash is `#<section>[/<sub>]`, e.g. `#reports/seasonal`, `#settings`.
const parseHash = (): { section: Section; report: Report } => {
  const [base, sub] = window.location.hash.replace('#', '').split('/');
  if (base === 'monitor') return { section: 'monitor', report: DEFAULT_REPORT };
  if (base === 'settings') {
    return { section: 'settings', report: DEFAULT_REPORT };
  }
  const report = REPORT_IDS.includes(sub as Report)
    ? (sub as Report)
    : DEFAULT_REPORT;
  return { section: 'reports', report };
};

const HISTORICAL =
  import.meta.env.VITE_HISTORICAL_COLLECTION || 'historical_prices';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [records, setRecords] = useState<PriceRecord[]>([]);
  const [route, setRoute] = useState(parseHash);
  const { section, report } = route;
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // The URL hash is the source of truth for navigation (survives refresh,
  // shareable). Keep component state in sync with it.
  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // Normalise an empty hash to the default report so deep-links are stable.
  useEffect(() => {
    if (!window.location.hash) window.location.hash = `reports/${DEFAULT_REPORT}`;
  }, []);

  const goToSection = (id: Section) => {
    window.location.hash = id === 'reports' ? `reports/${report}` : id;
  };
  const goToReport = (id: Report) => {
    window.location.hash = `reports/${id}`;
  };

  useEffect(() => {
    if (!user) {
      setRuns([]);
      return;
    }
    const collectionName =
      import.meta.env.VITE_FIRESTORE_COLLECTION || 'pipeline_runs';
    const q = query(
      collection(db, collectionName), orderBy('detectedAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setRuns(snapshot.docs.map((doc) => ({
        id: doc.id, ...doc.data(),
      })) as PipelineRun[]);
      setRunsLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!user) {
      setRecords([]);
      return;
    }
    return onSnapshot(collection(db, HISTORICAL), (snap) => {
      // Normalize Rs/tonne commodities to canonical Rs/kg at load (SM-40).
      setRecords(snap.docs.map(
        (d) => toCanonicalPriceRecord(d.data() as PriceRecord)
      ));
    });
  }, [user]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100">Loading...</div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900 transition-colors duration-300">
        <div className="max-w-md w-full bg-white dark:bg-zinc-800 rounded-lg shadow-md p-8 text-center space-y-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Metals Price Dashboard</h1>
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

  const hasChat = section === 'reports' && report !== 'guidance';
  const viewName =
    section === 'monitor' ? 'Pipeline monitor'
      : section === 'settings' ? 'Settings'
        : report === 'seasonal' ? 'Seasonal analysis'
          : report === 'cost-impact' ? 'Cost impact analysis'
            : report === 'spreads' ? 'Spread monitor'
              : report === 'guidance' ? 'Purchasing guidance'
                : 'Price Review';
  const chatContext =
    `The user is viewing the ${viewName} of the metals price dashboard. ` +
    'Answer only from the available extracted newsletter price data; if the ' +
    'data does not cover something, say so.';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <header className="bg-white dark:bg-zinc-800 shadow-sm print:hidden">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2 min-w-0">
              <LayoutDashboard className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <span className="font-semibold text-lg text-gray-900 dark:text-white mr-6 hidden sm:inline">Metals Prices</span>
              <nav className="flex space-x-1 sm:space-x-4">
                {SECTIONS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => goToSection(id)}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap flex-shrink-0 ${
                      section === id
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-zinc-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" /> {label}
                    </div>
                  </button>
                ))}
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
                <span className="text-sm font-medium hidden sm:inline">{user.email}</span>
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
        {/* Print-only document header so a saved PDF is self-describing. */}
        <div className="hidden print:block mb-4 pb-3 border-b border-zinc-300">
          <div className="text-lg font-semibold">
            Shuddhi-Moolam — {viewName}
          </div>
          <div className="text-xs text-zinc-500">
            Generated {new Date().toLocaleString()}
          </div>
        </div>
        {section === 'monitor' ? (
          <>
            <SummaryMetrics runs={runs} />
            <FileMonitor runs={runs} loading={runsLoading} />
          </>
        ) : section === 'settings' ? (
          <SettingsSection records={records} />
        ) : (
          <div className="flex flex-col gap-6">
            <SubTabs tabs={REPORT_TABS} active={report} onSelect={goToReport} />
            {report === 'seasonal' ? (
              <SeasonalPage records={records} isDark={isDark} />
            ) : report === 'cost-impact' ? (
              <CostImpactPage records={records} isDark={isDark} />
            ) : report === 'spreads' ? (
              <SpreadsPage records={records} isDark={isDark} />
            ) : report === 'guidance' ? (
              <GuidancePage records={records} isDark={isDark} />
            ) : (
              <PriceReviewPage records={records} isDark={isDark} />
            )}
          </div>
        )}
      </main>

      {hasChat && !isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="print:hidden fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-lg transition-colors"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="hidden sm:inline font-medium">Ask AI</span>
        </button>
      )}
      <div className="print:hidden">
        <AIChatPanel
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          contextText={chatContext}
        />
      </div>
    </div>
  );
}

export default App;
