import { Logger } from '../utils/logger.js';
import { EventEmitter } from '../utils/event-emitter.js';
import { ProductionConfig } from '../config/production-config.js';

export class WalletManager extends EventEmitter {
    constructor() {
        super();
        this.logger = new Logger('WalletManager');
        
        this.account = null;
        this.provider = null;
        this.chainId = null;
        this.connected = false;
        
        // Load network configuration from production config
        this.supportedNetworks = {
            polygon: ProductionConfig.NETWORKS.POLYGON_MAINNET,
            mumbai: ProductionConfig.NETWORKS.POLYGON_MUMBAI
        };
        
        // Use testnet or mainnet based on configuration
        this.requiredChainId = ProductionConfig.FEATURES.TESTNET_MODE 
            ? this.supportedNetworks.mumbai.chainId 
            : this.supportedNetworks.polygon.chainId;
            
        // Contract addresses
        this.contracts = ProductionConfig.CONTRACTS;
        
        // Security settings
        this.security = ProductionConfig.SECURITY;
    }

    async initialize() {
        try {
            this.logger.info('Initializing wallet manager...');
            
            // Check if web3 provider is available
            if (!this.isWeb3Available()) {
                throw new Error('Web3 provider not available. Please install MetaMask or another Web3 wallet.');
            }
            
            // Validate security requirements
            if (!this.security.REQUIRE_WALLET_CONNECTION && ProductionConfig.FEATURES.ENABLE_TRADING) {
                throw new Error('Wallet connection is required for trading operations');
            }

            // Set up provider
            this.provider = window.ethereum;
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Check if already connected
            await this.checkExistingConnection();
            
            this.logger.info('Wallet manager initialized successfully');
            
        } catch (error) {
            this.logger.error('Failed to initialize wallet manager:', error);
            throw error;
        }
    }

    isWeb3Available() {
        return typeof window !== 'undefined' && 
               typeof window.ethereum !== 'undefined' && 
               window.ethereum.isMetaMask;
    }

    setupEventListeners() {
        if (!this.provider) return;

        // Account changed
        this.provider.on('accountsChanged', (accounts) => {
            this.handleAccountsChanged(accounts);
        });

        // Chain changed
        this.provider.on('chainChanged', (chainId) => {
            this.handleChainChanged(chainId);
        });

        // Disconnect
        this.provider.on('disconnect', (error) => {
            this.handleDisconnect(error);
        });
    }

    async checkExistingConnection() {
        try {
            const accounts = await this.provider.request({ 
                method: 'eth_accounts' 
            });
            
            if (accounts.length > 0) {
                this.account = accounts[0];
                this.chainId = await this.provider.request({ 
                    method: 'eth_chainId' 
                });
                
                await this.validateNetwork();
                this.connected = true;
                
                this.logger.info(`Existing connection found: ${this.account}`);
                this.emit('connected', this.account);
            }
        } catch (error) {
            this.logger.error('Failed to check existing connection:', error);
        }
    }

    async connect() {
        try {
            this.logger.info('Connecting wallet...');

            if (!this.isWeb3Available()) {
                throw new Error('Web3 provider not available');
            }

            // Request account access
            const accounts = await this.provider.request({ 
                method: 'eth_requestAccounts' 
            });

            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts available');
            }

            this.account = accounts[0];
            this.chainId = await this.provider.request({ 
                method: 'eth_chainId' 
            });

            // Validate and switch to correct network if needed
            await this.validateNetwork();

            this.connected = true;
            this.logger.info(`Wallet connected: ${this.account}`);
            this.emit('connected', this.account);

            return this.account;

        } catch (error) {
            this.logger.error('Failed to connect wallet:', error);
            this.connected = false;
            throw error;
        }
    }

    async disconnect() {
        try {
            this.account = null;
            this.chainId = null;
            this.connected = false;
            
            this.logger.info('Wallet disconnected');
            this.emit('disconnected');

        } catch (error) {
            this.logger.error('Failed to disconnect wallet:', error);
            throw error;
        }
    }

    async validateNetwork() {
        if (!this.chainId) {
            throw new Error('Chain ID not available');
        }

        if (this.chainId !== this.requiredChainId) {
            this.logger.info(`Wrong network detected. Switching from ${this.chainId} to ${this.requiredChainId}`);
            await this.switchToRequiredNetwork();
        }
    }

    async switchToRequiredNetwork() {
        try {
            await this.provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: this.requiredChainId }]
            });
            
            this.chainId = this.requiredChainId;
            const networkName = ProductionConfig.FEATURES.TESTNET_MODE ? 'Polygon Mumbai' : 'Polygon Mainnet';
            this.logger.info(`Switched to ${networkName} network`);
            
        } catch (switchError) {
            // Chain might not be added to wallet
            if (switchError.code === 4902) {
                await this.addRequiredNetwork();
            } else {
                throw switchError;
            }
        }
    }

    async addRequiredNetwork() {
        try {
            const networkConfig = ProductionConfig.FEATURES.TESTNET_MODE 
                ? this.supportedNetworks.mumbai 
                : this.supportedNetworks.polygon;
            
            await this.provider.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: networkConfig.chainId,
                    chainName: networkConfig.name,
                    rpcUrls: networkConfig.rpcUrls,
                    blockExplorerUrls: networkConfig.blockExplorerUrls,
                    nativeCurrency: networkConfig.nativeCurrency
                }]
            });
            
            this.chainId = networkConfig.chainId;
            this.logger.info(`Added and switched to ${networkConfig.name} network`);
            
        } catch (error) {
            this.logger.error(`Failed to add ${networkConfig.name} network:`, error);
            throw error;
        }
    }

    async signMessage(message) {
        try {
            if (!this.connected || !this.account) {
                throw new Error('Wallet not connected');
            }

            const signature = await this.provider.request({
                method: 'personal_sign',
                params: [message, this.account]
            });

            return signature;

        } catch (error) {
            this.logger.error('Failed to sign message:', error);
            throw error;
        }
    }

    async signOrder(orderData) {
        try {
            if (!this.connected || !this.account) {
                throw new Error('Wallet not connected');
            }

            // Create EIP-712 structured data for order
            const domain = {
                name: 'Polymarket CTF Exchange',
                version: '1',
                chainId: parseInt(this.chainId, 16),
                verifyingContract: this.contracts.CTF_EXCHANGE
            };

            const types = {
                Order: [
                    { name: 'market', type: 'string' },
                    { name: 'price', type: 'string' },
                    { name: 'size', type: 'string' },
                    { name: 'side', type: 'string' },
                    { name: 'timestamp', type: 'uint256' },
                    { name: 'nonce', type: 'string' }
                ]
            };

            const message = {
                market: orderData.market,
                price: orderData.price,
                size: orderData.size,
                side: orderData.side,
                timestamp: orderData.timestamp,
                nonce: orderData.nonce
            };

            const signature = await this.provider.request({
                method: 'eth_signTypedData_v4',
                params: [this.account, JSON.stringify({
                    domain,
                    primaryType: 'Order',
                    types,
                    message
                })]
            });

            return signature;

        } catch (error) {
            this.logger.error('Failed to sign order:', error);
            throw error;
        }
    }

    async signCancellation(cancellationData) {
        try {
            if (!this.connected || !this.account) {
                throw new Error('Wallet not connected');
            }

            // Create EIP-712 structured data for cancellation
            const domain = {
                name: 'Polymarket CTF Exchange',
                version: '1',
                chainId: parseInt(this.chainId, 16),
                verifyingContract: this.contracts.CTF_EXCHANGE
            };

            const types = {
                Cancellation: [
                    { name: 'orderId', type: 'string' },
                    { name: 'timestamp', type: 'uint256' },
                    { name: 'nonce', type: 'string' }
                ]
            };

            const message = {
                orderId: cancellationData.orderId,
                timestamp: cancellationData.timestamp,
                nonce: cancellationData.nonce
            };

            const signature = await this.provider.request({
                method: 'eth_signTypedData_v4',
                params: [this.account, JSON.stringify({
                    domain,
                    primaryType: 'Cancellation',
                    types,
                    message
                })]
            });

            return signature;

        } catch (error) {
            this.logger.error('Failed to sign cancellation:', error);
            throw error;
        }
    }

    async getBalance() {
        try {
            if (!this.connected || !this.account) {
                throw new Error('Wallet not connected');
            }

            const balance = await this.provider.request({
                method: 'eth_getBalance',
                params: [this.account, 'latest']
            });

            // Convert from wei to MATIC
            const maticBalance = parseInt(balance, 16) / 1e18;
            return maticBalance;

        } catch (error) {
            this.logger.error('Failed to get balance:', error);
            throw error;
        }
    }

    async getTokenBalance(tokenAddress) {
        try {
            if (!this.connected || !this.account) {
                throw new Error('Wallet not connected');
            }

            // ERC-20 balanceOf function call
            const data = '0x70a08231' + this.account.slice(2).padStart(64, '0');
            
            const balance = await this.provider.request({
                method: 'eth_call',
                params: [{
                    to: tokenAddress,
                    data: data
                }, 'latest']
            });

            return parseInt(balance, 16);

        } catch (error) {
            this.logger.error('Failed to get token balance:', error);
            throw error;
        }
    }

    async sendTransaction(transactionData) {
        try {
            if (!this.connected || !this.account) {
                throw new Error('Wallet not connected');
            }

            const txHash = await this.provider.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: this.account,
                    ...transactionData
                }]
            });

            return txHash;

        } catch (error) {
            this.logger.error('Failed to send transaction:', error);
            throw error;
        }
    }

    async waitForTransaction(txHash, timeout = 60000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            try {
                const receipt = await this.provider.request({
                    method: 'eth_getTransactionReceipt',
                    params: [txHash]
                });

                if (receipt) {
                    return receipt;
                }

                // Wait 2 seconds before next check
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                this.logger.error('Error checking transaction status:', error);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        throw new Error('Transaction timeout');
    }

    // USDC Token Integration
    async getUSDCBalance() {
        try {
            if (!this.connected || !this.account) {
                throw new Error('Wallet not connected');
            }

            const balance = await this.getTokenBalance(this.contracts.USDC);
            // USDC has 6 decimals
            return balance / 1e6;

        } catch (error) {
            this.logger.error('Failed to get USDC balance:', error);
            throw error;
        }
    }

    async approveUSDC(spender, amount) {
        try {
            if (!this.connected || !this.account) {
                throw new Error('Wallet not connected');
            }

            // ERC-20 approve function call data
            const amountHex = '0x' + (amount * 1e6).toString(16).padStart(64, '0');
            const spenderHex = spender.slice(2).padStart(64, '0');
            const data = '0x095ea7b3' + spenderHex + amountHex; // approve(address,uint256)

            const txHash = await this.sendTransaction({
                to: this.contracts.USDC,
                data: data,
                gas: '0x15F90', // 90000 gas limit
            });

            this.logger.info(`USDC approval transaction sent: ${txHash}`);
            return txHash;

        } catch (error) {
            this.logger.error('Failed to approve USDC:', error);
            throw error;
        }
    }

    async checkUSDCAllowance(spender) {
        try {
            if (!this.connected || !this.account) {
                throw new Error('Wallet not connected');
            }

            // ERC-20 allowance function call data
            const ownerHex = this.account.slice(2).padStart(64, '0');
            const spenderHex = spender.slice(2).padStart(64, '0');
            const data = '0xdd62ed3e' + ownerHex + spenderHex; // allowance(address,address)

            const allowance = await this.provider.request({
                method: 'eth_call',
                params: [{
                    to: this.contracts.USDC,
                    data: data
                }, 'latest']
            });

            return parseInt(allowance, 16) / 1e6;

        } catch (error) {
            this.logger.error('Failed to check USDC allowance:', error);
            throw error;
        }
    }

    async addUSDCToWallet() {
        try {
            return await this.addTokenToWallet(
                this.contracts.USDC,
                'USDC',
                6,
                'https://assets.coingecko.com/coins/images/6319/thumb/USD_Coin_icon.png'
            );
        } catch (error) {
            this.logger.error('Failed to add USDC to wallet:', error);
            throw error;
        }
    }

    // Trading-specific methods
    async prepareForTrading() {
        try {
            this.logger.info('Preparing wallet for trading...');

            if (!this.connected || !this.account) {
                throw new Error('Wallet not connected');
            }

            if (!this.isCorrectNetwork()) {
                await this.switchToRequiredNetwork();
            }

            // Check USDC balance
            const usdcBalance = await this.getUSDCBalance();
            if (usdcBalance < ProductionConfig.TRADING_LIMITS.MIN_ORDER_SIZE) {
                throw new Error(`Insufficient USDC balance. Minimum required: ${ProductionConfig.TRADING_LIMITS.MIN_ORDER_SIZE} USDC`);
            }

            // Check and approve USDC for CTF Exchange
            const allowance = await this.checkUSDCAllowance(this.contracts.CTF_EXCHANGE);
            if (allowance < ProductionConfig.TRADING_LIMITS.MAX_POSITION_SIZE) {
                this.logger.info('Approving USDC for trading...');
                await this.approveUSDC(this.contracts.CTF_EXCHANGE, ProductionConfig.TRADING_LIMITS.MAX_POSITION_SIZE * 10);
            }

            // Add USDC to wallet if not present
            await this.addUSDCToWallet();

            this.logger.info('Wallet prepared for trading successfully');
            return {
                account: this.account,
                usdcBalance,
                allowance,
                network: ProductionConfig.FEATURES.TESTNET_MODE ? 'testnet' : 'mainnet'
            };

        } catch (error) {
            this.logger.error('Failed to prepare wallet for trading:', error);
            throw error;
        }
    }

    // Gas estimation and transaction management
    async estimateGasPrice() {
        try {
            const gasPrice = await this.provider.request({
                method: 'eth_gasPrice'
            });

            const gasPriceGwei = parseInt(gasPrice, 16) / 1e9;
            
            // Check against maximum gas price
            if (gasPriceGwei > this.security.MAX_GAS_PRICE) {
                this.logger.warn(`Gas price ${gasPriceGwei} Gwei exceeds maximum ${this.security.MAX_GAS_PRICE} Gwei`);
            }

            return gasPriceGwei;

        } catch (error) {
            this.logger.error('Failed to estimate gas price:', error);
            throw error;
        }
    }

    async sendTransactionWithTimeout(transactionData, timeout = null) {
        const actualTimeout = timeout || this.security.TRANSACTION_TIMEOUT;
        
        return Promise.race([
            this.sendTransaction(transactionData),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Transaction timeout')), actualTimeout)
            )
        ]);
    }

    // Event handlers
    handleAccountsChanged(accounts) {
        this.logger.info('Accounts changed:', accounts);
        
        if (accounts.length === 0) {
            this.handleDisconnect();
        } else if (accounts[0] !== this.account) {
            this.account = accounts[0];
            this.emit('accountChanged', this.account);
        }
    }

    handleChainChanged(chainId) {
        this.logger.info('Chain changed:', chainId);
        this.chainId = chainId;
        
        if (chainId !== this.requiredChainId) {
            this.emit('wrongNetwork', chainId);
        } else {
            this.emit('correctNetwork', chainId);
        }
    }

    handleDisconnect(error = null) {
        this.logger.info('Wallet disconnected', error);
        
        this.account = null;
        this.chainId = null;
        this.connected = false;
        
        this.emit('disconnected', error);
    }

    // Public getters
    isConnected() {
        return this.connected && this.account !== null;
    }

    getAccount() {
        return this.account;
    }

    getChainId() {
        return this.chainId;
    }

    getProvider() {
        return this.provider;
    }

    isCorrectNetwork() {
        return this.chainId === this.requiredChainId;
    }

    getWalletInfo() {
        return {
            connected: this.connected,
            account: this.account,
            chainId: this.chainId,
            correctNetwork: this.isCorrectNetwork(),
            provider: this.provider ? 'MetaMask' : 'None'
        };
    }

    // Utility methods
    formatAddress(address) {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    async addTokenToWallet(tokenAddress, tokenSymbol, tokenDecimals = 18, tokenImage = '') {
        try {
            const wasAdded = await this.provider.request({
                method: 'wallet_watchAsset',
                params: {
                    type: 'ERC20',
                    options: {
                        address: tokenAddress,
                        symbol: tokenSymbol,
                        decimals: tokenDecimals,
                        image: tokenImage
                    }
                }
            });

            if (wasAdded) {
                this.logger.info(`Token ${tokenSymbol} added to wallet`);
            }

            return wasAdded;

        } catch (error) {
            this.logger.error('Failed to add token to wallet:', error);
            throw error;
        }
    }

    // Cleanup
    destroy() {
        if (this.provider && this.provider.removeAllListeners) {
            this.provider.removeAllListeners('accountsChanged');
            this.provider.removeAllListeners('chainChanged');
            this.provider.removeAllListeners('disconnect');
        }
        
        this.removeAllListeners();
        this.logger.info('Wallet manager destroyed');
    }
}