"""
Credit Score Configuration
Feature weights based on FICO methodology adapted for DeFi/blockchain

FICO Standard Weights (Traditional Finance):
- Payment History: 35%
- Amounts Owed: 30%
- Length of Credit History: 15%
- New Credit: 10%
- Credit Mix: 10%

DeFi Adaptation:
- Repayment Behavior: 35% (analogous to payment history)
- Capital Management: 30% (analogous to amounts owed)
- Wallet Longevity: 15% (analogous to credit history length)
- Activity Patterns: 10% (analogous to new credit)
- Protocol Diversity: 10% (analogous to credit mix)
"""

# Score range configuration
SCORE_MIN = 0
SCORE_MAX = 900
BASE_SCORE = 300  # Starting score for new wallets

# Score bands (for classification)
SCORE_BANDS = {
    "Poor": (0, 300),
    "Fair": (301, 500),
    "Good": (501, 700),
    "Excellent": (701, 900)
}

# ============================================================================
# POSITIVE CONTRIBUTION WEIGHTS (Total: 100%)
# ============================================================================

# 1. REPAYMENT BEHAVIOR (35% - Highest weight, analogous to FICO payment history)
REPAYMENT_WEIGHTS = {
    "repay_to_borrow_ratio": 0.25,      # 25% - Most critical: repayment discipline
    "no_liquidations_bonus": 0.10,       # 10% - Bonus for zero liquidations
}

# 2. CAPITAL MANAGEMENT (30% - Second highest, analogous to FICO amounts owed)
CAPITAL_WEIGHTS = {
    "current_balance": 0.15,             # 15% - Current financial capacity
    "balance_stability": 0.10,           # 10% - Low volatility indicates stability
    "max_balance_history": 0.05,         # 5% - Historical capital strength
}

# 3. WALLET LONGEVITY (15% - analogous to FICO credit history length)
LONGEVITY_WEIGHTS = {
    "wallet_age": 0.10,                  # 10% - Time since first transaction
    "active_days_ratio": 0.05,           # 5% - Consistency of activity
}

# 4. ACTIVITY PATTERNS (10% - analogous to FICO new credit)
ACTIVITY_WEIGHTS = {
    "transaction_frequency": 0.05,       # 5% - Regular activity
    "transaction_regularity": 0.05,      # 5% - Consistent patterns (not burst)
}

# 5. PROTOCOL DIVERSITY (10% - analogous to FICO credit mix)
PROTOCOL_WEIGHTS = {
    "protocol_interaction_count": 0.05,  # 5% - DeFi engagement
    "borrow_experience": 0.05,           # 5% - Lending protocol usage
}

# ============================================================================
# RISK PENALTIES (Negative contributions)
# ============================================================================

# Critical penalties (per occurrence)
LIQUIDATION_PENALTY = -100              # Severe: Each liquidation is a default event
FAILED_TX_PENALTY_BASE = -20            # Moderate: Pattern of failed transactions

# Gas behavior penalties (NEW - PRODUCTION)
GAS_SPIKE_PENALTY = -5                  # Per gas spike event (panic/inexperience indicator)
MAX_GAS_SPIKE_PENALTY = -50             # Maximum total gas spike penalty (cap at 10 spikes)

# Volatility penalties
HIGH_VOLATILITY_PENALTY = -50           # High balance volatility
SUDDEN_DROP_PENALTY = -15               # Per sudden balance drop (>50%)

# Inactivity penalties
DORMANCY_PENALTY_BASE = -30             # Long inactivity periods
ZERO_BALANCE_PENALTY = -10              # Per extended zero balance period

# Burst activity penalty (wash trading indicator)
BURST_ACTIVITY_PENALTY = -25            # Suspicious burst patterns

# ============================================================================
# NORMALIZATION PARAMETERS
# ============================================================================

# Balance thresholds (in ETH) for scoring
BALANCE_THRESHOLDS = {
    "micro": 0.01,
    "small": 0.1,
    "medium": 1.0,
    "large": 10.0,
    "whale": 100.0
}

# Wallet age thresholds (in days)
AGE_THRESHOLDS = {
    "new": 30,
    "established": 365,
    "veteran": 730  # 2 years
}

# Activity thresholds
ACTIVITY_THRESHOLDS = {
    "dormant": 0.0,
    "occasional": 0.1,  # <1 tx per 10 days
    "active": 1.0,      # 1-5 tx per day
    "hyperactive": 5.0  # >5 tx per day
}

# Volatility threshold (standard deviation in ETH)
HIGH_VOLATILITY_THRESHOLD = 1.0

# Inactivity threshold (days)
DORMANCY_THRESHOLD_DAYS = 180

# Burst activity threshold (ratio)
BURST_THRESHOLD = 0.5  # >50% of transactions in top 10% days

# ============================================================================
# FEATURE SCALING FUNCTIONS
# ============================================================================

def scale_wallet_age(age_days: int) -> float:
    """
    Scale wallet age to 0-1 range
    Uses logarithmic scaling to reward longevity with diminishing returns
    """
    if age_days <= 0:
        return 0.0
    # Log scale: 30 days = 0.3, 365 days = 0.7, 730+ days = 1.0
    import math
    scaled = math.log(age_days + 1) / math.log(730 + 1)
    return min(1.0, scaled)


def scale_balance(balance_eth: float) -> float:
    """
    Scale balance to 0-1 range
    Uses logarithmic scaling to avoid whale dominance
    """
    if balance_eth <= 0:
        return 0.0
    # Log scale: 0.1 ETH = 0.3, 1 ETH = 0.6, 10+ ETH = 1.0
    import math
    scaled = math.log(balance_eth + 1) / math.log(10 + 1)
    return min(1.0, scaled)


def scale_transaction_count(tx_count: int) -> float:
    """
    Scale transaction count to 0-1 range
    """
    if tx_count <= 0:
        return 0.0
    # Log scale: 10 txs = 0.3, 100 txs = 0.6, 1000+ txs = 1.0
    import math
    scaled = math.log(tx_count + 1) / math.log(1000 + 1)
    return min(1.0, scaled)


def scale_repay_ratio(ratio: float) -> float:
    """
    Scale repay-to-borrow ratio to 0-1 range
    Ratio >= 1.0 is perfect (all loans repaid)
    """
    return min(1.0, ratio)


def scale_protocol_count(count: int) -> float:
    """
    Scale protocol interaction count to 0-1 range
    """
    if count <= 0:
        return 0.0
    # Linear scale: 0-100 interactions
    return min(1.0, count / 100.0)

