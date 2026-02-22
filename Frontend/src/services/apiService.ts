import { API_CONFIG, getAuthHeaders } from '@/config/api';

/**
 * Comprehensive API Service for DeFiScore Platform
 * Connects to all available backend endpoints
 */

// ============================================================================
// MARKET DATA API (Available)
// ============================================================================

export interface MarketStats {
  totalMarketCap: number;
  totalVolume24h: number;
  totalValueLocked: number;
  totalSupply: number;
  totalBorrow: number;
  volumeChange24h: number;
  dominance: {
    symbol: string;
    percentage: number;
  };
  timestamp: string;
}

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  icon: string;
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  circulatingSupply: number;
  totalSupply: number;
  sparklineData: number[];
  supplyApy?: number;
}

export interface ChartDataPoint {
  timestamp: string;
  value: number;
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
  }

  // ============================================================================
  // MARKET DATA ENDPOINTS
  // ============================================================================

  async getMarketStats(): Promise<MarketStats> {
    const response = await fetch(`${this.baseUrl}/api/v1/market/stats`);
    if (!response.ok) throw new Error('Failed to fetch market stats');
    return response.json();
  }

  async getTopAssets(limit: number = 10): Promise<Asset[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/market/assets?limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch assets');
    return response.json();
  }

  async getMarketChartData(metric: string, days: number = 30): Promise<{ metric: string; days: number; data: ChartDataPoint[] }> {
    const response = await fetch(`${this.baseUrl}/api/v1/market/chart/${metric}?days=${days}`);
    if (!response.ok) throw new Error('Failed to fetch chart data');
    return response.json();
  }

  async getAssetDetails(assetId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/market/asset/${assetId}`);
    if (!response.ok) throw new Error('Failed to fetch asset details');
    return response.json();
  }

  // ============================================================================
  // CREDIT SCORE ENDPOINTS
  // ============================================================================

  async calculateCreditScore(walletAddress: string, token: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/credit-score/calculate`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ wallet_address: walletAddress }),
    });
    if (!response.ok) throw new Error('Failed to calculate credit score');
    return response.json();
  }

  async getMyCreditScore(token: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/credit-score/my-score`, {
      headers: getAuthHeaders(token),
    });
    if (!response.ok) throw new Error('Failed to fetch credit score');
    return response.json();
  }

  async refreshCreditScore(walletAddress: string, token: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/credit-score/refresh`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ wallet_address: walletAddress }),
    });
    if (!response.ok) throw new Error('Failed to refresh credit score');
    return response.json();
  }

  async getJobStatus(jobId: string, token: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/credit-score/status/${jobId}`, {
      headers: getAuthHeaders(token),
    });
    if (!response.ok) throw new Error('Failed to fetch job status');
    return response.json();
  }

  // ============================================================================
  // DATA INGESTION ENDPOINTS
  // ============================================================================

  async ingestWalletData(walletAddress: string, networks: string[], token: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/ingestion/wallet/${walletAddress}/ingest`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ networks }),
    });
    if (!response.ok) throw new Error('Failed to ingest wallet data');
    return response.json();
  }

  async getWalletSummary(walletAddress: string, token: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/ingestion/wallet/${walletAddress}/summary-multi-chain`, {
      headers: getAuthHeaders(token),
    });
    if (!response.ok) throw new Error('Failed to fetch wallet summary');
    return response.json();
  }

  async getSupportedNetworks(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/ingestion/networks`);
    if (!response.ok) throw new Error('Failed to fetch supported networks');
    return response.json();
  }

  // ============================================================================
  // FEATURE EXTRACTION ENDPOINTS
  // ============================================================================

  async extractWalletFeatures(walletAddress: string, networks: string[], token: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/features/wallet/${walletAddress}/extract`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ networks }),
    });
    if (!response.ok) throw new Error('Failed to extract features');
    return response.json();
  }

  async getFeatureSummary(walletAddress: string, token: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/features/wallet/${walletAddress}/summary`, {
      headers: getAuthHeaders(token),
    });
    if (!response.ok) throw new Error('Failed to fetch feature summary');
    return response.json();
  }

  // ============================================================================
  // ZK PROOF ENDPOINTS
  // ============================================================================

  async generateZKProof(threshold: number, token: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/credit-score/generate-zk-proof`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ threshold }),
    });
    if (!response.ok) throw new Error('Failed to generate ZK proof');
    return response.json();
  }

  async verifyZKProof(proof: any, publicSignals: any, threshold: number): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/credit-score/verify-zk-proof`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ proof, publicSignals, threshold }),
    });
    if (!response.ok) throw new Error('Failed to verify ZK proof');
    return response.json();
  }

  async getZKCircuitInfo(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/credit-score/zk-circuit-info`);
    if (!response.ok) throw new Error('Failed to fetch ZK circuit info');
    return response.json();
  }

  // ============================================================================
  // ANALYTICS ENDPOINTS
  // ============================================================================

  async getActiveUsers(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/analytics/active-users`);
    if (!response.ok) throw new Error('Failed to fetch active users');
    return response.json();
  }

  async getPlatformStats(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/analytics/platform-stats`);
    if (!response.ok) throw new Error('Failed to fetch platform stats');
    return response.json();
  }

  // ============================================================================
  // USER DASHBOARD ENDPOINTS
  // ============================================================================

  async getWalletBalance(token: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/dashboard/wallet-balance`, {
      headers: getAuthHeaders(token),
    });
    if (!response.ok) throw new Error('Failed to fetch wallet balance');
    return response.json();
  }

  async getUserStats(token: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/dashboard/user-stats`, {
      headers: getAuthHeaders(token),
    });
    if (!response.ok) throw new Error('Failed to fetch user stats');
    return response.json();
  }

  async getProtocolPositions(token: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/dashboard/protocol-positions`, {
      headers: getAuthHeaders(token),
    });
    if (!response.ok) throw new Error('Failed to fetch protocol positions');
    return response.json();
  }

  // ============================================================================
  // MONITORING ENDPOINTS
  // ============================================================================

  async getHealthCheck(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/monitoring/health`);
    if (!response.ok) throw new Error('Health check failed');
    return response.json();
  }

  async getMyActivity(token: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/monitoring/my-activity`, {
      headers: getAuthHeaders(token),
    });
    if (!response.ok) throw new Error('Failed to fetch activity');
    return response.json();
  }

  // ============================================================================
  // LENDING MARKETPLACE API
  // ============================================================================

  /**
   * Get supplier stats (total supplied, earned interest, etc.)
   */
  async getSupplierStats(token: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/lending/supplier-stats`, {
      headers: getAuthHeaders(token)
    });

    if (!response.ok) {
      throw new Error(`Failed to get supplier stats: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create supply intent
   */
  async createSupplyIntent(token: string, data: {
    currency: string;
    max_amount: number;
    min_credit_score: number;
    max_apy: number;
  }) {
    const response = await fetch(`${this.baseUrl}/api/v1/lending/supply-intent`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to create supply intent: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get all supplier intents (for borrowers to browse) - Public endpoint
   */
  async getPublicSupplierIntents(currency?: string, excludeAddress?: string) {
    const url = new URL(`${this.baseUrl}/api/v1/supply-marketplace/supplier-intents`);
    if (currency) {
      url.searchParams.append('currency', currency);
    }
    if (excludeAddress) {
      url.searchParams.append('exclude_address', excludeAddress);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Failed to get supplier intents: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get all supplier intents (for borrowers to browse) - Authenticated
   */
  async getSupplierIntents(token: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/lending/supplier-intents`, {
      headers: getAuthHeaders(token)
    });

    if (!response.ok) {
      throw new Error(`Failed to get supplier intents: ${response.statusText}`);
    }

    return response.json();
  }

  async createBorrowRequest(token: string, data: {
    supplier_id: string;
    currency: string;
    amount: number;
    collateral_percent: number;
    duration_days: number;
  }) {
    const response = await fetch(`${this.baseUrl}/api/v1/lending/borrow-requests`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(`Failed to create borrow request: ${errorData.detail || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get my borrow requests
   */
  async getMyBorrowRequests(token: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/lending/borrow-requests/my-requests`, {
      headers: getAuthHeaders(token)
    });

    if (!response.ok) {
      throw new Error(`Failed to get borrow requests: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get matched borrow requests for supplier
   */
  async getMatchedBorrowRequests(token: string, currency?: string) {
    const url = new URL(`${this.baseUrl}/api/v1/lending/supply-intent/matched-requests`);
    if (currency) {
      url.searchParams.append('currency', currency);
    }

    const response = await fetch(url.toString(), {
      headers: getAuthHeaders(token)
    });

    if (!response.ok) {
      throw new Error(`Failed to get matched requests: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Review borrow request (initiate ZK verification)
   */
  async reviewBorrowRequest(token: string, data: {
    request_id: string;
    credit_score_threshold: number;
  }) {
    const response = await fetch(`${this.baseUrl}/api/v1/lending/supply-intent/review-request`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to review request: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Verify ZK proof for borrow request
   */
  async verifyZKProofForRequest(token: string, requestId: string, proofData: any) {
    const response = await fetch(`${this.baseUrl}/api/v1/lending/supply-intent/verify-proof/${requestId}`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(proofData)
    });

    if (!response.ok) {
      throw new Error(`Failed to verify proof: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Generate ZK proof for borrower (supplier-initiated)
   * Automatically retries if credit score calculation is in progress (202)
   */
  async generateZKProofForBorrower(
    token: string, 
    data: {
      request_id: string;
      borrower_address: string;
      threshold: number;
    },
    options?: {
      maxRetries?: number;
      retryDelay?: number;
      onProgress?: (attempt: number, maxRetries: number) => void;
    }
  ) {
    const maxRetries = options?.maxRetries || 5; // 5 retries = 10 minutes max
    const retryDelay = options?.retryDelay || 120000; // 2 minutes (120 seconds) between retries
    
    console.log('[API] Generating ZK proof for borrower:', {
      endpoint: `${this.baseUrl}/api/v1/lending/supply-intent/generate-proof-for-borrower`,
      hasToken: !!token,
      tokenPreview: token ? `${token.substring(0, 20)}...` : 'none',
      data,
      maxRetries,
      retryDelay
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[API] Attempt ${attempt}/${maxRetries}`);
      
      const response = await fetch(`${this.baseUrl}/api/v1/lending/supply-intent/generate-proof-for-borrower`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(data)
      });

      console.log('[API] Response status:', response.status, response.statusText);

      if (response.status === 202) {
        // Credit score calculation in progress
        const errorData = await response.json().catch(() => ({ detail: { message: 'Processing' } }));
        console.log(`[API] Credit score calculation in progress (attempt ${attempt}/${maxRetries})`);
        
        if (attempt < maxRetries) {
          // Notify progress callback
          if (options?.onProgress) {
            options.onProgress(attempt, maxRetries);
          }
          
          // Wait before retrying
          console.log(`[API] Waiting ${retryDelay/1000} seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue; // Retry
        } else {
          // Max retries reached
          const error: any = new Error('Credit score calculation timeout. Please try again later.');
          error.status = 202;
          error.data = errorData.detail;
          throw error;
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        console.error('[API] Error response:', errorData);
        const error: any = new Error(`Failed to generate ZK proof: ${errorData.detail || response.statusText}`);
        error.status = response.status;
        error.statusText = response.statusText;
        throw error;
      }

      // Success!
      const result = await response.json();
      console.log('[API] Success:', result);
      return result;
    }

    // Should never reach here, but just in case
    throw new Error('Unexpected error in ZK proof generation');
  }

  /**
   * Approve borrow request
   */
  async approveBorrowRequest(token: string, data: {
    request_id: string;
    offered_apy: number;
    terms: string | null;
  }) {
    const response = await fetch(`${this.baseUrl}/api/v1/lending/supply-intent/approve-request`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to approve request: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Reject borrow request
   */
  async rejectBorrowRequest(token: string, requestId: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/lending/supply-intent/reject-request/${requestId}`, {
      method: 'POST',
      headers: getAuthHeaders(token)
    });

    if (!response.ok) {
      throw new Error(`Failed to reject request: ${response.statusText}`);
    }

    return response.json();
  }

  // ============================================================================
  // BLOCKCHAIN LENDING API
  // ============================================================================

  /**
   * Create loan on blockchain after supplier approval
   */
  async createLoanOnChain(token: string, data: {
    request_id: string;
    collateral_token: string;
    loan_token: string;
  }) {
    const response = await fetch(`${this.baseUrl}/api/v1/blockchain/lending/create-loan-on-chain`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to create loan on blockchain: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get collateral deposit instructions
   */
  async getCollateralInstructions(token: string, loanId: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/blockchain/lending/collateral-instructions/${loanId}`, {
      headers: getAuthHeaders(token)
    });

    if (!response.ok) {
      throw new Error(`Failed to get collateral instructions: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Confirm collateral has been deposited
   */
  async confirmCollateralDeposit(token: string, loanId: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/blockchain/lending/confirm-collateral-deposit/${loanId}`, {
      method: 'POST',
      headers: getAuthHeaders(token)
    });

    if (!response.ok) {
      throw new Error(`Failed to confirm collateral deposit: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get loan funding instructions
   */
  async getFundingInstructions(token: string, loanId: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/blockchain/lending/funding-instructions/${loanId}`, {
      headers: getAuthHeaders(token)
    });

    if (!response.ok) {
      throw new Error(`Failed to get funding instructions: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Confirm loan has been funded
   */
  async confirmLoanFunded(token: string, loanId: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/blockchain/lending/confirm-loan-funded/${loanId}`, {
      method: 'POST',
      headers: getAuthHeaders(token)
    });

    if (!response.ok) {
      throw new Error(`Failed to confirm loan funding: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get loan details
   */
  async getLoanDetails(token: string, loanId: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/blockchain/lending/loan-details/${loanId}`, {
      headers: getAuthHeaders(token)
    });

    if (!response.ok) {
      throw new Error(`Failed to get loan details: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get all my loans (as borrower or lender)
   */
  async getMyLoans(token: string, role?: 'borrower' | 'lender') {
    const url = new URL(`${this.baseUrl}/api/v1/blockchain/lending/my-loans`);
    if (role) {
      url.searchParams.append('role', role);
    }

    const response = await fetch(url.toString(), {
      headers: getAuthHeaders(token)
    });

    if (!response.ok) {
      throw new Error(`Failed to get my loans: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get repayment instructions
   */
  async getRepaymentInstructions(token: string, loanId: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/blockchain/lending/repayment-instructions/${loanId}`, {
      headers: getAuthHeaders(token)
    });

    if (!response.ok) {
      throw new Error(`Failed to get repayment instructions: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Confirm repayment has been made
   */
  async confirmRepayment(token: string, loanId: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/blockchain/lending/confirm-repayment/${loanId}`, {
      method: 'POST',
      headers: getAuthHeaders(token)
    });

    if (!response.ok) {
      throw new Error(`Failed to confirm repayment: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Mark loan as defaulted
   */
  async markLoanDefaulted(token: string, loanId: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/blockchain/lending/mark-defaulted/${loanId}`, {
      method: 'POST',
      headers: getAuthHeaders(token)
    });

    if (!response.ok) {
      throw new Error(`Failed to mark loan as defaulted: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Liquidate collateral
   */
  async liquidateCollateral(token: string, loanId: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/blockchain/lending/liquidate-collateral/${loanId}`, {
      method: 'POST',
      headers: getAuthHeaders(token)
    });

    if (!response.ok) {
      throw new Error(`Failed to liquidate collateral: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Confirm liquidation
   */
  async confirmLiquidation(token: string, loanId: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/blockchain/lending/confirm-liquidation/${loanId}`, {
      method: 'POST',
      headers: getAuthHeaders(token)
    });

    if (!response.ok) {
      throw new Error(`Failed to confirm liquidation: ${response.statusText}`);
    }

    return response.json();
  }

  // ============================================================================
  // SUPPLY MARKETPLACE API (Public - No Auth Required)
  // ============================================================================

  /**
   * Get marketplace statistics
   */
  async getMarketplaceStats() {
    const response = await fetch(`${this.baseUrl}/api/v1/supply-marketplace/stats`);

    if (!response.ok) {
      throw new Error(`Failed to get marketplace stats: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get top supply opportunities
   */
  async getTopSupplyOpportunities() {
    const response = await fetch(`${this.baseUrl}/api/v1/supply-marketplace/top-opportunities`);

    if (!response.ok) {
      throw new Error(`Failed to get supply opportunities: ${response.statusText}`);
    }

    return response.json();
  }
}

export const apiService = new ApiService();
