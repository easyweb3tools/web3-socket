/**
 * Example usage of the Pharos RPC client
 */
import { setupLogger } from '../logger';
import { initializePharosClient } from './index';

// Initialize logger
const logger = setupLogger();

// Initialize Pharos client
const pharosClient = initializePharosClient(logger);

/**
 * Example: Get basic blockchain information
 */
async function getBlockchainInfo() {
    try {
        const info = await pharosClient.getBlockchainInfo();
        console.log('Blockchain Info:', {
            blocks: info.blocks,
            bestBlockHash: info.bestblockhash,
            difficulty: info.difficulty,
            chain: info.chain
        });
    } catch (error) {
        console.error('Failed to get blockchain info:', error.message);
    }
}

/**
 * Example: Get network information
 */
async function getNetworkInfo() {
    try {
        const info = await pharosClient.getNetworkInfo();
        console.log('Network Info:', {
            version: info.version,
            protocolVersion: info.protocolversion,
            connections: info.connections
        });
    } catch (error) {
        console.error('Failed to get network info:', error.message);
    }
}

/**
 * Example: Get balance for an address
 */
async function getAddressBalance(address: string) {
    try {
        const balance = await pharosClient.getBalance(address);
        console.log(`Balance for ${address}:`, balance);
    } catch (error) {
        console.error('Failed to get balance:', error.message);
    }
}

/**
 * Example: Get transaction details
 */
async function getTransactionDetails(txid: string) {
    try {
        const tx = await pharosClient.getTransaction(txid);
        console.log('Transaction details:', {
            txid: tx.txid,
            size: tx.size,
            confirmations: tx.confirmations,
            time: new Date(tx.time * 1000).toISOString()
        });
    } catch (error) {
        console.error('Failed to get transaction:', error.message);
    }
}

/**
 * Example: Get network stats
 */
async function getNetworkStats() {
    try {
        const stats = await pharosClient.getNetworkStats();
        console.log('Network Stats:', {
            blocks: stats.blockchainInfo.blocks,
            difficulty: stats.blockchainInfo.difficulty,
            connections: stats.networkInfo.connections,
            hashrate: stats.miningInfo.networkhashps,
            mempoolSize: stats.mempoolInfo.size,
            peerCount: stats.peerCount
        });
    } catch (error) {
        console.error('Failed to get network stats:', error.message);
    }
}

/**
 * Example: Custom RPC call
 */
async function customRpcCall() {
    try {
        const result = await pharosClient.rpcCall('getblockhash', [100000]);
        console.log('Block hash at height 100000:', result);
    } catch (error) {
        console.error('Custom RPC call failed:', error.message);
    }
}

/**
 * Example: Check network health
 */
async function checkNetworkHealth() {
    try {
        const isHealthy = await pharosClient.isHealthy();
        console.log('Pharos network is healthy:', isHealthy);
    } catch (error) {
        console.error('Health check failed:', error.message);
    }
}

// Usage examples
if (require.main === module) {
    console.log('Pharos RPC Client Examples');
    console.log('=========================');

    // Check network health first
    checkNetworkHealth()
        .then(() => {
            // Run examples
            getBlockchainInfo();
            getNetworkInfo();
            getNetworkStats();
            customRpcCall();

            // Uncomment to test with real addresses/transactions
            // getAddressBalance('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
            // getTransactionDetails('f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16');
        });
}

export {
    getBlockchainInfo,
    getNetworkInfo,
    getAddressBalance,
    getTransactionDetails,
    getNetworkStats,
    customRpcCall,
    checkNetworkHealth
};