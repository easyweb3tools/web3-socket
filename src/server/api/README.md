# Pharos Network API Client

This directory contains the HTTP client for making RPC calls to the Pharos blockchain network, built on top of the existing backend service infrastructure.

## Files Overview

- `backend-service.ts` - General HTTP client with retry logic and circuit breaker
- `pharos-client.ts` - Specialized RPC client for Pharos blockchain
- `pharos-config.ts` - Network configuration for Pharos
- `index.ts` - Initialization functions
- `pharos-client.example.ts` - Usage examples

## Quick Start

### Basic Usage

```typescript
import { Logger } from '../logger';
import { initializePharosClient } from './api';

const logger = new Logger();
const pharosClient = initializePharosClient(logger);

// Get blockchain info
const info = await pharosClient.getBlockchainInfo();
console.log('Current block height:', info.blocks);
```

### Environment Variables

Configure the client using environment variables:

```bash
# Network configuration
PHAROS_NETWORK=mainnet|testnet|devnet
PHAROS_RPC_URL=https://rpc.pharos.network

# Client settings
PHAROS_TIMEOUT_MS=10000
PHAROS_MAX_RETRIES=3
PHAROS_INITIAL_DELAY_MS=100
PHAROS_USE_DISTRIBUTED_RETRIES=true
PHAROS_API_KEY=your-api-key
```

## Available Methods

### Blockchain Information
- `getBlockchainInfo()` - Get blockchain statistics
- `getNetworkInfo()` - Get network information
- `getMiningInfo()` - Get mining information
- `getNetworkStats()` - Get combined network statistics

### Block Operations
- `getBlockCount()` - Get current block height
- `getBestBlockHash()` - Get latest block hash
- `getBlock(blockHash)` - Get block by hash or height

### Transaction Operations
- `getTransaction(txid)` - Get transaction details
- `getRawTransaction(txid, verbose?)` - Get raw transaction
- `sendRawTransaction(hex)` - Send raw transaction

### Address Operations
- `getBalance(address)` - Get address balance
- `getUnspentOutputs(address, minConf?)` - Get UTXOs
- `validateAddress(address)` - Validate address format
- `getNewAddress(label?)` - Create new address

### Utilities
- `isHealthy()` - Check if network is accessible
- `estimateFee(confTarget?)` - Estimate transaction fee
- `getNetworkConfig()` - Get current network configuration
- `rpcCall(method, params?)` - Make custom RPC call

## Network Configuration

### Predefined Networks

```typescript
import { PHAROS_NETWORKS } from './pharos-config';

// Available networks
const mainnet = PHAROS_NETWORKS.mainnet;
const testnet = PHAROS_NETWORKS.testnet;
const devnet = PHAROS_NETWORKS.devnet;
```

### Custom Configuration

```typescript
// Set custom RPC URL
process.env.PHAROS_RPC_URL = 'https://custom-rpc.pharos.network';

// Initialize client with custom settings
const pharosClient = initializePharosClient(logger);
```

## Error Handling

All methods throw descriptive errors that can be caught and handled:

```typescript
try {
    const balance = await pharosClient.getBalance('some-address');
} catch (error) {
    if (error.message.includes('RPC Error')) {
        console.error('RPC call failed:', error.message);
    } else {
        console.error('Network error:', error.message);
    }
}
```

## Retry and Circuit Breaker

The client leverages the BackendService's retry mechanism and circuit breaker:

- **Retry Logic**: Configurable exponential backoff
- **Circuit Breaker**: Prevents cascading failures
- **Distributed Retries**: Optional Redis-based coordination
- **Connection Pooling**: Efficient connection management

## Examples

See `pharos-client.example.ts` for complete usage examples including:
- Basic blockchain queries
- Transaction lookups
- Address operations
- Network health checks
- Custom RPC calls

## Integration

The Pharos client integrates seamlessly with the existing web3-socket infrastructure and can be used alongside the BackendService for other API calls.

```typescript
import { initializeBackendService, initializePharosClient } from './api';

// Use both services
const backend = initializeBackendService(logger);
const pharos = initializePharosClient(logger);

// Make backend calls
const response = await backend.get('/api/users');

// Make Pharos RPC calls
const blockCount = await pharos.getBlockCount();
```