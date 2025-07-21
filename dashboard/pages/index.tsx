import { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { getServerStatus, getHealth } from '@/lib/api';
import useSWR from 'swr';

export default function Home() {
    const { data: status, error: statusError, mutate: refreshStatus } = useSWR(
        'status',
        getServerStatus,
        { refreshInterval: 5000 }
    );

    const { data: health, error: healthError } = useSWR(
        'health',
        getHealth,
        { refreshInterval: 10000 }
    );

    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    useEffect(() => {
        if (status) {
            setLastRefresh(new Date());
        }
    }, [status]);

    const isLoading = !status && !statusError;
    const isError = statusError || healthError;

    return (
        <Layout title="Dashboard Overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Server Status Card */}
                <div className="card">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="card-title">Server Status</h2>
                        <span className={`badge ${health?.status === 'ok' ? 'badge-success' : 'badge-error'}`}>
                            {health?.status === 'ok' ? 'Healthy' : 'Unhealthy'}
                        </span>
                    </div>

                    {isLoading ? (
                        <p>Loading server status...</p>
                    ) : isError ? (
                        <p className="text-red-500">Error loading server status</p>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Uptime:</span>
                                <span className="font-medium">{formatUptime(status.uptime)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Environment:</span>
                                <span className="font-medium">{status.environment || 'development'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Version:</span>
                                <span className="font-medium">{status.version || '1.0.0'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Last Updated:</span>
                                <span className="font-medium">{lastRefresh.toLocaleTimeString()}</span>
                            </div>
                        </div>
                    )}

                    <button
                        className="btn btn-secondary mt-4 w-full"
                        onClick={() => refreshStatus()}
                    >
                        Refresh
                    </button>
                </div>

                {/* Connection Stats Card */}
                <div className="card">
                    <h2 className="card-title">Connection Stats</h2>

                    {isLoading ? (
                        <p>Loading connection stats...</p>
                    ) : isError ? (
                        <p className="text-red-500">Error loading connection stats</p>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Active Connections:</span>
                                <span className="font-medium">{status.activeConnections}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Unique Users:</span>
                                <span className="font-medium">{status.uniqueUsers}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Connection Ratio:</span>
                                <span className="font-medium">
                                    {status.uniqueUsers > 0
                                        ? (status.activeConnections / status.uniqueUsers).toFixed(2)
                                        : 'N/A'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Room Stats Card */}
                <div className="card">
                    <h2 className="card-title">Room Stats</h2>

                    {isLoading ? (
                        <p>Loading room stats...</p>
                    ) : isError ? (
                        <p className="text-red-500">Error loading room stats</p>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Total Rooms:</span>
                                <span className="font-medium">{status.rooms.total}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">User Rooms:</span>
                                <span className="font-medium">{status.rooms.user}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Group Rooms:</span>
                                <span className="font-medium">{status.rooms.group}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">System Rooms:</span>
                                <span className="font-medium">{status.rooms.system}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-8">
                <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Link href="/connections" className="btn btn-primary text-center">
                        View All Connections
                    </Link>
                    <Link href="/rooms" className="btn btn-primary text-center">
                        View All Rooms
                    </Link>
                    <Link href="/logs" className="btn btn-primary text-center">
                        View Logs
                    </Link>
                </div>
            </div>
        </Layout>
    );
}

function formatUptime(seconds: number): string {
    if (!seconds) return 'Unknown';

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}