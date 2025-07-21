import axios from 'axios';

// API client with default configuration
const apiClient = axios.create({
    baseURL: '/api',
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add API key if available
if (process.env.NEXT_PUBLIC_API_KEY) {
    apiClient.defaults.headers.common['X-API-Key'] = process.env.NEXT_PUBLIC_API_KEY;
}

// API functions
export async function getServerStatus() {
    const response = await apiClient.get('/status');
    return response.data;
}

export async function getConnections() {
    const response = await apiClient.get('/connections');
    return response.data;
}

export async function getRooms() {
    const response = await apiClient.get('/rooms');
    return response.data;
}

export async function getRoomDetails(roomName: string) {
    const response = await apiClient.get(`/rooms/${encodeURIComponent(roomName)}`);
    return response.data;
}

export async function getLogs(params: { count?: number; level?: string; search?: string; startTime?: string; endTime?: string } = {}) {
    const queryParams = new URLSearchParams();

    if (params.count) queryParams.append('count', params.count.toString());
    if (params.level && params.level !== 'all') queryParams.append('level', params.level);
    if (params.search) queryParams.append('search', params.search);
    if (params.startTime) queryParams.append('startTime', params.startTime);
    if (params.endTime) queryParams.append('endTime', params.endTime);

    const url = `/logs${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiClient.get(url);
    return response.data;
}

export async function sendNotification(userId: string, title: string, message: string, type: 'info' | 'warning' | 'error' = 'info') {
    const response = await apiClient.post('/notify', {
        userId,
        title,
        message,
        type
    });
    return response.data;
}

export async function broadcastMessage(room: string, event: string, payload: any) {
    const response = await apiClient.post('/broadcast', {
        room,
        event,
        payload
    });
    return response.data;
}

export async function pushMessage(userId: string, event: string, payload: any) {
    const response = await apiClient.post('/push', {
        userId,
        event,
        payload
    });
    return response.data;
}

export async function getMetrics() {
    const response = await axios.get('/metrics');
    return response.data;
}

export async function getHealth() {
    const response = await axios.get('/health');
    return response.data;
}