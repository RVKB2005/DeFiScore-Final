import { API_CONFIG, getAuthHeaders } from '@/config/api';

export interface NonceResponse {
  nonce: string;
  message: string;
  expires_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  wallet_address: string;
}

export interface UserInfo {
  wallet_address: string;
  authenticated: boolean;
}

export interface WalletConnectionInfo {
  wallet_type: string;
  qr_code?: string;
  deep_link?: string;
}

class AuthService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
  }

  async requestNonce(address: string): Promise<NonceResponse> {
    const response = await fetch(`${this.baseUrl}${API_CONFIG.ENDPOINTS.AUTH.NONCE}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ address }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to request nonce' }));
      throw new Error(error.detail || 'Failed to request nonce');
    }

    return response.json();
  }

  async verifySignature(
    address: string,
    message: string,
    signature: string
  ): Promise<AuthResponse> {
    const response = await fetch(`${this.baseUrl}${API_CONFIG.ENDPOINTS.AUTH.VERIFY}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ address, message, signature }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Authentication failed' }));
      throw new Error(error.detail || 'Authentication failed');
    }

    return response.json();
  }

  async getUserInfo(token: string): Promise<UserInfo> {
    const response = await fetch(`${this.baseUrl}${API_CONFIG.ENDPOINTS.AUTH.ME}`, {
      method: 'GET',
      headers: getAuthHeaders(token),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to get user info' }));
      throw new Error(error.detail || 'Failed to get user info');
    }

    return response.json();
  }

  async logout(token: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}${API_CONFIG.ENDPOINTS.AUTH.LOGOUT}`, {
      method: 'POST',
      headers: getAuthHeaders(token),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Logout failed' }));
      throw new Error(error.detail || 'Logout failed');
    }
  }

  async getWalletConnectionInfo(
    walletType: string,
    connectionUrl?: string
  ): Promise<WalletConnectionInfo> {
    const url = new URL(`${this.baseUrl}${API_CONFIG.ENDPOINTS.AUTH.WALLET_INFO}/${walletType}`);
    if (connectionUrl) {
      url.searchParams.append('connection_url', connectionUrl);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to get wallet info' }));
      throw new Error(error.detail || 'Failed to get wallet info');
    }

    return response.json();
  }

  async startDataIngestion(address: string, token: string): Promise<{ job_id: string; status: string }> {
    const response = await fetch(`${this.baseUrl}/api/v1/ingestion/wallet/${address}/ingest`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({
        networks: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'] // Start with major networks
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to start ingestion' }));
      throw new Error(error.detail || 'Failed to start ingestion');
    }

    return response.json();
  }
}

export const authService = new AuthService();
