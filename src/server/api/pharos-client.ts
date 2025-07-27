import { BackendService } from './backend-service';
import { Logger } from '../logger';
import { getRpcUrl, getCurrentNetworkConfig } from './pharos-config';

/**
 * Pharos Network RPC Client
 * Provides specialized methods for interacting with the Pharos blockchain network
 */
export class PharosClient {
    private backendService: BackendService;
    private logger: Logger;

    /**
     * Create a new Pharos client
     * 
     * @param backendService Backend service instance for HTTP communication
     * @param logger Logger instance
     */
    constructor(backendService: BackendService, logger: Logger) {
        this.backendService = backendService;
        this.logger = logger.child({ module: 'PharosClient' });
        
        // Update base URL if PHAROS_RPC_URL is provided
        const rpcUrl = getRpcUrl();
        if (rpcUrl !== (backendService as any).options.baseUrl) {
            (backendService as any).options.baseUrl = rpcUrl;
            this.logger.info('Pharos RPC client configured with RPC URL', { url: rpcUrl });
        }
        
        this.logger.info('Pharos RPC client initialized', { network: getCurrentNetworkConfig().name });
    }

    /**
     * Make a JSON-RPC call to the Pharos network
     * 
     * @param method JSON-RPC method name
     * @param params Method parameters
     * @returns Promise that resolves with the RPC response
     */
    public async rpcCall<T = any>(method: string, params: any[] = []): Promise<T> {
        const payload = {
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params
        };

        try {
            const response = await this.backendService.post('/rpc', payload);
            
            if (response.data.error) {
                throw new Error(`RPC Error: ${response.data.error.message} (${response.data.error.code})`);
            }

            return response.data.result;
        } catch (error) {
            this.logger.error(`RPC call failed: ${method}`, error, { params });
            throw error;
        }
    }

    /**
     * Get blockchain information
     * @returns Promise with blockchain info
     */
    public async getBlockchainInfo(): Promise<any> {
        return this.rpcCall('getblockchaininfo');
    }

    /**
     * Get network information
     * @returns Promise with network info
     */
    public async getNetworkInfo(): Promise<any> {
        return this.rpcCall('getnetworkinfo');
    }

    /**
     * Get wallet information
     * @returns Promise with wallet info
     */
    public async getWalletInfo(): Promise<any> {
        return this.rpcCall('getwalletinfo');
    }

    /**
     * Get balance for an address
     * @param address Wallet address
     * @returns Promise with balance information
     */
    public async getBalance(address: string): Promise<any> {
        return this.rpcCall('getbalance', [address]);
    }

    /**
     * Get transaction by ID
     * @param txid Transaction ID
     * @returns Promise with transaction details
     */
    public async getTransaction(txid: string): Promise<any> {
        return this.rpcCall('gettransaction', [txid]);
    }

    /**
     * Get block by hash or height
     * @param blockHash Block hash or height
     * @returns Promise with block details
     */
    public async getBlock(blockHash: string | number): Promise<any> {
        return this.rpcCall('getblock', [blockHash]);
    }

    /**
     * Get latest block hash
     * @returns Promise with latest block hash
     */
    public async getBestBlockHash(): Promise<string> {
        return this.rpcCall('getbestblockhash');
    }

    /**
     * Get block count
     * @returns Promise with current block height
     */
    public async getBlockCount(): Promise<number> {
        return this.rpcCall('getblockcount');
    }

    /**
     * Get raw transaction
     * @param txid Transaction ID
     * @param verbose Whether to return detailed information
     * @returns Promise with raw transaction data
     */
    public async getRawTransaction(txid: string, verbose: boolean = true): Promise<any> {
        return this.rpcCall('getrawtransaction', [txid, verbose]);
    }

    /**
     * Send raw transaction
     * @param hex Raw transaction hex
     * @returns Promise with transaction ID
     */
    public async sendRawTransaction(hex: string): Promise<string> {
        return this.rpcCall('sendrawtransaction', [hex]);
    }

    /**
     * Estimate transaction fee
     * @param confTarget Confirmation target in blocks
     * @returns Promise with estimated fee rate
     */
    public async estimateFee(confTarget: number = 6): Promise<number> {
        return this.rpcCall('estimatesmartfee', [confTarget]);
    }

    /**
     * Get mempool information
     * @returns Promise with mempool stats
     */
    public async getMempoolInfo(): Promise<any> {
        return this.rpcCall('getmempoolinfo');
    }

    /**
     * Get unspent transaction outputs for an address
     * @param address Wallet address
     * @param minConf Minimum confirmations
     * @returns Promise with UTXO list
     */
    public async getUnspentOutputs(address: string, minConf: number = 1): Promise<any[]> {
        return this.rpcCall('listunspent', [minConf, 9999999, [address]]);
    }

    /**
     * Validate address
     * @param address Address to validate
     * @returns Promise with validation result
     */
    public async validateAddress(address: string): Promise<any> {
        return this.rpcCall('validateaddress', [address]);
    }

    /**
     * Create a new address
     * @param label Address label (optional)
     * @returns Promise with new address
     */
    public async getNewAddress(label?: string): Promise<string> {
        const params = label ? [label] : [];
        return this.rpcCall('getnewaddress', params);
    }

    /**
     * Get mining information
     * @returns Promise with mining info
     */
    public async getMiningInfo(): Promise<any> {
        return this.rpcCall('getmininginfo');
    }

    /**
     * Get peer information
     * @returns Promise with connected peers
     */
    public async getPeerInfo(): Promise<any[]> {
        return this.rpcCall('getpeerinfo');
    }

    /**
     * Get network hashrate
     * @param blocks Number of blocks to average (default: 120)
     * @param height Block height (default: -1 for current)
     * @returns Promise with network hashrate
     */
    public async getNetworkHashps(blocks: number = 120, height: number = -1): Promise<number> {
        return this.rpcCall('getnetworkhashps', [blocks, height]);
    }

    /**
     * Get current network configuration
     * @returns Network configuration
     */
    public getNetworkConfig() {
        return getCurrentNetworkConfig();
    }

    /**
     * Check if the Pharos network is accessible
     * @returns Promise with health status
     */
    public async isHealthy(): Promise<boolean> {
        try {
            await this.getBlockchainInfo();
            return true;
        } catch (error) {
            this.logger.warn('Pharos network health check failed', { error: error.message });
            return false;
        }
    }

    /**
     * Get multiple blockchain stats in a single call
     * @returns Promise with combined stats
     */
    public async getNetworkStats(): Promise<{
        blockchainInfo: any;
        networkInfo: any;
        miningInfo: any;
        mempoolInfo: any;
        peerCount: number;
    }> {
        try {
            const [blockchainInfo, networkInfo, miningInfo, mempoolInfo, peerInfo] = await Promise.all([
                this.getBlockchainInfo(),
                this.getNetworkInfo(),
                this.getMiningInfo(),
                this.getMempoolInfo(),
                this.getPeerInfo()
            ]);

            return {
                blockchainInfo,
                networkInfo,
                miningInfo,
                mempoolInfo,
                peerCount: peerInfo.length
            };
        } catch (error) {
            this.logger.error('Failed to get network stats', error);
            throw error;
        }
    }
}