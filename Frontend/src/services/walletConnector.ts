import { ethers } from 'ethers';

export type WalletType = 'metamask' | 'coinbase' | 'walletconnect' | 'other';

export interface WalletConnection {
  address: string;
  provider: ethers.BrowserProvider;
  signer: ethers.JsonRpcSigner;
}

class WalletConnector {
  /**
   * Get all available wallet providers
   */
  private getAvailableProviders(): Array<{ provider: any; type: WalletType }> {
    const providers: Array<{ provider: any; type: WalletType }> = [];

    if (!window.ethereum) {
      return providers;
    }

    // Check for multiple providers
    if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
      window.ethereum.providers.forEach((provider: any) => {
        if (provider.isMetaMask && !provider.isCoinbaseWallet) {
          providers.push({ provider, type: 'metamask' });
        } else if (provider.isCoinbaseWallet) {
          providers.push({ provider, type: 'coinbase' });
        }
      });
    } else {
      // Single provider
      if (window.ethereum.isMetaMask && !window.ethereum.isCoinbaseWallet) {
        providers.push({ provider: window.ethereum, type: 'metamask' });
      } else if (window.ethereum.isCoinbaseWallet) {
        providers.push({ provider: window.ethereum, type: 'coinbase' });
      }
    }

    // Check for Coinbase-specific injection
    if ((window as any).coinbaseWalletExtension) {
      const alreadyAdded = providers.some(p => p.provider === (window as any).coinbaseWalletExtension);
      if (!alreadyAdded) {
        providers.push({ provider: (window as any).coinbaseWalletExtension, type: 'coinbase' });
      }
    }

    return providers;
  }

  /**
   * Find which wallet contains a specific address
   */
  async findWalletByAddress(targetAddress: string): Promise<{ provider: any; type: WalletType } | null> {
    const providers = this.getAvailableProviders();
    
    for (const { provider, type } of providers) {
      try {
        // Get accounts from this provider without requesting permission
        const accounts = await provider.request({ method: 'eth_accounts' });
        
        if (accounts && accounts.length > 0) {
          // Check if target address is in this wallet
          const normalizedTarget = targetAddress.toLowerCase();
          const hasAddress = accounts.some((addr: string) => addr.toLowerCase() === normalizedTarget);
          
          if (hasAddress) {
            return { provider, type };
          }
        }
      } catch (error) {
        console.warn(`Failed to check accounts in ${type}:`, error);
      }
    }

    return null;
  }

  /**
   * Connect to wallet that contains the specified address
   */
  async connectByAddress(targetAddress: string): Promise<WalletConnection & { walletType: WalletType }> {
    const walletInfo = await this.findWalletByAddress(targetAddress);
    
    if (!walletInfo) {
      throw new Error(`Address ${targetAddress.slice(0, 6)}...${targetAddress.slice(-4)} not found in any connected wallet. Please unlock the wallet containing this address.`);
    }

    try {
      // Request account access from the specific wallet
      const accounts = await walletInfo.provider.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please unlock your wallet.');
      }

      const provider = new ethers.BrowserProvider(walletInfo.provider);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      // Verify we got the correct address
      if (address.toLowerCase() !== targetAddress.toLowerCase()) {
        throw new Error(`Connected to wrong address. Expected ${targetAddress}, got ${address}`);
      }

      return { address, provider, signer, walletType: walletInfo.type };
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('User rejected the connection request');
      }
      throw error;
    }
  }

  async connectMetaMask(): Promise<WalletConnection> {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
    }

    let metamaskProvider = null;
    
    // Priority 1: Check if there are multiple providers
    if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
      // Multiple wallets installed - find MetaMask specifically
      metamaskProvider = window.ethereum.providers.find(
        (provider: any) => provider.isMetaMask && !provider.isCoinbaseWallet
      );
      
      if (!metamaskProvider) {
        throw new Error('MetaMask not found. Please make sure MetaMask is installed and enabled.');
      }
    } 
    // Priority 2: Check if current provider is MetaMask (and NOT Coinbase)
    else if (window.ethereum.isMetaMask && !window.ethereum.isCoinbaseWallet) {
      metamaskProvider = window.ethereum;
    }
    // Priority 3: Check for MetaMask-specific property
    else if ((window as any).ethereum?.isMetaMask) {
      metamaskProvider = (window as any).ethereum;
    }

    if (!metamaskProvider) {
      throw new Error('MetaMask is not installed or not accessible. Please install MetaMask or disable other wallet extensions temporarily.');
    }

    try {
      // Request account access
      const accounts = await metamaskProvider.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please unlock MetaMask.');
      }

      const provider = new ethers.BrowserProvider(metamaskProvider);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      return { address, provider, signer };
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('User rejected the connection request');
      }
      throw error;
    }
  }

  async connectCoinbase(): Promise<WalletConnection> {
    // Coinbase Wallet injects itself as window.ethereum when it's the only wallet
    // or as window.coinbaseWalletExtension when MetaMask is also installed
    let coinbaseProvider = null;
    
    // Check for Coinbase Wallet specific provider
    if ((window as any).coinbaseWalletExtension) {
      coinbaseProvider = (window as any).coinbaseWalletExtension;
    } else if (window.ethereum) {
      // Check if the current ethereum provider is Coinbase
      if (window.ethereum.isCoinbaseWallet) {
        coinbaseProvider = window.ethereum;
      } else if (window.ethereum.providers) {
        // Multiple wallets installed - find Coinbase
        coinbaseProvider = window.ethereum.providers.find(
          (provider: any) => provider.isCoinbaseWallet
        );
      }
    }
    
    if (!coinbaseProvider) {
      throw new Error('Coinbase Wallet is not installed. Please install Coinbase Wallet to continue.');
    }

    try {
      const accounts = await coinbaseProvider.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please unlock Coinbase Wallet.');
      }

      const provider = new ethers.BrowserProvider(coinbaseProvider);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      return { address, provider, signer };
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('User rejected the connection request');
      }
      throw error;
    }
  }

  async signMessage(signer: ethers.JsonRpcSigner, message: string): Promise<string> {
    try {
      const signature = await signer.signMessage(message);
      return signature;
    } catch (error: any) {
      if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
        throw new Error('User rejected the signature request');
      }
      throw new Error('Failed to sign message: ' + error.message);
    }
  }

  async switchNetwork(chainId: number): Promise<void> {
    if (!window.ethereum) {
      throw new Error('No wallet provider found');
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch (error: any) {
      if (error.code === 4902) {
        throw new Error('Network not found in wallet. Please add it manually.');
      }
      throw error;
    }
  }

  async getBalance(provider: ethers.BrowserProvider, address: string): Promise<string> {
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  async getChainId(provider: ethers.BrowserProvider): Promise<number> {
    const network = await provider.getNetwork();
    return Number(network.chainId);
  }

  setupAccountChangeListener(callback: (accounts: string[]) => void): void {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', callback);
    }
  }

  setupChainChangeListener(callback: (chainId: string) => void): void {
    if (window.ethereum) {
      window.ethereum.on('chainChanged', callback);
    }
  }

  removeListeners(): void {
    if (window.ethereum) {
      window.ethereum.removeAllListeners('accountsChanged');
      window.ethereum.removeAllListeners('chainChanged');
    }
  }
}

export const walletConnector = new WalletConnector();

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any;
  }
}
