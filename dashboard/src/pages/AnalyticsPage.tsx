import { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { type PipelineRun } from '../components/FileMonitor';
import { AIChatPanel } from '../components/AIChatPanel';
import { MessageSquare } from 'lucide-react';

export function AnalyticsPage(
  { runs, isDark }: { runs: PipelineRun[]; isDark: boolean }
) {
  const axisColor = isDark ? '#9ca3af' : '#6b7280';
  const gridColor = isDark ? '#3f3f46' : '#e5e7eb';
  const [selectedMetric, setSelectedMetric] = useState<string>('Cu LME');
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Parse and average ranges like "47,500 - 46,500" or just "47,500"
  const parseValue = (val: string) => {
    if (!val) return 0;
    const cleanStr = val.replace(/,/g, '').trim();
    if (cleanStr.includes('-')) {
      const parts = cleanStr.split('-').map(p => parseFloat(p.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return (parts[0] + parts[1]) / 2;
      }
    }
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
  };

  const chartData = useMemo(() => {
    const validRuns = runs
      .filter(r => r.status === 'appended' && r.extractSummary && r.extractSummary[selectedMetric])
      .sort((a, b) => a.detectedAt.seconds - b.detectedAt.seconds);

    const dates = validRuns.map(r => new Date(r.detectedAt.seconds * 1000).toLocaleDateString());
    const values = validRuns.map(r => parseValue(r.extractSummary![selectedMetric]));

    return { dates, values };
  }, [runs, selectedMetric]);

  const allMetrics = useMemo(() => {
    const metrics = new Set<string>();
    runs.forEach(r => {
      if (r.extractSummary) {
        Object.keys(r.extractSummary).forEach(k => metrics.add(k));
      }
    });
    return Array.from(metrics).sort();
  }, [runs]);

  const options = {
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: chartData.dates,
      axisLabel: { color: axisColor }, // zinc-400
      axisLine: { lineStyle: { color: gridColor } }, // zinc-700
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: axisColor },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: [
      {
        data: chartData.values,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: { color: '#2563eb' }, // blue-600
        lineStyle: { color: '#2563eb', width: 3 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(37, 99, 235, 0.4)' },
              { offset: 1, color: 'rgba(37, 99, 235, 0.0)' }
            ]
          }
        }
      }
    ],
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true }
  };

  // Provide some context based on selected metric for the chat
  const contextText = `User is looking at the chart for metric: ${selectedMetric}. There are ${chartData.values.length} data points available.`;

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="flex justify-between items-center bg-white dark:bg-zinc-800 p-4 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Select Metric:
          </label>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {allMetrics.length === 0 && <option value="Cu LME">Cu LME</option>}
            {allMetrics.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setIsChatOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm"
        >
          <MessageSquare className="w-4 h-4" /> Ask AI Assistant
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm p-6 border border-zinc-200 dark:border-zinc-700">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">{selectedMetric} Trends</h3>
        <ReactECharts
          option={options}
          style={{ height: 400, width: '100%' }}
        />
      </div>

      <AIChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        contextText={contextText}
      />
    </div>
  );
}
