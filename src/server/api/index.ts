/**
 * API module for backend service integration
 */
import { BackendService } from './backend-service';
import { PharosClient } from './pharos-client';
import { Logger } from '../logger';
import { getRpcUrl } from './pharos-config';

/**
 * Initialize backend service
 * 
 * @param logger Logger instance
 * @param redisClient Redis client for distributed retries (optional)
 * @param instanceId Instance ID for distributed retries (optional)
 * @returns Backend service instance
 */
export function initializeBackendService(
    logger: Logger,
    redisClient?: any,
    instanceId?: string
): BackendService {
    const backendService = new BackendService(logger, {
        baseUrl: process.env.BACKEND_URL || 'http://localhost:8080',
        timeoutMs: parseInt(process.env.BACKEND_TIMEOUT_MS || '5000', 10),
        maxRetries: parseInt(process.env.BACKEND_MAX_RETRIES || '3', 10),
        initialDelayMs: parseInt(process.env.BACKEND_INITIAL_DELAY_MS || '100', 10),
        defaultHeaders: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.API_KEY || 'easyweb3.TOOLS'
        },
        useDistributedRetries: process.env.BACKEND_USE_DISTRIBUTED_RETRIES === 'true',
        redisClient,
        instanceId
    });

    logger.info('Backend service initialized', {
        baseUrl: process.env.BACKEND_URL || 'http://localhost:8080',
        useDistributedRetries: process.env.BACKEND_USE_DISTRIBUTED_RETRIES === 'true'
    });

    return backendService;
}

/**
/**
 * Initialize Pharos network client
 * 
 * @param logger Logger instance
 * @param redisClient Redis client for distributed retries (optional)
 * @param instanceId Instance ID for distributed retries (optional)
 * @returns Pharos client instance
 */
export function initializePharosClient(
    logger: Logger,
    redisClient?: any,
    instanceId?: string
): PharosClient {
    const rpcUrl = getRpcUrl();

    const backendService = new BackendService(logger, {
        baseUrl: rpcUrl,
        timeoutMs: parseInt(process.env.PHAROS_TIMEOUT_MS || '10000', 10),
        maxRetries: parseInt(process.env.PHAROS_MAX_RETRIES || '3', 10),
        initialDelayMs: parseInt(process.env.PHAROS_INITIAL_DELAY_MS || '100', 10),
        defaultHeaders: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.PHAROS_API_KEY || process.env.API_KEY || 'easyweb3.TOOLS'
        },
        useDistributedRetries: process.env.PHAROS_USE_DISTRIBUTED_RETRIES === 'true',
        redisClient,
        instanceId
    });

    const { getCurrentNetworkConfig } = require('./pharos-config');
    logger.info('Pharos client initialized', {
        rpcUrl,
        network: getCurrentNetworkConfig().name
    });

    return new PharosClient(backendService, logger);
}