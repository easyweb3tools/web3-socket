import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MetricsDisplay from '../MetricsDisplay';

// Mock Chart.js to avoid canvas rendering issues in tests
jest.mock('chart.js', () => ({
    Chart: {
        register: jest.fn(),
    },
    ArcElement: jest.fn(),
    Tooltip: jest.fn(),
    Legend: jest.fn(),
    CategoryScale: jest.fn(),
    LinearScale: jest.fn(),
    PointElement: jest.fn(),
    LineElement: jest.fn(),
    Title: jest.fn(),
    BarElement: jest.fn(),
}));

// Mock react-chartjs-2 components
jest.mock('react-chartjs-2', () => ({
    Doughnut: () => <div data-testid="mock-doughnut-chart">Doughnut Chart</div>,
    Line: () => <div data-testid="mock-line-chart">Line Chart</div>,
    Bar: () => <div data-testid="mock-bar-chart">Bar Chart</div>,
}));

// Mock metrics data
const mockMetrics = {
    // Connection metrics
    activeConnections: 125,
    uniqueUsers: 87,
    connectionRate: 5.2,
    disconnectionRate: 4.8,

    // Room metrics
    roomCount: 42,
    roomsByType: {
        user: 25,
        group: 10,
        system: 5,
        other: 2
    },

    // Message metrics
    messagesPerSecond: 34.5,
    messagesByType: {
        'chat:message': 1250,
        'user:typing': 850,
        'notification': 320,
        'status:update': 180
    },
    averageMessageSize: 512,
    averageLatency: 45.2,

    // Error metrics
    errorRate: 0.8,
    errorsByType: {
        'connection': 12,
        'authentication': 8,
        'timeout': 5,
        'validation': 3
    },

    // System metrics
    cpuUsage: 24.5,
    memoryUsage: {
        heapTotal: 67108864, // 64 MB
        heapUsed: 33554432,  // 32 MB
        rss: 83886080,       // 80 MB
        external: 10485760   // 10 MB
    },
    eventLoopLag: 2.3,

    // HTTP metrics
    httpRequestRate: 12.3,
    httpResponseTime: 85.6,
    httpStatusCodes: {
        '200': 1250,
        '201': 320,
        '400': 45,
        '401': 12,
        '404': 8,
        '500': 3
    },

    // Historical data
    history: {
        timestamps: ['12:00', '12:01', '12:02', '12:03', '12:04'],
        connections: [100, 105, 110, 115, 125],
        messages: [30, 32, 31, 35, 34.5],
        errors: [0.5, 0.6, 0.7, 0.8, 0.8],
        latency: [40, 42, 45, 44, 45.2]
    }
};

describe('MetricsDisplay Component', () => {
    it('renders the metrics display with tabs', () => {
        render(<MetricsDisplay metrics={mockMetrics} />);

        // Check if tabs are rendered
        expect(screen.getByText('Overview')).toBeInTheDocument();
        expect(screen.getByText('Connections')).toBeInTheDocument();
        expect(screen.getByText('Messages')).toBeInTheDocument();
        expect(screen.getByText('Errors')).toBeInTheDocument();
        expect(screen.getByText('System')).toBeInTheDocument();
        expect(screen.getByText('HTTP')).toBeInTheDocument();
    });

    it('displays key metrics in the overview tab', () => {
        render(<MetricsDisplay metrics={mockMetrics} />);

        // Check if key metrics are displayed
        expect(screen.getByText('Active Connections')).toBeInTheDocument();
        expect(screen.getByText('125')).toBeInTheDocument();
        expect(screen.getByText('Messages/sec')).toBeInTheDocument();
        expect(screen.getByText('34.50')).toBeInTheDocument();
        expect(screen.getByText('Avg Latency')).toBeInTheDocument();
        expect(screen.getByText('Error Rate')).toBeInTheDocument();
        expect(screen.getByText('0.80/min')).toBeInTheDocument();
    });

    it('switches between tabs when clicked', () => {
        render(<MetricsDisplay metrics={mockMetrics} />);

        // Initially on Overview tab
        expect(screen.getByText('Key Metrics')).toBeInTheDocument();

        // Click on Connections tab
        fireEvent.click(screen.getByText('Connections'));
        expect(screen.getByText('Connection Statistics')).toBeInTheDocument();
        expect(screen.getByText('87')).toBeInTheDocument(); // Unique users

        // Click on Messages tab
        fireEvent.click(screen.getByText('Messages'));
        expect(screen.getByText('Message Statistics')).toBeInTheDocument();

        // Click on Errors tab
        fireEvent.click(screen.getByText('Errors'));
        expect(screen.getByText('Error Statistics')).toBeInTheDocument();

        // Click on System tab
        fireEvent.click(screen.getByText('System'));
        expect(screen.getByText('System Resources')).toBeInTheDocument();
        expect(screen.getByText('24.5%')).toBeInTheDocument(); // CPU usage

        // Click on HTTP tab
        fireEvent.click(screen.getByText('HTTP'));
        expect(screen.getByText('HTTP Statistics')).toBeInTheDocument();
        expect(screen.getByText('12.30/sec')).toBeInTheDocument(); // Request rate
    });

    it('formats bytes correctly', () => {
        render(<MetricsDisplay metrics={mockMetrics} />);

        // Go to Messages tab to see formatted bytes
        fireEvent.click(screen.getByText('Messages'));
        expect(screen.getByText('512 Bytes')).toBeInTheDocument(); // Avg message size

        // Go to System tab to see formatted memory
        fireEvent.click(screen.getByText('System'));
        expect(screen.getByText('32 MB')).toBeInTheDocument(); // Heap used
        expect(screen.getByText('64 MB')).toBeInTheDocument(); // Heap total
    });

    it('formats milliseconds correctly', () => {
        render(<MetricsDisplay metrics={mockMetrics} />);

        // Go to Messages tab to see formatted milliseconds
        fireEvent.click(screen.getByText('Messages'));
        expect(screen.getByText('45.20 ms')).toBeInTheDocument(); // Avg latency

        // Go to HTTP tab to see formatted response time
        fireEvent.click(screen.getByText('HTTP'));
        expect(screen.getByText('85.60 ms')).toBeInTheDocument(); // HTTP response time
    });

    it('renders charts in each tab', () => {
        render(<MetricsDisplay metrics={mockMetrics} />);

        // Overview tab charts
        expect(screen.getAllByTestId('mock-line-chart').length).toBeGreaterThan(0);
        expect(screen.getAllByTestId('mock-doughnut-chart').length).toBeGreaterThan(0);

        // Connections tab charts
        fireEvent.click(screen.getByText('Connections'));
        expect(screen.getAllByTestId('mock-line-chart').length).toBeGreaterThan(0);
        expect(screen.getAllByTestId('mock-doughnut-chart').length).toBeGreaterThan(0);

        // Messages tab charts
        fireEvent.click(screen.getByText('Messages'));
        expect(screen.getAllByTestId('mock-line-chart').length).toBeGreaterThan(0);
        expect(screen.getAllByTestId('mock-bar-chart').length).toBeGreaterThan(0);

        // Errors tab charts
        fireEvent.click(screen.getByText('Errors'));
        expect(screen.getAllByTestId('mock-line-chart').length).toBeGreaterThan(0);
        expect(screen.getAllByTestId('mock-bar-chart').length).toBeGreaterThan(0);

        // System tab charts
        fireEvent.click(screen.getByText('System'));
        expect(screen.getAllByTestId('mock-bar-chart').length).toBeGreaterThan(0);

        // HTTP tab charts
        fireEvent.click(screen.getByText('HTTP'));
        expect(screen.getAllByTestId('mock-doughnut-chart').length).toBeGreaterThan(0);
    });
});