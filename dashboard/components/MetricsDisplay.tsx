import { useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title, BarElement } from 'chart.js';
import { Doughnut, Line, Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title
);

// Define types for metrics data
interface MetricsData {
    // Connection metrics
    activeConnections: number;
    uniqueUsers: number;
    connectionRate: number;
    disconnectionRate: number;

    // Room metrics
    roomCount: number;
    roomsByType: {
        user: number;
        group: number;
        system: number;
        other: number;
    };

    // Message metrics
    messagesPerSecond: number;
    messagesByType: Record<string, number>;
    averageMessageSize: number;
    averageLatency: number;

    // Error metrics
    errorRate: number;
    errorsByType: Record<string, number>;

    // System metrics
    cpuUsage: number;
    memoryUsage: {
        heapTotal: number;
        heapUsed: number;
        rss: number;
        external: number;
    };
    eventLoopLag: number;

    // HTTP metrics
    httpRequestRate: number;
    httpResponseTime: number;
    httpStatusCodes: Record<string, number>;

    // Historical data (last 30 data points)
    history: {
        timestamps: string[];
        connections: number[];
        messages: number[];
        errors: number[];
        latency: number[];
    };
}

interface MetricsDisplayProps {
    metrics: MetricsData;
}

export default function MetricsDisplay({ metrics }: MetricsDisplayProps) {
    const [activeTab, setActiveTab] = useState('overview');

    // Store historical data for charts
    const [connectionHistory, setConnectionHistory] = useState<number[]>([]);
    const [messageHistory, setMessageHistory] = useState<number[]>([]);
    const [errorHistory, setErrorHistory] = useState<number[]>([]);
    const [timeLabels, setTimeLabels] = useState<string[]>([]);

    // Update historical data when new metrics are received
    useEffect(() => {
        if (metrics) {
            const now = new Date();
            const timeLabel = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

            // Update connection history
            setConnectionHistory(prev => {
                const newHistory = [...prev, metrics.activeConnections];
                return newHistory.slice(-20); // Keep last 20 data points
            });

            // Update message history
            setMessageHistory(prev => {
                const newHistory = [...prev, metrics.messagesPerSecond];
                return newHistory.slice(-20);
            });

            // Update error history
            setErrorHistory(prev => {
                const newHistory = [...prev, metrics.errorRate];
                return newHistory.slice(-20);
            });

            // Update time labels
            setTimeLabels(prev => {
                const newLabels = [...prev, timeLabel];
                return newLabels.slice(-20);
            });
        }
    }, [metrics]);

    // Prepare data for room type distribution chart
    const roomTypeData = {
        labels: ['User Rooms', 'Group Rooms', 'System Rooms', 'Other'],
        datasets: [
            {
                data: [
                    metrics?.roomsByType?.user || 0,
                    metrics?.roomsByType?.group || 0,
                    metrics?.roomsByType?.system || 0,
                    metrics?.roomsByType?.other || 0
                ],
                backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#6B7280'],
                borderColor: ['#2563EB', '#059669', '#D97706', '#4B5563'],
                borderWidth: 1,
            },
        ],
    };

    // Prepare data for message types chart
    const messageTypesData = {
        labels: Object.keys(metrics?.messagesByType || {}),
        datasets: [
            {
                label: 'Message Count',
                data: Object.values(metrics?.messagesByType || {}),
                backgroundColor: '#3B82F6',
            },
        ],
    };

    // Prepare data for error types chart
    const errorTypesData = {
        labels: Object.keys(metrics?.errorsByType || {}),
        datasets: [
            {
                label: 'Error Count',
                data: Object.values(metrics?.errorsByType || {}),
                backgroundColor: '#EF4444',
            },
        ],
    };

    // Prepare data for HTTP status codes chart
    const httpStatusData = {
        labels: Object.keys(metrics?.httpStatusCodes || {}),
        datasets: [
            {
                label: 'Status Code Count',
                data: Object.values(metrics?.httpStatusCodes || {}),
                backgroundColor: [
                    '#10B981', // 2xx - Green
                    '#F59E0B', // 3xx - Yellow
                    '#EF4444', // 4xx - Red
                    '#6B7280', // 5xx - Gray
                ],
            },
        ],
    };

    // Prepare data for historical charts
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

    const messageHistoryData = {
        labels: timeLabels,
        datasets: [
            {
                label: 'Messages Per Second',
                data: messageHistory,
                fill: false,
                borderColor: '#10B981',
                tension: 0.1,
            },
        ],
    };

    const errorHistoryData = {
        labels: timeLabels,
        datasets: [
            {
                label: 'Error Rate',
                data: errorHistory,
                fill: false,
                borderColor: '#EF4444',
                tension: 0.1,
            },
        ],
    };

    // Format bytes to human-readable format
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Format milliseconds to human-readable format
    const formatMs = (ms: number) => {
        if (ms < 1) return (ms * 1000).toFixed(2) + ' μs';
        if (ms < 1000) return ms.toFixed(2) + ' ms';
        return (ms / 1000).toFixed(2) + ' s';
    };

    return (
        <div className="metrics-display">
            {/* Tabs for different metric categories */}
            <div className="mb-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    <button
                        className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview'
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        onClick={() => setActiveTab('overview')}
                    >
                        Overview
                    </button>
                    <button
                        className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'connections'
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        onClick={() => setActiveTab('connections')}
                    >
                        Connections
                    </button>
                    <button
                        className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'messages'
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        onClick={() => setActiveTab('messages')}
                    >
                        Messages
                    </button>
                    <button
                        className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'errors'
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        onClick={() => setActiveTab('errors')}
                    >
                        Errors
                    </button>
                    <button
                        className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'system'
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        onClick={() => setActiveTab('system')}
                    >
                        System
                    </button>
                    <button
                        className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'http'
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        onClick={() => setActiveTab('http')}
                    >
                        HTTP
                    </button>
                </nav>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Key Metrics Card */}
                    <div className="card col-span-1 md:col-span-2 lg:col-span-3">
                        <h2 className="card-title">Key Metrics</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <p className="text-sm text-blue-600">Active Connections</p>
                                <p className="text-2xl font-bold">{metrics?.activeConnections || 0}</p>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg">
                                <p className="text-sm text-green-600">Messages/sec</p>
                                <p className="text-2xl font-bold">{(metrics?.messagesPerSecond || 0).toFixed(2)}</p>
                            </div>
                            <div className="bg-yellow-50 p-4 rounded-lg">
                                <p className="text-sm text-yellow-600">Avg Latency</p>
                                <p className="text-2xl font-bold">{formatMs(metrics?.averageLatency || 0)}</p>
                            </div>
                            <div className="bg-red-50 p-4 rounded-lg">
                                <p className="text-sm text-red-600">Error Rate</p>
                                <p className="text-2xl font-bold">{(metrics?.errorRate || 0).toFixed(2)}/min</p>
                            </div>
                        </div>
                    </div>

                    {/* Connection History Chart */}
                    <div className="card">
                        <h2 className="card-title">Connection History</h2>
                        <div className="h-64">
                            <Line
                                data={connectionHistoryData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        title: {
                                            display: true,
                                            text: 'Active Connections'
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

                    {/* Message History Chart */}
                    <div className="card">
                        <h2 className="card-title">Message Rate</h2>
                        <div className="h-64">
                            <Line
                                data={messageHistoryData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        title: {
                                            display: true,
                                            text: 'Messages Per Second'
                                        }
                                    },
                                    scales: {
                                        y: {
                                            beginAtZero: true
                                        }
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {/* Room Distribution Chart */}
                    <div className="card">
                        <h2 className="card-title">Room Distribution</h2>
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
                </div>
            )}

            {/* Connections Tab */}
            {activeTab === 'connections' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Connection Stats */}
                    <div className="card">
                        <h2 className="card-title">Connection Statistics</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-blue-50 p-4 rounded-lg">
                                    <p className="text-sm text-blue-600">Active Connections</p>
                                    <p className="text-2xl font-bold">{metrics?.activeConnections || 0}</p>
                                </div>
                                <div className="bg-green-50 p-4 rounded-lg">
                                    <p className="text-sm text-green-600">Unique Users</p>
                                    <p className="text-2xl font-bold">{metrics?.uniqueUsers || 0}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-yellow-50 p-4 rounded-lg">
                                    <p className="text-sm text-yellow-600">Connection Rate</p>
                                    <p className="text-2xl font-bold">{(metrics?.connectionRate || 0).toFixed(2)}/min</p>
                                </div>
                                <div className="bg-red-50 p-4 rounded-lg">
                                    <p className="text-sm text-red-600">Disconnection Rate</p>
                                    <p className="text-2xl font-bold">{(metrics?.disconnectionRate || 0).toFixed(2)}/min</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Connection History Chart */}
                    <div className="card">
                        <h2 className="card-title">Connection History</h2>
                        <div className="h-64">
                            <Line
                                data={connectionHistoryData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        title: {
                                            display: true,
                                            text: 'Active Connections'
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

                    {/* Room Stats */}
                    <div className="card">
                        <h2 className="card-title">Room Statistics</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div>
                                    <p className="text-sm text-gray-500">Total Rooms</p>
                                    <p className="text-xl font-bold">{metrics?.roomCount || 0}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Avg. Users/Room</p>
                                    <p className="text-xl font-bold">
                                        {(metrics?.roomCount || 0) > 0
                                            ? ((metrics?.activeConnections || 0) / (metrics?.roomCount || 1)).toFixed(1)
                                            : 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Room Types</p>
                                    <p className="text-xl font-bold">4</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Room Distribution Chart */}
                    <div className="card">
                        <h2 className="card-title">Room Distribution</h2>
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
                </div>
            )}

            {/* Messages Tab */}
            {activeTab === 'messages' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Message Stats */}
                    <div className="card">
                        <h2 className="card-title">Message Statistics</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-50 p-4 rounded-lg">
                                    <p className="text-sm text-green-600">Messages/sec</p>
                                    <p className="text-2xl font-bold">{(metrics?.messagesPerSecond || 0).toFixed(2)}</p>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-lg">
                                    <p className="text-sm text-blue-600">Avg Message Size</p>
                                    <p className="text-2xl font-bold">{formatBytes(metrics?.averageMessageSize || 0)}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-yellow-50 p-4 rounded-lg">
                                    <p className="text-sm text-yellow-600">Avg Latency</p>
                                    <p className="text-2xl font-bold">{formatMs(metrics?.averageLatency || 0)}</p>
                                </div>
                                <div className="bg-purple-50 p-4 rounded-lg">
                                    <p className="text-sm text-purple-600">Message Types</p>
                                    <p className="text-2xl font-bold">{Object.keys(metrics?.messagesByType || {}).length}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Message Rate Chart */}
                    <div className="card">
                        <h2 className="card-title">Message Rate</h2>
                        <div className="h-64">
                            <Line
                                data={messageHistoryData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        title: {
                                            display: true,
                                            text: 'Messages Per Second'
                                        }
                                    },
                                    scales: {
                                        y: {
                                            beginAtZero: true
                                        }
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {/* Message Types Chart */}
                    <div className="card md:col-span-2">
                        <h2 className="card-title">Message Types</h2>
                        <div className="h-80">
                            <Bar
                                data={messageTypesData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        title: {
                                            display: true,
                                            text: 'Messages by Event Type'
                                        },
                                        legend: {
                                            display: false
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
                </div>
            )}

            {/* Errors Tab */}
            {activeTab === 'errors' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Error Stats */}
                    <div className="card">
                        <h2 className="card-title">Error Statistics</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-red-50 p-4 rounded-lg">
                                    <p className="text-sm text-red-600">Error Rate</p>
                                    <p className="text-2xl font-bold">{(metrics?.errorRate || 0).toFixed(2)}/min</p>
                                </div>
                                <div className="bg-yellow-50 p-4 rounded-lg">
                                    <p className="text-sm text-yellow-600">Error Types</p>
                                    <p className="text-2xl font-bold">{Object.keys(metrics?.errorsByType || {}).length}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Error Rate Chart */}
                    <div className="card">
                        <h2 className="card-title">Error Rate</h2>
                        <div className="h-64">
                            <Line
                                data={errorHistoryData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        title: {
                                            display: true,
                                            text: 'Error Rate'
                                        }
                                    },
                                    scales: {
                                        y: {
                                            beginAtZero: true
                                        }
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {/* Error Types Chart */}
                    <div className="card md:col-span-2">
                        <h2 className="card-title">Error Types</h2>
                        <div className="h-80">
                            <Bar
                                data={errorTypesData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        title: {
                                            display: true,
                                            text: 'Errors by Type'
                                        },
                                        legend: {
                                            display: false
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
                </div>
            )}

            {/* System Tab */}
            {activeTab === 'system' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* System Stats */}
                    <div className="card">
                        <h2 className="card-title">System Resources</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-blue-50 p-4 rounded-lg">
                                    <p className="text-sm text-blue-600">CPU Usage</p>
                                    <p className="text-2xl font-bold">{(metrics?.cpuUsage || 0).toFixed(1)}%</p>
                                </div>
                                <div className="bg-green-50 p-4 rounded-lg">
                                    <p className="text-sm text-green-600">Event Loop Lag</p>
                                    <p className="text-2xl font-bold">{formatMs(metrics?.eventLoopLag || 0)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Memory Usage */}
                    <div className="card">
                        <h2 className="card-title">Memory Usage</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-purple-50 p-4 rounded-lg">
                                    <p className="text-sm text-purple-600">Heap Used</p>
                                    <p className="text-2xl font-bold">{formatBytes(metrics?.memoryUsage?.heapUsed || 0)}</p>
                                </div>
                                <div className="bg-yellow-50 p-4 rounded-lg">
                                    <p className="text-sm text-yellow-600">Heap Total</p>
                                    <p className="text-2xl font-bold">{formatBytes(metrics?.memoryUsage?.heapTotal || 0)}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-indigo-50 p-4 rounded-lg">
                                    <p className="text-sm text-indigo-600">RSS</p>
                                    <p className="text-2xl font-bold">{formatBytes(metrics?.memoryUsage?.rss || 0)}</p>
                                </div>
                                <div className="bg-pink-50 p-4 rounded-lg">
                                    <p className="text-sm text-pink-600">External</p>
                                    <p className="text-2xl font-bold">{formatBytes(metrics?.memoryUsage?.external || 0)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Memory Usage Chart */}
                    <div className="card md:col-span-2">
                        <h2 className="card-title">Memory Usage Breakdown</h2>
                        <div className="h-64">
                            <Bar
                                data={{
                                    labels: ['Heap Used', 'Heap Total', 'RSS', 'External'],
                                    datasets: [
                                        {
                                            label: 'Memory (MB)',
                                            data: [
                                                (metrics?.memoryUsage?.heapUsed || 0) / (1024 * 1024),
                                                (metrics?.memoryUsage?.heapTotal || 0) / (1024 * 1024),
                                                (metrics?.memoryUsage?.rss || 0) / (1024 * 1024),
                                                (metrics?.memoryUsage?.external || 0) / (1024 * 1024)
                                            ],
                                            backgroundColor: [
                                                '#8B5CF6', // Purple
                                                '#F59E0B', // Yellow
                                                '#3B82F6', // Blue
                                                '#EC4899'  // Pink
                                            ],
                                        },
                                    ],
                                }}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        title: {
                                            display: true,
                                            text: 'Memory Usage (MB)'
                                        }
                                    },
                                    scales: {
                                        y: {
                                            beginAtZero: true
                                        }
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* HTTP Tab */}
            {activeTab === 'http' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* HTTP Stats */}
                    <div className="card">
                        <h2 className="card-title">HTTP Statistics</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-blue-50 p-4 rounded-lg">
                                    <p className="text-sm text-blue-600">Request Rate</p>
                                    <p className="text-2xl font-bold">{(metrics?.httpRequestRate || 0).toFixed(2)}/sec</p>
                                </div>
                                <div className="bg-green-50 p-4 rounded-lg">
                                    <p className="text-sm text-green-600">Avg Response Time</p>
                                    <p className="text-2xl font-bold">{formatMs(metrics?.httpResponseTime || 0)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* HTTP Status Codes */}
                    <div className="card">
                        <h2 className="card-title">HTTP Status Codes</h2>
                        <div className="h-64">
                            <Doughnut
                                data={httpStatusData}
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

                    {/* HTTP Status Codes Table */}
                    <div className="card md:col-span-2">
                        <h2 className="card-title">HTTP Status Codes Breakdown</h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Status Code
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Description
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Count
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Percentage
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {Object.entries(metrics?.httpStatusCodes || {}).map(([code, count]) => {
                                        const total = Object.values(metrics?.httpStatusCodes || {}).reduce((a, b) => a + b, 0);
                                        const percentage = total > 0 ? (count / total) * 100 : 0;

                                        let description = '';
                                        let colorClass = '';

                                        if (code.startsWith('2')) {
                                            description = 'Success';
                                            colorClass = 'text-green-600';
                                        } else if (code.startsWith('3')) {
                                            description = 'Redirection';
                                            colorClass = 'text-yellow-600';
                                        } else if (code.startsWith('4')) {
                                            description = 'Client Error';
                                            colorClass = 'text-red-600';
                                        } else if (code.startsWith('5')) {
                                            description = 'Server Error';
                                            colorClass = 'text-gray-600';
                                        }

                                        return (
                                            <tr key={code} className="hover:bg-gray-50">
                                                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${colorClass}`}>
                                                    {code}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {description}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {count}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {percentage.toFixed(1)}%
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}