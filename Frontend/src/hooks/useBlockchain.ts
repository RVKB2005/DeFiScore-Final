/**
 * Blockchain Interaction Hook
 * Handles all Web3 interactions for loan execution
 * PRODUCTION IMPLEMENTATION - NO SIMULATION
 */
import { useState } from 'react';
import { ethers } from 'ethers';
import { toast } from 'sonner';

// Contract ABIs (minimal - only functions we need)
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)'
];

const LENDING_ESCROW_ABI = [
  'function depositCollateral(bytes32 loanId) external',
  'function fundLoan(bytes32 loanId) external',
  'function makeRepayment(bytes32 loanId, uint256 amount) external',
  'function liquidateCollateral(bytes32 loanId) external',
  'function loans(bytes32 loanId) external view returns (tuple(address borrower, address lender, address loanToken, address collateralToken, uint256 loanAmount, uint256 collateralAmount, uint256 interestRate, uint256 duration, uint256 startTime, uint256 dueDate, uint256 amountRepaid, uint8 status))'
];

// Contract addresses on Polygon Amoy
const CONTRACTS = {
  80002: { // Polygon Amoy
    LENDING_ESCROW: '0x736B93CcdC4ad81cEc56d34eA9931db0EDdde10c',
    USDC: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582' // Mock USDC on Amoy
  }
};

export function useBlockchain() {
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const getProvider = () => {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed');
    }
    return new ethers.BrowserProvider(window.ethereum);
  };

  const getSigner = async () => {
    const provider = getProvider();
    return await provider.getSigner();
  };

  const getChainId = async () => {
    const provider = getProvider();
    const network = await provider.getNetwork();
    return Number(network.chainId);
  };

  const switchToAmoy = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x13882' }], // 80002 in hex
      });
    } catch (error: any) {
      // Chain not added, add it
      if (error.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x13882',
            chainName: 'Polygon Amoy Testnet',
            nativeCurrency: {
              name: 'MATIC',
              symbol: 'MATIC',
              decimals: 18
            },
            rpcUrls: ['https://rpc-amoy.polygon.technology/'],
            blockExplorerUrls: ['https://amoy.polygonscan.com/']
          }]
        });
      } else {
        throw error;
      }
    }
  };

  /**
   * Approve ERC20 tokens for spending
   */
  const approveToken = async (
    tokenAddress: string,
    spenderAddress: string,
    amount: string
  ): Promise<string> => {
    try {
      setLoading(true);
      
      const chainId = await getChainId();
      if (chainId !== 80002) {
        await switchToAmoy();
      }

      const signer = await getSigner();
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

      // Check current allowance
      const currentAllowance = await tokenContract.allowance(
        await signer.getAddress(),
        spenderAddress
      );

      const amountWei = ethers.parseUnits(amount, 18); // Assuming 18 decimals

      if (currentAllowance >= amountWei) {
        toast.success('Token already approved');
        return '';
      }

      toast.info('Approving tokens... Please confirm in MetaMask');

      const tx = await tokenContract.approve(spenderAddress, amountWei);
      
      toast.info('Waiting for approval confirmation...', { id: 'approve' });
      
      const receipt = await tx.wait();
      
      toast.success('Tokens approved successfully!', { id: 'approve' });
      
      setTxHash(receipt.hash);
      return receipt.hash;

    } catch (error: any) {
      console.error('Token approval failed:', error);
      if (error.code === 4001) {
        toast.error('Transaction rejected by user');
      } else {
        toast.error(error.message || 'Token approval failed');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Deposit collateral for a loan
   */
  const depositCollateral = async (
    loanId: string,
    collateralToken: string,
    collateralAmount: string
  ): Promise<string> => {
    try {
      setLoading(true);

      const chainId = await getChainId();
      if (chainId !== 80002) {
        await switchToAmoy();
      }

      const contracts = CONTRACTS[80002];
      
      // Step 1: Approve tokens
      toast.info('Step 1/2: Approving collateral tokens...');
      await approveToken(collateralToken, contracts.LENDING_ESCROW, collateralAmount);

      // Step 2: Deposit collateral
      toast.info('Step 2/2: Depositing collateral... Please confirm in MetaMask');

      const signer = await getSigner();
      const lendingContract = new ethers.Contract(
        contracts.LENDING_ESCROW,
        LENDING_ESCROW_ABI,
        signer
      );

      // Convert loan ID to bytes32
      const loanIdBytes = ethers.id(loanId);

      const tx = await lendingContract.depositCollateral(loanIdBytes);
      
      toast.info('Waiting for collateral deposit confirmation...', { id: 'deposit' });
      
      const receipt = await tx.wait();
      
      toast.success('Collateral deposited successfully!', { id: 'deposit' });
      
      setTxHash(receipt.hash);
      return receipt.hash;

    } catch (error: any) {
      console.error('Collateral deposit failed:', error);
      if (error.code === 4001) {
        toast.error('Transaction rejected by user');
      } else {
        toast.error(error.message || 'Collateral deposit failed');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fund a loan (lender)
   */
  const fundLoan = async (
    loanId: string,
    loanToken: string,
    loanAmount: string
  ): Promise<string> => {
    try {
      setLoading(true);

      const chainId = await getChainId();
      if (chainId !== 80002) {
        await switchToAmoy();
      }

      const contracts = CONTRACTS[80002];
      
      // Step 1: Approve tokens
      toast.info('Step 1/2: Approving loan tokens...');
      await approveToken(loanToken, contracts.LENDING_ESCROW, loanAmount);

      // Step 2: Fund loan
      toast.info('Step 2/2: Funding loan... Please confirm in MetaMask');

      const signer = await getSigner();
      const lendingContract = new ethers.Contract(
        contracts.LENDING_ESCROW,
        LENDING_ESCROW_ABI,
        signer
      );

      const loanIdBytes = ethers.id(loanId);

      const tx = await lendingContract.fundLoan(loanIdBytes);
      
      toast.info('Waiting for loan funding confirmation...', { id: 'fund' });
      
      const receipt = await tx.wait();
      
      toast.success('Loan funded successfully!', { id: 'fund' });
      
      setTxHash(receipt.hash);
      return receipt.hash;

    } catch (error: any) {
      console.error('Loan funding failed:', error);
      if (error.code === 4001) {
        toast.error('Transaction rejected by user');
      } else {
        toast.error(error.message || 'Loan funding failed');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Make a repayment
   */
  const makeRepayment = async (
    loanId: string,
    loanToken: string,
    repaymentAmount: string
  ): Promise<string> => {
    try {
      setLoading(true);

      const chainId = await getChainId();
      if (chainId !== 80002) {
        await switchToAmoy();
      }

      const contracts = CONTRACTS[80002];
      
      // Step 1: Approve tokens
      toast.info('Step 1/2: Approving repayment tokens...');
      await approveToken(loanToken, contracts.LENDING_ESCROW, repaymentAmount);

      // Step 2: Make repayment
      toast.info('Step 2/2: Making repayment... Please confirm in MetaMask');

      const signer = await getSigner();
      const lendingContract = new ethers.Contract(
        contracts.LENDING_ESCROW,
        LENDING_ESCROW_ABI,
        signer
      );

      const loanIdBytes = ethers.id(loanId);
      const amountWei = ethers.parseUnits(repaymentAmount, 18);

      const tx = await lendingContract.makeRepayment(loanIdBytes, amountWei);
      
      toast.info('Waiting for repayment confirmation...', { id: 'repay' });
      
      const receipt = await tx.wait();
      
      toast.success('Repayment successful!', { id: 'repay' });
      
      setTxHash(receipt.hash);
      return receipt.hash;

    } catch (error: any) {
      console.error('Repayment failed:', error);
      if (error.code === 4001) {
        toast.error('Transaction rejected by user');
      } else {
        toast.error(error.message || 'Repayment failed');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Liquidate collateral (lender, after default)
   */
  const liquidateCollateral = async (loanId: string): Promise<string> => {
    try {
      setLoading(true);

      const chainId = await getChainId();
      if (chainId !== 80002) {
        await switchToAmoy();
      }

      const contracts = CONTRACTS[80002];

      toast.info('Liquidating collateral... Please confirm in MetaMask');

      const signer = await getSigner();
      const lendingContract = new ethers.Contract(
        contracts.LENDING_ESCROW,
        LENDING_ESCROW_ABI,
        signer
      );

      const loanIdBytes = ethers.id(loanId);

      const tx = await lendingContract.liquidateCollateral(loanIdBytes);
      
      toast.info('Waiting for liquidation confirmation...', { id: 'liquidate' });
      
      const receipt = await tx.wait();
      
      toast.success('Collateral liquidated successfully!', { id: 'liquidate' });
      
      setTxHash(receipt.hash);
      return receipt.hash;

    } catch (error: any) {
      console.error('Liquidation failed:', error);
      if (error.code === 4001) {
        toast.error('Transaction rejected by user');
      } else {
        toast.error(error.message || 'Liquidation failed');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    txHash,
    depositCollateral,
    fundLoan,
    makeRepayment,
    liquidateCollateral,
    approveToken,
    switchToAmoy
  };
}
