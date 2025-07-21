import { useState } from 'react';
import Layout from '@/components/Layout';
import { getMetrics } from '@/lib/api';
import useSWR from 'swr';
import MetricsDisplay from '@/components/MetricsDisplay';

export default function MetricsPage() {
    const [refreshInterval, setRefreshInterval] = useState(10000); // 10 seconds default

    // Fetch metrics data with SWR for real-time updates
    const { data, error, mutate } = useSWR('metrics', getMetrics, {
        refreshInterval,
    });

    const isLoading = !data && !error;

    // Handle refresh interval change
    const handleRefreshIntervalChange = (interval: number) => {
        setRefreshInterval(interval);
    };

    return (
        <Layout title="System Metrics">
            <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold">Real-time System Metrics</h2>
                    <p className="text-sm text-gray-500">
                        Monitor the performance and health of your Socket.IO server
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <label htmlFor="refresh-interval" className="text-sm text-gray-600">
                            Refresh every:
                        </label>
                        <select
                            id="refresh-interval"
                            className="rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm h-10 border"
                            value={refreshInterval}
                            onChange={(e) => handleRefreshIntervalChange(Number(e.target.value))}
                        >
                            <option value={5000}>5 seconds</option>
                            <option value={10000}>10 seconds</option>
                            <option value={30000}>30 seconds</option>
                            <option value={60000}>1 minute</option>
                            <option value={0}>Manual refresh</option>
                        </select>
                    </div>

                    <button
                        className="btn btn-secondary"
                        onClick={() => mutate()}
                    >
                        Refresh Now
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-10">
                    <p className="text-gray-500">Loading metrics...</p>
                </div>
            ) : error ? (
                <div className="text-center py-10">
                    <p className="text-red-500">Error loading metrics</p>
                    <button
                        className="btn btn-primary mt-4"
                        onClick={() => mutate()}
                    >
                        Try Again
                    </button>
                </div>
            ) : (
                <MetricsDisplay metrics={data} />
            )}
        </Layout>
    );
}