import { ethers } from 'ethers';
import { toast } from 'sonner';

const LENDING_ESCROW_ADDRESS = import.meta.env.VITE_LENDING_ESCROW_ADDRESS || '';

// Contract ABI - will be updated after actual deployment
const LENDING_ESCROW_ABI = [
  {
    "inputs": [
      { "internalType": "bytes32", "name": "loanId", "type": "bytes32" },
      { "internalType": "address", "name": "borrower", "type": "address" },
      { "internalType": "address", "name": "lender", "type": "address" },
      { "internalType": "address", "name": "loanToken", "type": "address" },
      { "internalType": "address", "name": "collateralToken", "type": "address" },
      { "internalType": "uint256", "name": "loanAmount", "type": "uint256" },
      { "internalType": "uint256", "name": "collateralAmount", "type": "uint256" },
      { "internalType": "uint256", "name": "interestRate", "type": "uint256" },
      { "internalType": "uint256", "name": "durationDays", "type": "uint256" }
    ],
    "name": "createLoan",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "loanId", "type": "bytes32" }],
    "name": "depositCollateral",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "loanId", "type": "bytes32" }],
    "name": "fundLoan",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "loanId", "type": "bytes32" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "makeRepayment",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "loanId", "type": "bytes32" }],
    "name": "markAsDefaulted",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "loanId", "type": "bytes32" }],
    "name": "liquidateCollateral",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "loanId", "type": "bytes32" }],
    "name": "getLoan",
    "outputs": [
      {
        "components": [
          { "internalType": "bytes32", "name": "id", "type": "bytes32" },
          { "internalType": "address", "name": "borrower", "type": "address" },
          { "internalType": "address", "name": "lender", "type": "address" },
          { "internalType": "address", "name": "loanToken", "type": "address" },
          { "internalType": "address", "name": "collateralToken", "type": "address" },
          { "internalType": "uint256", "name": "loanAmount", "type": "uint256" },
          { "internalType": "uint256", "name": "collateralAmount", "type": "uint256" },
          { "internalType": "uint256", "name": "interestRate", "type": "uint256" },
          { "internalType": "uint256", "name": "durationDays", "type": "uint256" },
          { "internalType": "uint256", "name": "startTime", "type": "uint256" },
          { "internalType": "uint256", "name": "dueDate", "type": "uint256" },
          { "internalType": "uint256", "name": "totalRepayment", "type": "uint256" },
          { "internalType": "uint256", "name": "amountRepaid", "type": "uint256" },
          { "internalType": "enum LendingEscrow.LoanStatus", "name": "status", "type": "uint8" }
        ],
        "internalType": "struct LendingEscrow.Loan",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "loanId", "type": "bytes32" }],
    "name": "isLoanOverdue",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "loanId", "type": "bytes32" },
      { "indexed": true, "internalType": "address", "name": "borrower", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "CollateralDeposited",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "loanId", "type": "bytes32" },
      { "indexed": true, "internalType": "address", "name": "lender", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "LoanFunded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "loanId", "type": "bytes32" },
      { "indexed": true, "internalType": "address", "name": "borrower", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "remainingDebt", "type": "uint256" }
    ],
    "name": "RepaymentMade",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "loanId", "type": "bytes32" },
      { "indexed": true, "internalType": "address", "name": "borrower", "type": "address" }
    ],
    "name": "LoanRepaid",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "loanId", "type": "bytes32" },
      { "indexed": true, "internalType": "address", "name": "borrower", "type": "address" }
    ],
    "name": "LoanDefaulted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "loanId", "type": "bytes32" },
      { "indexed": true, "internalType": "address", "name": "lender", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "CollateralLiquidated",
    "type": "event"
  }
];

export interface LoanDetails {
  loanId: string;
  borrower: string;
  lender: string;
  loanToken: string;
  collateralToken: string;
  loanAmount: string;
  collateralAmount: string;
  interestRate: number;
  durationDays: number;
  startTime: number;
  dueDate: number;
  totalRepayment: string;
  amountRepaid: string;
  status: number;
}

export enum LoanStatus {
  PENDING = 0,
  COLLATERALIZED = 1,
  ACTIVE = 2,
  REPAID = 3,
  DEFAULTED = 4,
  LIQUIDATED = 5
}

class BlockchainService {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private contract: ethers.Contract | null = null;

  async initialize(provider: any) {
    try {
      this.provider = new ethers.BrowserProvider(provider);
      this.signer = await this.provider.getSigner();
      
      if (LENDING_ESCROW_ADDRESS) {
        this.contract = new ethers.Contract(
          LENDING_ESCROW_ADDRESS,
          LENDING_ESCROW_ABI,
          this.signer
        );
      }
    } catch (error) {
      console.error('Failed to initialize blockchain service:', error);
      throw error;
    }
  }

  /**
   * Deposit collateral for a loan
   */
  async depositCollateral(
    loanId: string,
    collateralToken: string,
    collateralAmount: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.contract || !this.signer) {
      return { success: false, error: 'Blockchain service not initialized' };
    }

    try {
      // Convert loan ID to bytes32
      const loanIdBytes = ethers.id(loanId);

      // First, approve the contract to spend collateral tokens
      const tokenContract = new ethers.Contract(
        collateralToken,
        ['function approve(address spender, uint256 amount) returns (bool)'],
        this.signer
      );

      toast.loading('Approving collateral tokens...', { id: 'collateral' });
      
      const approveTx = await tokenContract.approve(
        LENDING_ESCROW_ADDRESS,
        ethers.parseEther(collateralAmount)
      );
      await approveTx.wait();

      toast.loading('Depositing collateral...', { id: 'collateral' });

      // Deposit collateral
      const tx = await this.contract.depositCollateral(loanIdBytes);
      const receipt = await tx.wait();

      toast.success('Collateral deposited successfully!', { id: 'collateral' });

      return {
        success: true,
        txHash: receipt.hash
      };
    } catch (error: any) {
      console.error('Failed to deposit collateral:', error);
      toast.error('Failed to deposit collateral', { id: 'collateral' });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Fund a loan (lender provides loan amount)
   */
  async fundLoan(
    loanId: string,
    loanToken: string,
    loanAmount: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.contract || !this.signer) {
      return { success: false, error: 'Blockchain service not initialized' };
    }

    try {
      const loanIdBytes = ethers.id(loanId);

      // Approve loan tokens
      const tokenContract = new ethers.Contract(
        loanToken,
        ['function approve(address spender, uint256 amount) returns (bool)'],
        this.signer
      );

      toast.loading('Approving loan tokens...', { id: 'funding' });
      
      const approveTx = await tokenContract.approve(
        LENDING_ESCROW_ADDRESS,
        ethers.parseEther(loanAmount)
      );
      await approveTx.wait();

      toast.loading('Funding loan...', { id: 'funding' });

      // Fund the loan
      const tx = await this.contract.fundLoan(loanIdBytes);
      const receipt = await tx.wait();

      toast.success('Loan funded successfully!', { id: 'funding' });

      return {
        success: true,
        txHash: receipt.hash
      };
    } catch (error: any) {
      console.error('Failed to fund loan:', error);
      toast.error('Failed to fund loan', { id: 'funding' });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Make a repayment
   */
  async makeRepayment(
    loanId: string,
    loanToken: string,
    amount: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.contract || !this.signer) {
      return { success: false, error: 'Blockchain service not initialized' };
    }

    try {
      const loanIdBytes = ethers.id(loanId);

      // Approve repayment tokens
      const tokenContract = new ethers.Contract(
        loanToken,
        ['function approve(address spender, uint256 amount) returns (bool)'],
        this.signer
      );

      toast.loading('Approving repayment tokens...', { id: 'repayment' });
      
      const approveTx = await tokenContract.approve(
        LENDING_ESCROW_ADDRESS,
        ethers.parseEther(amount)
      );
      await approveTx.wait();

      toast.loading('Processing repayment...', { id: 'repayment' });

      // Make repayment
      const tx = await this.contract.makeRepayment(
        loanIdBytes,
        ethers.parseEther(amount)
      );
      const receipt = await tx.wait();

      toast.success('Repayment successful!', { id: 'repayment' });

      return {
        success: true,
        txHash: receipt.hash
      };
    } catch (error: any) {
      console.error('Failed to make repayment:', error);
      toast.error('Failed to process repayment', { id: 'repayment' });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Mark loan as defaulted (if past due)
   */
  async markAsDefaulted(loanId: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.contract) {
      return { success: false, error: 'Blockchain service not initialized' };
    }

    try {
      const loanIdBytes = ethers.id(loanId);

      toast.loading('Marking loan as defaulted...', { id: 'default' });

      const tx = await this.contract.markAsDefaulted(loanIdBytes);
      const receipt = await tx.wait();

      toast.success('Loan marked as defaulted', { id: 'default' });

      return {
        success: true,
        txHash: receipt.hash
      };
    } catch (error: any) {
      console.error('Failed to mark as defaulted:', error);
      toast.error('Failed to mark loan as defaulted', { id: 'default' });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Liquidate collateral (lender claims after default)
   */
  async liquidateCollateral(loanId: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.contract) {
      return { success: false, error: 'Blockchain service not initialized' };
    }

    try {
      const loanIdBytes = ethers.id(loanId);

      toast.loading('Liquidating collateral...', { id: 'liquidate' });

      const tx = await this.contract.liquidateCollateral(loanIdBytes);
      const receipt = await tx.wait();

      toast.success('Collateral liquidated successfully!', { id: 'liquidate' });

      return {
        success: true,
        txHash: receipt.hash
      };
    } catch (error: any) {
      console.error('Failed to liquidate collateral:', error);
      toast.error('Failed to liquidate collateral', { id: 'liquidate' });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get loan details from blockchain
   */
  async getLoanDetails(loanId: string): Promise<LoanDetails | null> {
    if (!this.contract) {
      return null;
    }

    try {
      const loanIdBytes = ethers.id(loanId);
      const loan = await this.contract.getLoan(loanIdBytes);

      return {
        loanId,
        borrower: loan[1],
        lender: loan[2],
        loanToken: loan[3],
        collateralToken: loan[4],
        loanAmount: ethers.formatEther(loan[5]),
        collateralAmount: ethers.formatEther(loan[6]),
        interestRate: Number(loan[7]) / 100, // Convert from basis points
        durationDays: Number(loan[8]),
        startTime: Number(loan[9]),
        dueDate: Number(loan[10]),
        totalRepayment: ethers.formatEther(loan[11]),
        amountRepaid: ethers.formatEther(loan[12]),
        status: Number(loan[13])
      };
    } catch (error) {
      console.error('Failed to get loan details:', error);
      return null;
    }
  }

  /**
   * Check if loan is overdue
   */
  async isLoanOverdue(loanId: string): Promise<boolean> {
    if (!this.contract) {
      return false;
    }

    try {
      const loanIdBytes = ethers.id(loanId);
      return await this.contract.isLoanOverdue(loanIdBytes);
    } catch (error) {
      console.error('Failed to check if loan is overdue:', error);
      return false;
    }
  }

  /**
   * Listen to contract events
   */
  setupEventListeners(callbacks: {
    onCollateralDeposited?: (loanId: string, borrower: string, amount: string) => void;
    onLoanFunded?: (loanId: string, lender: string, amount: string) => void;
    onRepaymentMade?: (loanId: string, borrower: string, amount: string, remaining: string) => void;
    onLoanRepaid?: (loanId: string, borrower: string) => void;
    onLoanDefaulted?: (loanId: string, borrower: string) => void;
    onCollateralLiquidated?: (loanId: string, lender: string, amount: string) => void;
  }) {
    if (!this.contract) return;

    if (callbacks.onCollateralDeposited) {
      this.contract.on('CollateralDeposited', (loanId, borrower, amount) => {
        callbacks.onCollateralDeposited!(
          ethers.decodeBytes32String(loanId),
          borrower,
          ethers.formatEther(amount)
        );
      });
    }

    if (callbacks.onLoanFunded) {
      this.contract.on('LoanFunded', (loanId, lender, amount) => {
        callbacks.onLoanFunded!(
          ethers.decodeBytes32String(loanId),
          lender,
          ethers.formatEther(amount)
        );
      });
    }

    if (callbacks.onRepaymentMade) {
      this.contract.on('RepaymentMade', (loanId, borrower, amount, remaining) => {
        callbacks.onRepaymentMade!(
          ethers.decodeBytes32String(loanId),
          borrower,
          ethers.formatEther(amount),
          ethers.formatEther(remaining)
        );
      });
    }

    if (callbacks.onLoanRepaid) {
      this.contract.on('LoanRepaid', (loanId, borrower) => {
        callbacks.onLoanRepaid!(
          ethers.decodeBytes32String(loanId),
          borrower
        );
      });
    }

    if (callbacks.onLoanDefaulted) {
      this.contract.on('LoanDefaulted', (loanId, borrower) => {
        callbacks.onLoanDefaulted!(
          ethers.decodeBytes32String(loanId),
          borrower
        );
      });
    }

    if (callbacks.onCollateralLiquidated) {
      this.contract.on('CollateralLiquidated', (loanId, lender, amount) => {
        callbacks.onCollateralLiquidated!(
          ethers.decodeBytes32String(loanId),
          lender,
          ethers.formatEther(amount)
        );
      });
    }
  }

  /**
   * Remove all event listeners
   */
  removeEventListeners() {
    if (this.contract) {
      this.contract.removeAllListeners();
    }
  }
}

export const blockchainService = new BlockchainService();
