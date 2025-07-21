import { useState } from 'react';
import Layout from '@/components/Layout';
import ConnectionStats from '@/components/ConnectionStats';
import { getConnections } from '@/lib/api';
import useSWR from 'swr';

export default function ConnectionsPage() {
    const { data, error, mutate } = useSWR('connections', getConnections, {
        refreshInterval: 5000,
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [filterBy, setFilterBy] = useState('userId');

    const isLoading = !data && !error;

    // Filter connections based on search term
    const filteredConnections = data?.connections?.filter((conn: any) => {
        if (!searchTerm) return true;

        const searchValue = String(conn[filterBy] || '').toLowerCase();
        return searchValue.includes(searchTerm.toLowerCase());
    });

    // Format date for display
    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    // Calculate time since last activity
    const getTimeSinceLastActivity = (lastActivity: string) => {
        if (!lastActivity) return 'N/A';

        const lastActivityTime = new Date(lastActivity).getTime();
        const now = Date.now();
        const diffSeconds = Math.floor((now - lastActivityTime) / 1000);

        if (diffSeconds < 60) {
            return `${diffSeconds}s ago`;
        } else if (diffSeconds < 3600) {
            return `${Math.floor(diffSeconds / 60)}m ago`;
        } else if (diffSeconds < 86400) {
            return `${Math.floor(diffSeconds / 3600)}h ago`;
        } else {
            return `${Math.floor(diffSeconds / 86400)}d ago`;
        }
    };

    return (
        <Layout title="Active Connections">
            {/* Connection Stats Component */}
            <div className="mb-8">
                <ConnectionStats />
            </div>

            <h2 className="text-xl font-semibold mb-4">Connection List</h2>

            <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-2">
                    <div className="relative rounded-md shadow-sm">
                        <input
                            type="text"
                            className="block w-full rounded-md border-gray-300 pl-3 pr-12 focus:border-primary-500 focus:ring-primary-500 sm:text-sm h-10 border"
                            placeholder="Search connections..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                className="absolute inset-y-0 right-0 flex items-center pr-3"
                                onClick={() => setSearchTerm('')}
                            >
                                <span className="text-gray-400 hover:text-gray-500">✕</span>
                            </button>
                        )}
                    </div>

                    <select
                        className="rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm h-10 border"
                        value={filterBy}
                        onChange={(e) => setFilterBy(e.target.value)}
                    >
                        <option value="userId">User ID</option>
                        <option value="socketId">Socket ID</option>
                        <option value="ip">IP Address</option>
                        <option value="userAgent">User Agent</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                        {data?.count || 0} connections
                    </span>
                    <button
                        className="btn btn-secondary"
                        onClick={() => mutate()}
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-10">
                    <p className="text-gray-500">Loading connections...</p>
                </div>
            ) : error ? (
                <div className="text-center py-10">
                    <p className="text-red-500">Error loading connections</p>
                    <button
                        className="btn btn-primary mt-4"
                        onClick={() => mutate()}
                    >
                        Try Again
                    </button>
                </div>
            ) : filteredConnections?.length === 0 ? (
                <div className="text-center py-10">
                    <p className="text-gray-500">No connections found</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    User ID
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Socket ID
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    IP Address
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Connected At
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Last Activity
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    User Agent
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredConnections?.map((connection: any) => (
                                <tr key={connection.socketId} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {connection.userId}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className="font-mono">{connection.socketId}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {connection.ip}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {formatDate(connection.connectedAt)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span title={formatDate(connection.lastActivity)}>
                                            {getTimeSinceLastActivity(connection.lastActivity)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">
                                        {connection.userAgent}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Layout>
    );
}