import { useEffect, useState } from 'react';
import { getServerStatus } from '@/lib/api';
import useSWR from 'swr';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title } from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title);

export default function ConnectionStats() {
    const { data: status, error } = useSWR('status', getServerStatus, {
        refreshInterval: 5000,
    });

    // Store historical data for charts
    const [connectionHistory, setConnectionHistory] = useState<number[]>([]);
    const [timeLabels, setTimeLabels] = useState<string[]>([]);

    // Update historical data when new status is received
    useEffect(() => {
        if (status) {
            const now = new Date();
            const timeLabel = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

            setConnectionHistory(prev => {
                const newHistory = [...prev, status.activeConnections];
                // Keep only the last 20 data points
                return newHistory.slice(-20);
            });

            setTimeLabels(prev => {
                const newLabels = [...prev, timeLabel];
                // Keep only the last 20 labels
                return newLabels.slice(-20);
            });
        }
    }, [status]);

    // Prepare data for room type distribution chart
    const roomTypeData = {
        labels: ['User Rooms', 'Group Rooms', 'System Rooms'],
        datasets: [
            {
                data: status ? [status.rooms.user, status.rooms.group, status.rooms.system] : [0, 0, 0],
                backgroundColor: ['#3B82F6', '#10B981', '#F59E0B'],
                borderColor: ['#2563EB', '#059669', '#D97706'],
                borderWidth: 1,
            },
        ],
    };

    // Prepare data for connection history chart
    const connectionHistoryData = {
        labels: timeLabels,
        datasets: [
            {
                label: 'Active Connections',
                data: connectionHistory,
                fill: false,
                borderColor: '#3B82F6',
                tension: 0.1,
            },
        ],
    };

    const isLoading = !status && !error;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
                <h2 className="card-title">Connection Overview</h2>
                {isLoading ? (
                    <p>Loading...</p>
                ) : error ? (
                    <p className="text-red-500">Error loading data</p>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <p className="text-sm text-blue-600">Active Connections</p>
                                <p className="text-2xl font-bold">{status.activeConnections}</p>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg">
                                <p className="text-sm text-green-600">Unique Users</p>
                                <p className="text-2xl font-bold">{status.uniqueUsers}</p>
                            </div>
                        </div>

                        <div className="h-64">
                            <Line
                                data={connectionHistoryData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        title: {
                                            display: true,
                                            text: 'Connection History'
                                        }
                                    },
                                    scales: {
                                        y: {
                                            beginAtZero: true,
                                            ticks: {
                                                precision: 0
                                            }
                                        }
                                    }
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="card">
                <h2 className="card-title">Room Distribution</h2>
                {isLoading ? (
                    <p>Loading...</p>
                ) : error ? (
                    <p className="text-red-500">Error loading data</p>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                                <p className="text-sm text-gray-500">Total Rooms</p>
                                <p className="text-xl font-bold">{status.rooms.total}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Avg. Users/Room</p>
                                <p className="text-xl font-bold">
                                    {status.rooms.total > 0
                                        ? (status.activeConnections / status.rooms.total).toFixed(1)
                                        : 'N/A'}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Room Types</p>
                                <p className="text-xl font-bold">{Object.keys(status.rooms).length - 1}</p>
                            </div>
                        </div>

                        <div className="h-64 flex items-center justify-center">
                            <div className="w-48 h-48">
                                <Doughnut
                                    data={roomTypeData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: {
                                                position: 'bottom'
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}