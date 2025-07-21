import { Server } from 'socket.io';
import { ConnectionManager } from '../connection-manager';
import { RoomManager } from '../room-manager';
import { Logger } from '../logger';
import { Metrics } from '../metrics';
import { HandlerRegistry } from './handler-registry';
import { AuthHandler } from './auth-handler';
import { ClientEventHandler } from './client-handler';
import { SystemEventHandler } from './system-handler';
import { LoadManager } from '../utils/load-manager';
import { BackendService } from '../api/backend-service';

/**
 * Setup event handlers
 */
export function setupEventHandlers(
    io: Server,
    connectionManager: ConnectionManager,
    roomManager: RoomManager,
    logger: Logger,
    metrics?: Metrics,
    loadManager?: LoadManager,
    backendService?: BackendService
): HandlerRegistry {
    // Create handler registry
    const registry = new HandlerRegistry(io, connectionManager, roomManager, logger, metrics, loadManager);

    // Register handlers
    registry.registerHandler(new SystemEventHandler(io, connectionManager, roomManager, logger, metrics));
    registry.registerHandler(new AuthHandler(io, connectionManager, roomManager, logger, metrics));
    registry.registerHandler(new ClientEventHandler(io, connectionManager, roomManager, logger, metrics, backendService));

    // Setup connection handler
    registry.setupConnectionHandler();

    // Set up periodic cleanup of inactive connections
    setupInactivityCleanup(connectionManager, logger);

    return registry;
}

/**
 * Setup periodic cleanup of inactive connections
 */
function setupInactivityCleanup(
    connectionManager: ConnectionManager,
    logger: Logger
): void {
    const inactivityCheckInterval = parseInt(process.env.INACTIVITY_CHECK_INTERVAL || '300000', 10); // Default: 5 minutes
    const inactivityTimeout = parseInt(process.env.INACTIVITY_TIMEOUT || '1800', 10); // Default: 30 minutes

    if (inactivityCheckInterval > 0 && inactivityTimeout > 0) {
        setInterval(() => {
            const disconnectedCount = connectionManager.disconnectInactiveSockets(inactivityTimeout / 60);
            if (disconnectedCount > 0) {
                logger.info(`Disconnected ${disconnectedCount} inactive sockets`);
            }
        }, inactivityCheckInterval);

        logger.info(`Inactive connection cleanup scheduled every ${inactivityCheckInterval / 60000} minutes`);
    }
}