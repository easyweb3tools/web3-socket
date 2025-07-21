/**
 * Pharos Network Configuration
 */

export interface PharosNetworkConfig {
    name: string;
    rpcUrl: string;
    chainId: number;
    symbol: string;
    explorerUrl: string;
    testnet: boolean;
}

/**
 * Pharos network configurations
 */
export const PHAROS_NETWORKS: Record<string, PharosNetworkConfig> = {
    mainnet: {
        name: 'Pharos Mainnet',
        rpcUrl: 'https://rpc.pharos.network',
        chainId: 1337,
        symbol: 'PHR',
        explorerUrl: 'https://explorer.pharos.network',
        testnet: false
    },
    testnet: {
        name: 'Pharos Testnet',
        rpcUrl: 'https://testnet-rpc.pharos.network',
        chainId: 1338,
        symbol: 'tPHR',
        explorerUrl: 'https://testnet-explorer.pharos.network',
        testnet: true
    },
    devnet: {
        name: 'Pharos Devnet',
        rpcUrl: 'http://localhost:8545',
        chainId: 31337,
        symbol: 'dPHR',
        explorerUrl: 'http://localhost:3000',
        testnet: true
    }
};

/**
 * Get network configuration by name
 * @param networkName Network name (mainnet, testnet, devnet)
 * @returns Network configuration or undefined if not found
 */
export function getNetworkConfig(networkName: string): PharosNetworkConfig | undefined {
    return PHAROS_NETWORKS[networkName];
}

/**
 * Get current network configuration based on environment
 * @returns Network configuration
 */
export function getCurrentNetworkConfig(): PharosNetworkConfig {
    const networkName = process.env.PHAROS_NETWORK || 'mainnet';
    const config = getNetworkConfig(networkName);
    
    if (!config) {
        throw new Error(`Unknown network: ${networkName}`);
    }
    
    return config;
}

/**
 * Get RPC URL from environment or network config
 * @returns RPC URL
 */
export function getRpcUrl(): string {
    return process.env.PHAROS_RPC_URL || getCurrentNetworkConfig().rpcUrl;
}

/**
 * Get chain ID from environment or network config
 * @returns Chain ID
 */
export function getChainId(): number {
    const chainId = process.env.PHAROS_CHAIN_ID;
    if (chainId) {
        return parseInt(chainId, 10);
    }
    return getCurrentNetworkConfig().chainId;
}