import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LogViewer from '../LogViewer';
import { getLogs } from '@/lib/api';
import { SWRConfig } from 'swr';

// Mock the API module
jest.mock('@/lib/api', () => ({
    getLogs: jest.fn(),
}));

// Mock data for testing
const mockLogs = {
    logs: [
        {
            timestamp: '2023-01-01T12:00:00Z',
            level: 'info',
            message: 'Server started',
            context: 'system',
        },
        {
            timestamp: '2023-01-01T12:01:00Z',
            level: 'warn',
            message: 'Connection attempt failed',
            context: 'connection',
            meta: { userId: '123', reason: 'timeout' },
        },
        {
            timestamp: '2023-01-01T12:02:00Z',
            level: 'error',
            message: 'Database connection error',
            context: 'database',
            error: { code: 'ECONNREFUSED' },
        },
    ],
    count: 3,
};

describe('LogViewer Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getLogs as jest.Mock).mockResolvedValue(mockLogs);
    });

    it('renders the log viewer with logs', async () => {
        render(
            <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
                <LogViewer initialCount={100} autoRefresh={false} />
            </SWRConfig>
        );

        // Wait for logs to load
        await waitFor(() => {
            expect(getLogs).toHaveBeenCalledWith({
                count: 100,
                level: 'all',
                search: '',
                startTime: undefined,
                endTime: undefined,
            });
        });

        // Check if logs are displayed
        expect(screen.getByText('Server started')).toBeInTheDocument();
        expect(screen.getByText('Connection attempt failed')).toBeInTheDocument();
        expect(screen.getByText('Database connection error')).toBeInTheDocument();
    });

    it('filters logs by level', async () => {
        (getLogs as jest.Mock).mockImplementation((params) => {
            if (params.level === 'error') {
                return {
                    logs: [mockLogs.logs[2]],
                    count: 1,
                };
            }
            return mockLogs;
        });

        render(
            <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
                <LogViewer initialCount={100} autoRefresh={false} />
            </SWRConfig>
        );

        // Wait for initial logs to load
        await waitFor(() => {
            expect(screen.getByText('Database connection error')).toBeInTheDocument();
        });

        // Change log level to error
        fireEvent.change(screen.getByLabelText('Filter by log level'), { target: { value: 'error' } });

        // Wait for filtered logs
        await waitFor(() => {
            expect(getLogs).toHaveBeenCalledWith(expect.objectContaining({
                level: 'error',
            }));
        });
    });

    it('searches logs by text', async () => {
        (getLogs as jest.Mock).mockImplementation((params) => {
            if (params.search === 'connection') {
                return {
                    logs: [mockLogs.logs[1]],
                    count: 1,
                };
            }
            return mockLogs;
        });

        render(
            <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
                <LogViewer initialCount={100} autoRefresh={false} />
            </SWRConfig>
        );

        // Wait for initial logs to load
        await waitFor(() => {
            expect(screen.getByText('Connection attempt failed')).toBeInTheDocument();
        });

        // Search for "connection"
        fireEvent.change(screen.getByPlaceholderText('Search logs...'), { target: { value: 'connection' } });

        // Wait for filtered logs
        await waitFor(() => {
            expect(getLogs).toHaveBeenCalledWith(expect.objectContaining({
                search: 'connection',
            }));
        });
    });

    it('toggles auto-refresh', async () => {
        render(
            <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
                <LogViewer initialCount={100} autoRefresh={true} />
            </SWRConfig>
        );

        // Wait for logs to load
        await waitFor(() => {
            expect(getLogs).toHaveBeenCalled();
        });

        // Auto-refresh should be enabled by default
        expect(screen.getByLabelText('Auto-refresh every 5 seconds')).toBeChecked();

        // Disable auto-refresh
        fireEvent.click(screen.getByLabelText('Auto-refresh every 5 seconds'));
        expect(screen.getByLabelText('Auto-refresh every 5 seconds')).not.toBeChecked();
    });

    it('shows log details when expanded', async () => {
        render(
            <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
                <LogViewer initialCount={100} autoRefresh={false} />
            </SWRConfig>
        );

        // Wait for logs to load
        await waitFor(() => {
            expect(getLogs).toHaveBeenCalled();
        });

        // Find the "View Details" button for the second log (which has metadata)
        const viewDetailsButtons = screen.getAllByText('View Details');
        expect(viewDetailsButtons.length).toBeGreaterThan(0);

        // Click to expand details
        fireEvent.click(viewDetailsButtons[1]);

        // Check if details are shown
        await waitFor(() => {
            expect(screen.getByText(/"userId": "123"/)).toBeInTheDocument();
            expect(screen.getByText(/"reason": "timeout"/)).toBeInTheDocument();
        });
    });

    it('changes the number of logs displayed', async () => {
        render(
            <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
                <LogViewer initialCount={100} autoRefresh={false} />
            </SWRConfig>
        );

        // Wait for logs to load
        await waitFor(() => {
            expect(getLogs).toHaveBeenCalledWith(expect.objectContaining({
                count: 100,
            }));
        });

        // Change log count to 200
        fireEvent.change(screen.getByLabelText('Number of logs to display'), { target: { value: '200' } });

        // Wait for updated logs
        await waitFor(() => {
            expect(getLogs).toHaveBeenCalledWith(expect.objectContaining({
                count: 200,
            }));
        });
    });

    it('handles date range filtering', async () => {
        render(
            <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
                <LogViewer initialCount={100} autoRefresh={false} />
            </SWRConfig>
        );

        // Wait for logs to load
        await waitFor(() => {
            expect(getLogs).toHaveBeenCalled();
        });

        // Set start date
        const startDate = '2023-01-01T00:00';
        fireEvent.change(screen.getByLabelText('From:'), { target: { value: startDate } });

        // Wait for updated logs
        await waitFor(() => {
            expect(getLogs).toHaveBeenCalledWith(expect.objectContaining({
                startTime: startDate,
            }));
        });

        // Set end date
        const endDate = '2023-01-02T00:00';
        fireEvent.change(screen.getByLabelText('To:'), { target: { value: endDate } });

        // Wait for updated logs
        await waitFor(() => {
            expect(getLogs).toHaveBeenCalledWith(expect.objectContaining({
                startTime: startDate,
                endTime: endDate,
            }));
        });
    });

    it('handles error state', async () => {
        (getLogs as jest.Mock).mockRejectedValue(new Error('Failed to fetch logs'));

        render(
            <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
                <LogViewer initialCount={100} autoRefresh={false} />
            </SWRConfig>
        );

        // Wait for error state
        await waitFor(() => {
            expect(screen.getByText('Error loading logs')).toBeInTheDocument();
        });

        // Try again button should be visible
        expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('handles empty logs state', async () => {
        (getLogs as jest.Mock).mockResolvedValue({ logs: [], count: 0 });

        render(
            <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
                <LogViewer initialCount={100} autoRefresh={false} />
            </SWRConfig>
        );

        // Wait for empty state
        await waitFor(() => {
            expect(screen.getByText('No logs found matching your criteria')).toBeInTheDocument();
        });
    });
});