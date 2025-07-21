import { useState } from 'react';
import Layout from '@/components/Layout';
import { getRooms, getRoomDetails } from '@/lib/api';
import useSWR from 'swr';

export default function RoomsPage() {
    const { data, error, mutate } = useSWR('rooms', getRooms, {
        refreshInterval: 10000,
    });

    const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('all');

    // Fetch details for selected room
    const { data: roomDetails, error: roomDetailsError } = useSWR(
        selectedRoom ? `room-${selectedRoom}` : null,
        () => selectedRoom ? getRoomDetails(selectedRoom) : null
    );

    const isLoading = !data && !error;

    // Filter rooms based on search term and type
    const filteredRooms = data?.rooms?.filter((room: any) => {
        const matchesSearch = !searchTerm || room.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || room.type === filterType;
        return matchesSearch && matchesType;
    });

    // Format date for display
    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    // Get badge color based on room type
    const getRoomTypeBadgeClass = (type: string) => {
        switch (type) {
            case 'user':
                return 'bg-blue-100 text-blue-800';
            case 'group':
                return 'bg-green-100 text-green-800';
            case 'system':
                return 'bg-purple-100 text-purple-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <Layout title="Room Management">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Room List */}
                <div className="lg:col-span-1">
                    <div className="card">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="card-title">Rooms</h2>
                            <span className="text-sm text-gray-500">
                                {data?.count || 0} rooms
                            </span>
                        </div>

                        <div className="mb-4 space-y-2">
                            <div className="relative rounded-md shadow-sm">
                                <input
                                    type="text"
                                    className="block w-full rounded-md border-gray-300 pl-3 pr-12 focus:border-primary-500 focus:ring-primary-500 sm:text-sm h-10 border"
                                    placeholder="Search rooms..."
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

                            <div className="flex space-x-2">
                                <button
                                    className={`px-3 py-1 rounded-full text-xs font-medium ${filterType === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-800'
                                        }`}
                                    onClick={() => setFilterType('all')}
                                >
                                    All
                                </button>
                                <button
                                    className={`px-3 py-1 rounded-full text-xs font-medium ${filterType === 'user' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'
                                        }`}
                                    onClick={() => setFilterType('user')}
                                >
                                    User
                                </button>
                                <button
                                    className={`px-3 py-1 rounded-full text-xs font-medium ${filterType === 'group' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800'
                                        }`}
                                    onClick={() => setFilterType('group')}
                                >
                                    Group
                                </button>
                                <button
                                    className={`px-3 py-1 rounded-full text-xs font-medium ${filterType === 'system' ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-800'
                                        }`}
                                    onClick={() => setFilterType('system')}
                                >
                                    System
                                </button>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="text-center py-10">
                                <p className="text-gray-500">Loading rooms...</p>
                            </div>
                        ) : error ? (
                            <div className="text-center py-10">
                                <p className="text-red-500">Error loading rooms</p>
                                <button
                                    className="btn btn-primary mt-4"
                                    onClick={() => mutate()}
                                >
                                    Try Again
                                </button>
                            </div>
                        ) : filteredRooms?.length === 0 ? (
                            <div className="text-center py-10">
                                <p className="text-gray-500">No rooms found</p>
                            </div>
                        ) : (
                            <div className="overflow-y-auto max-h-[600px]">
                                <ul className="divide-y divide-gray-200">
                                    {filteredRooms?.map((room: any) => (
                                        <li
                                            key={room.name}
                                            className={`py-3 px-2 cursor-pointer hover:bg-gray-50 ${selectedRoom === room.name ? 'bg-gray-50' : ''
                                                }`}
                                            onClick={() => setSelectedRoom(room.name)}
                                        >
                                            <div className="flex justify-between items-center">
                                                <div className="truncate">
                                                    <p className="text-sm font-medium text-gray-900 truncate">
                                                        {room.name}
                                                    </p>
                                                    <div className="flex items-center mt-1">
                                                        <span className={`badge ${getRoomTypeBadgeClass(room.type)}`}>
                                                            {room.type}
                                                        </span>
                                                        <span className="ml-2 text-xs text-gray-500">
                                                            {room.memberCount} members
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex-shrink-0">
                                                    <button
                                                        className="text-gray-400 hover:text-gray-500"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedRoom(room.name);
                                                        }}
                                                    >
                                                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="mt-4 flex justify-end">
                            <button
                                className="btn btn-secondary"
                                onClick={() => mutate()}
                            >
                                Refresh
                            </button>
                        </div>
                    </div>
                </div>

                {/* Room Details */}
                <div className="lg:col-span-2">
                    <div className="card h-full">
                        {!selectedRoom ? (
                            <div className="flex flex-col items-center justify-center h-full py-10">
                                <svg className="h-16 w-16 text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <p className="mt-4 text-gray-500">Select a room to view details</p>
                            </div>
                        ) : roomDetails?.error ? (
                            <div className="flex flex-col items-center justify-center h-full py-10">
                                <p className="text-red-500">Error loading room details</p>
                                <button
                                    className="btn btn-primary mt-4"
                                    onClick={() => setSelectedRoom(selectedRoom)}
                                >
                                    Try Again
                                </button>
                            </div>
                        ) : !roomDetails?.room ? (
                            <div className="flex flex-col items-center justify-center h-full py-10">
                                <p className="text-gray-500">Loading room details...</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="card-title">Room Details</h2>
                                    <button
                                        className="text-gray-400 hover:text-gray-500"
                                        onClick={() => setSelectedRoom(null)}
                                    >
                                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500">Room Name</h3>
                                        <p className="mt-1 text-lg font-semibold">{roomDetails.room.name}</p>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500">Type</h3>
                                        <p className="mt-1">
                                            <span className={`badge ${getRoomTypeBadgeClass(roomDetails.room.type)}`}>
                                                {roomDetails.room.type}
                                            </span>
                                        </p>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500">Created At</h3>
                                        <p className="mt-1">{formatDate(roomDetails.room.createdAt)}</p>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500">Member Count</h3>
                                        <p className="mt-1">{roomDetails.room.memberCount}</p>
                                    </div>
                                </div>

                                {roomDetails.room.metadata && Object.keys(roomDetails.room.metadata).length > 0 && (
                                    <div className="mb-6">
                                        <h3 className="text-sm font-medium text-gray-500 mb-2">Metadata</h3>
                                        <div className="bg-gray-50 p-3 rounded-md">
                                            <pre className="text-xs overflow-auto">
                                                {JSON.stringify(roomDetails.room.metadata, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 mb-2">Members</h3>
                                    {roomDetails.room.members.length === 0 ? (
                                        <p className="text-gray-500">No members in this room</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Socket ID
                                                        </th>
                                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            User ID
                                                        </th>
                                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Connected At
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {roomDetails.room.members.map((member: any) => (
                                                        <tr key={member.socketId} className="hover:bg-gray-50">
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                                <span className="font-mono">{member.socketId}</span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                                {member.userId || 'Unknown'}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                                {formatDate(member.connectedAt)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
}