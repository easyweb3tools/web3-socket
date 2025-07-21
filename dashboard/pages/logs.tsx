import { useState } from 'react';
import Layout from '@/components/Layout';
import LogViewer from '@/components/LogViewer';

export default function LogsPage() {
    // State for log viewer settings
    const [viewMode, setViewMode] = useState<'standard' | 'compact'>('standard');

    return (
        <Layout title="Log Viewer">
            <div className="mb-4 flex justify-end">
                <div className="inline-flex rounded-md shadow-sm" role="group">
                    <button
                        type="button"
                        className={`px-4 py-2 text-sm font-medium rounded-l-lg ${viewMode === 'standard'
                                ? 'bg-primary-700 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                        onClick={() => setViewMode('standard')}
                    >
                        Standard View
                    </button>
                    <button
                        type="button"
                        className={`px-4 py-2 text-sm font-medium rounded-r-lg ${viewMode === 'compact'
                                ? 'bg-primary-700 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                        onClick={() => setViewMode('compact')}
                    >
                        Compact View
                    </button>
                </div>
            </div>

            {/* Log viewer component with real-time updates */}
            <div className={viewMode === 'compact' ? 'text-sm' : ''}>
                <LogViewer
                    initialCount={100}
                    autoRefresh={true}
                />
            </div>

            <div className="mt-6 text-sm text-gray-500">
                <h3 className="font-medium mb-2">About the Log Viewer</h3>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Logs are automatically refreshed every 5 seconds when auto-refresh is enabled</li>
                    <li>Filter logs by level, search text, or date range</li>
                    <li>Click "View Details" to see additional log metadata</li>
                    <li>Use the date range filters to narrow down logs to a specific time period</li>
                </ul>
            </div>
        </Layout>
    );
}