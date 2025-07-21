import { useState, useEffect } from 'react';
import { getLogs } from '@/lib/api';
import useSWR from 'swr';

// Define log entry type
export interface LogEntry {
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug' | 'trace';
    message: string;
    context?: string;
    meta?: Record<string, any>;
}

// Props for the LogViewer component
interface LogViewerProps {
    initialCount?: number;
    autoRefresh?: boolean;
    defaultLevel?: string;
    defaultSearch?: string;
}

export default function LogViewer({
    initialCount = 100,
    autoRefresh = true,
    defaultLevel = 'all',
    defaultSearch = '',
}: LogViewerProps) {
    // State for filtering and pagination
    const [logCount, setLogCount] = useState(initialCount);
    const [logLevel, setLogLevel] = useState(defaultLevel);
    const [searchTerm, setSearchTerm] = useState(defaultSearch);
    const [isAutoRefresh, setIsAutoRefresh] = useState(autoRefresh);
    const [dateRange, setDateRange] = useState<{ startTime?: string; endTime?: string }>({});
    const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

    // Fetch logs with SWR for real-time updates
    const { data, error, mutate } = useSWR(
        ['logs', logCount, logLevel, searchTerm, dateRange],
        () => getLogs({
            count: logCount,
            level: logLevel,
            search: searchTerm,
            startTime: dateRange.startTime,
            endTime: dateRange.endTime
        }),
        {
            refreshInterval: isAutoRefresh ? 5000 : 0,
        }
    );

    // Toggle expanded state for a log entry
    const toggleExpand = (index: number) => {
        setExpandedLogs(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    // Get log level badge color
    const getLogLevelBadge = (level: string) => {
        switch (level) {
            case 'info':
                return 'bg-blue-100 text-blue-800';
            case 'warn':
                return 'bg-yellow-100 text-yellow-800';
            case 'error':
                return 'bg-red-100 text-red-800';
            case 'debug':
                return 'bg-gray-100 text-gray-800';
            case 'trace':
                return 'bg-purple-100 text-purple-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    // Format date for display
    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    // Format log content for display
    const formatLogContent = (log: LogEntry) => {
        // Remove common fields for display
        const { timestamp, level, message, context, ...rest } = log;

        // Check if there's additional data to display
        if (Object.keys(rest).length === 0 && !context) {
            return null;
        }

        const output: Record<string, any> = {};
        if (context) output.context = context;
        if (Object.keys(rest).length > 0) output.meta = rest;

        return JSON.stringify(output, null, 2);
    };

    // Handle date range changes
    const handleDateRangeChange = (type: 'start' | 'end', value: string) => {
        setDateRange(prev => ({
            ...prev,
            [type === 'start' ? 'startTime' : 'endTime']: value
        }));
    };

    // Clear all filters
    const clearFilters = () => {
        setLogLevel('all');
        setSearchTerm('');
        setDateRange({});
    };

    const isLoading = !data && !error;
    const logs = data?.logs || [];

    return (
        <div className="log-viewer">
            <div className="mb-6 flex flex-col space-y-4">
                {/* Search and filters row */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative rounded-md shadow-sm flex-grow">
                        <input
                            type="text"
                            className="block w-full rounded-md border-gray-300 pl-3 pr-12 focus:border-primary-500 focus:ring-primary-500 sm:text-sm h-10 border"
                            placeholder="Search logs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                className="absolute inset-y-0 right-0 flex items-center pr-3"
                                onClick={() => setSearchTerm('')}
                                aria-label="Clear search"
                            >
                                <span className="text-gray-400 hover:text-gray-500">✕</span>
                            </button>
                        )}
                    </div>

                    <select
                        className="rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm h-10 border"
                        value={logLevel}
                        onChange={(e) => setLogLevel(e.target.value)}
                        aria-label="Filter by log level"
                    >
                        <option value="all">All Levels</option>
                        <option value="info">Info</option>
                        <option value="warn">Warning</option>
                        <option value="error">Error</option>
                        <option value="debug">Debug</option>
                        <option value="trace">Trace</option>
                    </select>

                    <select
                        className="rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm h-10 border"
                        value={logCount}
                        onChange={(e) => setLogCount(Number(e.target.value))}
                        aria-label="Number of logs to display"
                    >
                        <option value="50">Last 50</option>
                        <option value="100">Last 100</option>
                        <option value="200">Last 200</option>
                        <option value="500">Last 500</option>
                    </select>
                </div>

                {/* Date range filters */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2">
                        <label htmlFor="start-date" className="text-sm text-gray-600">From:</label>
                        <input
                            id="start-date"
                            type="datetime-local"
                            className="rounded-md border-gray-300 py-2 pl-3 pr-3 text-base focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm h-10 border"
                            value={dateRange.startTime || ''}
                            onChange={(e) => handleDateRangeChange('start', e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <label htmlFor="end-date" className="text-sm text-gray-600">To:</label>
                        <input
                            id="end-date"
                            type="datetime-local"
                            className="rounded-md border-gray-300 py-2 pl-3 pr-3 text-base focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm h-10 border"
                            value={dateRange.endTime || ''}
                            onChange={(e) => handleDateRangeChange('end', e.target.value)}
                        />
                    </div>

                    {(searchTerm || logLevel !== 'all' || dateRange.startTime || dateRange.endTime) && (
                        <button
                            className="text-sm text-gray-500 hover:text-gray-700 underline"
                            onClick={clearFilters}
                        >
                            Clear filters
                        </button>
                    )}
                </div>

                {/* Auto-refresh and manual refresh controls */}
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <input
                            id="auto-refresh"
                            type="checkbox"
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            checked={isAutoRefresh}
                            onChange={(e) => setIsAutoRefresh(e.target.checked)}
                        />
                        <label htmlFor="auto-refresh" className="text-sm text-gray-600">
                            Auto-refresh every 5 seconds
                        </label>
                    </div>

                    <button
                        className="btn btn-secondary"
                        onClick={() => mutate()}
                    >
                        Refresh Now
                    </button>
                </div>
            </div>

            {/* Log display */}
            {isLoading ? (
                <div className="text-center py-10">
                    <p className="text-gray-500">Loading logs...</p>
                </div>
            ) : error ? (
                <div className="text-center py-10">
                    <p className="text-red-500">Error loading logs</p>
                    <button
                        className="btn btn-primary mt-4"
                        onClick={() => mutate()}
                    >
                        Try Again
                    </button>
                </div>
            ) : logs.length === 0 ? (
                <div className="text-center py-10">
                    <p className="text-gray-500">No logs found matching your criteria</p>
                </div>
            ) : (
                <div className="bg-white shadow-md rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Time
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Level
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Message
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Details
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {logs.map((log: LogEntry, index: number) => (
                                    <tr key={index} className={`hover:bg-gray-50 ${log.level === 'error' ? 'bg-red-50' : ''}`}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatDate(log.timestamp)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`badge ${getLogLevelBadge(log.level)}`}>
                                                {log.level}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            {log.message}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {formatLogContent(log) && (
                                                <details
                                                    className="cursor-pointer"
                                                    open={expandedLogs[index]}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        toggleExpand(index);
                                                    }}
                                                >
                                                    <summary className="text-primary-600 hover:text-primary-800">
                                                        {expandedLogs[index] ? 'Hide Details' : 'View Details'}
                                                    </summary>
                                                    {expandedLogs[index] && (
                                                        <pre className="mt-2 text-xs overflow-auto bg-gray-50 p-2 rounded">
                                                            {formatLogContent(log)}
                                                        </pre>
                                                    )}
                                                </details>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}