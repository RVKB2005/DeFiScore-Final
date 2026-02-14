import { ethers } from 'ethers';

export type WalletType = 'metamask' | 'coinbase' | 'walletconnect' | 'other';

export interface WalletConnection {
  address: string;
  provider: ethers.BrowserProvider;
  signer: ethers.JsonRpcSigner;
}

class WalletConnector {
  async connectMetaMask(): Promise<WalletConnection> {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
    }

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please unlock MetaMask.');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
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
    // Check for Coinbase Wallet
    const coinbaseProvider = (window as any).coinbaseWalletExtension || window.ethereum;
    
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
