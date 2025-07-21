import { Socket } from 'socket.io';
import { BaseEventHandler } from './base-handler';
import { RoomManager } from '../room-manager';
import jwt from 'jsonwebtoken';

/**
 * Authentication handler
 */
export class AuthHandler extends BaseEventHandler {
    private jwtSecret: string;

    constructor(...args: ConstructorParameters<typeof BaseEventHandler>) {
        super(...args);
        this.jwtSecret = process.env.JWT_SECRET || 'easyweb3.TOOLS';
    }

    /**
     * Register event listeners
     */
    public registerEvents(): void {
        this.registerEventHandler('register', this.handleRegister.bind(this));
        this.registerEventHandler('authenticate', this.handleAuthenticate.bind(this));
        this.registerEventHandler('verify-token', this.handleVerifyToken.bind(this));
        this.registerEventHandler('ping', this.handlePing.bind(this));
    }

    /**
     * Get the handler name
     */
    public getName(): string {
        return 'auth';
    }

    /**
     * Handle register event
     * This is used for backward compatibility and for clients that don't use JWT
     */
    private async handleRegister(socket: Socket, data: any): Promise<void> {
        try {
            // Check if already authenticated via middleware
            if (socket.data.authenticated && socket.data.userId) {
                const userId = socket.data.userId;

                // If the user is already authenticated via JWT and the userId matches
                if (data.userId === userId) {
                    // Add to user-specific room
                    const userRoom = RoomManager.getUserRoom(userId);
                    this.roomManager.addToRoom(socket, userRoom, 'user');

                    // Register in connection manager
                    await this.connectionManager.registerUser(socket, userId, socket.data.token);

                    // Acknowledge successful registration
                    socket.emit('register:ack', {
                        success: true,
                        method: 'jwt'
                    });

                    this.logger.info(`User ${userId} registered via JWT`, {
                        socketId: socket.id,
                        method: 'jwt'
                    });

                    return;
                }
            }

            // Validate data for manual registration
            if (!data || !data.userId) {
                socket.emit('register:ack', {
                    success: false,
                    error: 'Missing userId'
                });
                return;
            }

            const { userId, token } = data;

            // Register the user with authentication
            const success = await this.connectionManager.registerUser(socket, userId, token);

            if (success) {
                // Add to user-specific room
                const userRoom = RoomManager.getUserRoom(userId);
                this.roomManager.addToRoom(socket, userRoom, 'user');

                // Acknowledge successful registration
                socket.emit('register:ack', {
                    success: true,
                    method: token ? 'token' : 'legacy'
                });

                this.logger.info(`User ${userId} registered successfully`, {
                    socketId: socket.id,
                    method: token ? 'token' : 'legacy'
                });
            } else {
                // Authentication failed
                socket.emit('register:ack', {
                    success: false,
                    error: 'Authentication failed'
                });

                // Disconnect the socket after a short delay
                setTimeout(() => {
                    socket.disconnect(true);
                }, 1000);
            }
        } catch (error) {
            this.logger.error('Registration failed', error as Error, {
                socketId: socket.id
            });

            socket.emit('register:ack', {
                success: false,
                error: 'Authentication failed'
            });

            // Disconnect the socket after a short delay
            setTimeout(() => {
                socket.disconnect(true);
            }, 1000);
        }
    }

    /**
     * Handle authenticate event
     * This is used for clients that want to authenticate after connection
     */
    private async handleAuthenticate(socket: Socket, data: any): Promise<void> {
        try {
            // Validate data
            if (!data || !data.token) {
                socket.emit('authenticate:ack', {
                    success: false,
                    error: 'Missing token'
                });
                return;
            }

            const { token } = data;

            // Verify the token
            try {
                const decoded = jwt.verify(token, this.jwtSecret) as { sub?: string, userId?: string };

                // Ensure the token contains a user identifier
                if (!decoded.userId && !decoded.sub) {
                    socket.emit('authenticate:ack', {
                        success: false,
                        error: 'Invalid token format'
                    });
                    return;
                }

                const userId = decoded.userId || decoded.sub;

                // Store user data in socket
                socket.data.userId = userId;
                socket.data.authenticated = true;
                socket.data.token = token;

                // Register the user
                await this.connectionManager.registerUser(socket, userId, token);

                // Add to user-specific room
                const userRoom = RoomManager.getUserRoom(userId);
                this.roomManager.addToRoom(socket, userRoom, 'user');

                // Acknowledge successful authentication
                socket.emit('authenticate:ack', {
                    success: true,
                    userId
                });

                this.logger.info(`User ${userId} authenticated via token`, {
                    socketId: socket.id
                });
            } catch (error) {
                this.logger.warn('Token verification failed', {
                    socketId: socket.id,
                    error: (error as Error).message
                });

                socket.emit('authenticate:ack', {
                    success: false,
                    error: 'Invalid token'
                });
            }
        } catch (error) {
            this.logger.error('Authentication failed', error as Error, {
                socketId: socket.id
            });

            socket.emit('authenticate:ack', {
                success: false,
                error: 'Authentication failed'
            });
        }
    }

    /**
     * Handle verify token event
     * This allows clients to verify if their token is still valid
     */
    private async handleVerifyToken(socket: Socket, data: any): Promise<void> {
        try {
            // Validate data
            if (!data || !data.token) {
                socket.emit('verify-token:ack', {
                    success: false,
                    error: 'Missing token'
                });
                return;
            }

            const { token } = data;

            // Verify the token
            try {
                const decoded = jwt.verify(token, this.jwtSecret) as {
                    sub?: string,
                    userId?: string,
                    exp?: number
                };

                // Calculate token expiration
                const expiresIn = decoded.exp ? decoded.exp * 1000 - Date.now() : null;

                socket.emit('verify-token:ack', {
                    success: true,
                    userId: decoded.userId || decoded.sub,
                    expiresIn: expiresIn ? Math.max(0, expiresIn) : null
                });
            } catch (error) {
                socket.emit('verify-token:ack', {
                    success: false,
                    error: 'Invalid token'
                });
            }
        } catch (error) {
            this.logger.error('Token verification failed', error as Error, {
                socketId: socket.id
            });

            socket.emit('verify-token:ack', {
                success: false,
                error: 'Verification failed'
            });
        }
    }

    /**
     * Handle ping event
     */
    private async handlePing(socket: Socket, data: any): Promise<void> {
        // Update activity timestamp
        this.updateActivity(socket);

        // Send pong response
        socket.emit('pong', {
            timestamp: new Date().toISOString(),
            echo: data,
            authenticated: socket.data.authenticated === true
        });
    }
}