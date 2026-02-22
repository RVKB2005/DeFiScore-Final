"""
Protocol Event Decoder
Decodes DeFi protocol events from transaction logs
"""
from web3 import Web3
from typing import List, Dict, Any, Optional
from data_ingestion_models import ProtocolEvent, ProtocolEventType
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)


class ProtocolDecoder:
    """
    Decodes events from major DeFi protocols
    Currently supports: Aave V2, Aave V3, Compound
    """
    
    # Aave V2/V3 Event Signatures
    AAVE_DEPOSIT_SIGNATURE = Web3.keccak(text="Deposit(address,address,uint256,uint16)").hex()
    AAVE_WITHDRAW_SIGNATURE = Web3.keccak(text="Withdraw(address,address,address,uint256)").hex()
    AAVE_BORROW_SIGNATURE = Web3.keccak(text="Borrow(address,address,address,uint256,uint256,uint256,uint16)").hex()
    AAVE_REPAY_SIGNATURE = Web3.keccak(text="Repay(address,address,address,uint256)").hex()
    AAVE_LIQUIDATION_SIGNATURE = Web3.keccak(text="LiquidationCall(address,address,address,uint256,uint256,address,bool)").hex()
    
    # Compound Event Signatures
    COMPOUND_MINT_SIGNATURE = Web3.keccak(text="Mint(address,uint256,uint256)").hex()
    COMPOUND_REDEEM_SIGNATURE = Web3.keccak(text="Redeem(address,uint256,uint256)").hex()
    COMPOUND_BORROW_SIGNATURE = Web3.keccak(text="Borrow(address,uint256,uint256,uint256)").hex()
    COMPOUND_REPAY_SIGNATURE = Web3.keccak(text="RepayBorrow(address,address,uint256,uint256,uint256)").hex()
    
    # Known protocol contracts (Ethereum Mainnet) - COMPREHENSIVE LIST
    KNOWN_PROTOCOLS = {
        # ===== LENDING PROTOCOLS =====
        # Aave
        "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2": "Aave V3",
        "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9": "Aave V2",
        "0x398eC7346DcD622eDc5ae82352F02bE94C62d119": "Aave V1",
        # Compound
        "0xc3d688B66703497DAA19211EEdff47f25384cdc3": "Compound V3",
        "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B": "Compound V2",
        "0xc00e94Cb662C3520282E6f5717214004A7f26888": "Compound",
        # MakerDAO
        "0x9759A6Ac90977b93B58547b4A71c78317f391A28": "MakerDAO",
        "0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B": "MakerDAO Vat",
        # Morpho
        "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb": "Morpho Blue",
        "0x777777c9898D384F785Ee44Acfe945efDFf5f3E0": "Morpho Aave V3",
        # Spark
        "0xC13e21B648A5Ee794902342038FF3aDAB66BE987": "Spark",
        # Euler
        "0x27182842E098f60e3D576794A5bFFb0777E025d3": "Euler",
        # Radiant
        "0xd50Cf00b6e600Dd036Ba8eF475677d816d6c4281": "Radiant",
        
        # ===== DEX PROTOCOLS =====
        # Uniswap
        "0x1F98431c8aD98523631AE4a59f267346ea31F984": "Uniswap V3",
        "0xE592427A0AEce92De3Edee1F18E0157C05861564": "Uniswap V3 Router",
        "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f": "Uniswap V2",
        "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D": "Uniswap V2 Router",
        # SushiSwap
        "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac": "SushiSwap",
        "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F": "SushiSwap Router",
        # Curve
        "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7": "Curve 3pool",
        "0xDC24316b9AE028F1497c275EB9192a3Ea0f67022": "Curve stETH",
        "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46": "Curve Tricrypto",
        # Balancer
        "0xBA12222222228d8Ba445958a75a0704d566BF2C8": "Balancer V2",
        # 1inch
        "0x1111111254EEB25477B68fb85Ed929f73A960582": "1inch V5",
        "0x1111111254fb6c44bAC0beD2854e76F90643097d": "1inch V4",
        # 0x
        "0xDef1C0ded9bec7F1a1670819833240f027b25EfF": "0x",
        # Bancor
        "0x2F9EC37d6CcFFf1caB21733BdaDEdE11c823cCB0": "Bancor V3",
        # Kyber
        "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5": "Kyber",
        # PancakeSwap
        "0x1097053Fd2ea711dad45caCcc45EfF7548fCB362": "PancakeSwap V3",
        
        # ===== LIQUID STAKING =====
        # Lido
        "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84": "Lido stETH",
        "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0": "Lido wstETH",
        # Rocket Pool
        "0xae78736Cd615f374D3085123A210448E74Fc6393": "Rocket Pool rETH",
        # Frax
        "0xac3E018457B222d93114458476f3E3416Abbe38F": "Frax sfrxETH",
        # Coinbase
        "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704": "Coinbase cbETH",
        # StakeWise
        "0xFe2e637202056d30016725477c5da089Ab0A043A": "StakeWise",
        
        # ===== YIELD AGGREGATORS =====
        # Yearn
        "0x9D25057e62939D3408406975aD75Ffe834DA4cDd": "Yearn V3",
        "0x50c1a2eA0a861A967D9d0FFE2AE4012c2E053804": "Yearn V2",
        # Convex
        "0xF403C135812408BFbE8713b5A23a04b3D48AAE31": "Convex",
        "0x989AEb4d175e16225E39E87d0D97A3360524AD80": "Convex Booster",
        # Harvest
        "0xa0246c9032bC3A600820415aE600c6388619A14D": "Harvest",
        
        # ===== DERIVATIVES =====
        # GMX
        "0x489ee077994B6658eAfA855C308275EAd8097C4A": "GMX",
        # dYdX
        "0xD54f502e184B6B739d7D27a6410a67dc462D69c8": "dYdX",
        # Synthetix
        "0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F": "Synthetix SNX",
        "0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4": "Synthetix",
        # Perpetual
        "0x82ac2CE43e33683c58BE4cDc40975E73aA50f459": "Perpetual",
        
        # ===== OPTIONS =====
        # Ribbon
        "0x0FABaF48Bbf864a3947bdd0Ba9d764791a60467A": "Ribbon",
        # Opyn
        "0x64187ae08781B09368e6253F9E94951243A493D5": "Opyn Squeeth",
        # Hegic
        "0x878F15ffC8b894A1BA7647c7176E4C01f74e140b": "Hegic",
        
        # ===== BRIDGES =====
        # Across
        "0x4D9079Bb4165aeb4084c526a32695dCfd2F77381": "Across",
        # Hop
        "0x3666f603Cc164936C1b87e207F36BEBa4AC5f18a": "Hop",
        # Stargate
        "0x8731d54E9D02c286767d56ac03e8037C07e01e98": "Stargate",
        # Synapse
        "0x2796317b0fF8538F253012862c06787Adfb8cEb6": "Synapse",
        
        # ===== STABLECOINS =====
        # Frax
        "0x853d955aCEf822Db058eb8505911ED77F175b99e": "Frax",
        # Liquity
        "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0": "Liquity LUSD",
        "0x66017D22b0f8556afDd19FC67041899Eb65a21bb": "Liquity Stability Pool",
        # Reflexer
        "0x03ab458634910AaD20eF5f1C8ee96F1D6ac54919": "Reflexer RAI",
        
        # ===== NFT PROTOCOLS =====
        # Blur
        "0x000000000000Ad05Ccc4F10045630fb830B95127": "Blur",
        # OpenSea
        "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC": "OpenSea Seaport",
        # LooksRare
        "0x59728544B08AB483533076417FbBB2fD0B17CE3a": "LooksRare",
        # X2Y2
        "0x74312363e45DCaBA76c59ec49a7Aa8A65a67EeD3": "X2Y2",
        # NFTfi
        "0xf896527c49b44aAb3Cf22aE356Fa3AF8E331F280": "NFTfi",
        # BendDAO
        "0x70b97A0da65C15dfb0FFA02aEE6FA36e507C2762": "BendDAO",
        
        # ===== RWA =====
        # Centrifuge
        "0x4B5922ABf25858d012d12bb1184e5d3d0B6D6BE4": "Centrifuge",
        # Maple
        "0x6F6c8013f639979C84b756C7FC1500eB5aF18Dc4": "Maple",
        # Goldfinch
        "0x8481a6EbAf5c7DABc3F7e09e44A89531fd31F822": "Goldfinch",
        
        # ===== INSURANCE =====
        # Nexus Mutual
        "0xcafeaBED7e0653aFe9674A3ad862b78DB3F36e60": "Nexus Mutual",
        
        # ===== GAMING =====
        # Axie Infinity
        "0x32950db2a7164aE833121501C797D79E7B79d74C": "Axie Infinity",
        # Decentraland
        "0xF87E31492Faf9A91B02Ee0dEAAd50d51d56D5d4d": "Decentraland",
        # The Sandbox
        "0x3845badAde8e6dFF049820680d1F14bD3903a5d0": "The Sandbox",
    }
    
    def __init__(self):
        self.event_signatures = {
            self.AAVE_DEPOSIT_SIGNATURE: ("Aave", ProtocolEventType.DEPOSIT),
            self.AAVE_WITHDRAW_SIGNATURE: ("Aave", ProtocolEventType.WITHDRAW),
            self.AAVE_BORROW_SIGNATURE: ("Aave", ProtocolEventType.BORROW),
            self.AAVE_REPAY_SIGNATURE: ("Aave", ProtocolEventType.REPAY),
            self.AAVE_LIQUIDATION_SIGNATURE: ("Aave", ProtocolEventType.LIQUIDATION),
            self.COMPOUND_MINT_SIGNATURE: ("Compound", ProtocolEventType.SUPPLY),
            self.COMPOUND_REDEEM_SIGNATURE: ("Compound", ProtocolEventType.WITHDRAW),
            self.COMPOUND_BORROW_SIGNATURE: ("Compound", ProtocolEventType.BORROW),
            self.COMPOUND_REPAY_SIGNATURE: ("Compound", ProtocolEventType.REPAY),
        }
    
    def is_known_protocol(self, address: str) -> bool:
        """Check if address is a known protocol contract"""
        return address.lower() in [k.lower() for k in self.KNOWN_PROTOCOLS.keys()]
    
    def get_protocol_name(self, address: str) -> str:
        """Get protocol name from contract address"""
        for known_addr, name in self.KNOWN_PROTOCOLS.items():
            if known_addr.lower() == address.lower():
                return name
        return "Unknown Protocol"
    
    def decode_log(
        self,
        log: Dict[str, Any],
        wallet_address: str,
        block_timestamp: datetime
    ) -> Optional[ProtocolEvent]:
        """
        Decode a log entry into a protocol event
        
        Args:
            log: Raw log entry from blockchain
            wallet_address: Wallet being analyzed
            block_timestamp: Block timestamp
            
        Returns:
            ProtocolEvent or None if not decodable
        """
        if not log.get('topics') or len(log['topics']) == 0:
            return None
        
        # Get event signature (first topic)
        event_signature = log['topics'][0].hex() if isinstance(log['topics'][0], bytes) else log['topics'][0]
        
        # Check if this is a known event
        if event_signature not in self.event_signatures:
            return None
        
        protocol_name, event_type = self.event_signatures[event_signature]
        
        # Extract amount from data field using proper ABI decoding
        amount_wei = None
        try:
            if log.get('data') and log['data'] != '0x':
                # Convert data to hex string if it's bytes
                data = log['data']
                if isinstance(data, bytes):
                    data_hex = data.hex()
                else:
                    data_hex = data[2:] if data.startswith('0x') else data
                
                # Decode based on event type
                # Most DeFi events have amount as first parameter in data field
                if len(data_hex) >= 64:
                    # First 32 bytes (64 hex chars) typically contain amount
                    amount_wei = int(data_hex[:64], 16)
                    
                    # Validate amount is reasonable (not overflow/underflow)
                    if amount_wei > 2**256 - 1:
                        logger.warning(f"Amount overflow detected, setting to None")
                        amount_wei = None
        except Exception as e:
            logger.error(f"Failed to decode amount from log: {e}", exc_info=True)
            amount_wei = None
        
        return ProtocolEvent(
            event_type=event_type,
            wallet_address=wallet_address.lower(),
            protocol_name=protocol_name,
            contract_address=log['address'].lower() if isinstance(log['address'], str) else log['address'],
            tx_hash=log['transactionHash'].hex() if isinstance(log['transactionHash'], bytes) else log['transactionHash'],
            block_number=log['blockNumber'],
            timestamp=block_timestamp,
            asset=self._extract_asset_from_log(log, event_signature),
            amount_wei=amount_wei,
            amount_eth=float(Web3.from_wei(amount_wei, 'ether')) if amount_wei else None,
            log_index=log['logIndex']
        )
    
    def decode_logs(
        self,
        logs: List[Dict[str, Any]],
        wallet_address: str,
        block_timestamps: Dict[int, datetime]
    ) -> List[ProtocolEvent]:
        """
        Decode multiple logs into protocol events
        
        Args:
            logs: List of raw log entries
            wallet_address: Wallet being analyzed
            block_timestamps: Map of block number to timestamp
            
        Returns:
            List of decoded protocol events
        """
        events = []
        
        for log in logs:
            block_number = log.get('blockNumber')
            if not block_number or block_number not in block_timestamps:
                continue
            
            event = self.decode_log(log, wallet_address, block_timestamps[block_number])
            if event:
                events.append(event)
        
        return events

    def _extract_asset_from_log(self, log: Dict[str, Any], event_signature: str) -> Optional[str]:
        """
        Extract asset/token from protocol event log
        
        Strategy:
        1. Check indexed topics for token address (Aave V3, Compound V3)
        2. Check data field for token address
        3. Lookup token symbol from known addresses
        4. Default to "ETH" for native ETH events
        
        Args:
            log: Raw log entry
            event_signature: Event signature hash
            
        Returns:
            Token symbol (e.g., "USDC", "DAI", "ETH") or None
        """
        try:
            # Aave V3 events: reserve (token) is in topic[1]
            # Deposit(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint16 indexed referral)
            # Borrow(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint256 borrowRateMode, uint256 borrowRate, uint16 indexed referral)
            if event_signature in [self.AAVE_DEPOSIT_SIGNATURE, self.AAVE_BORROW_SIGNATURE, 
                                   self.AAVE_REPAY_SIGNATURE, self.AAVE_WITHDRAW_SIGNATURE]:
                if len(log.get('topics', [])) > 1:
                    # Topic[1] is the reserve (token) address
                    token_address = log['topics'][1]
                    if isinstance(token_address, bytes):
                        token_address = '0x' + token_address.hex()[-40:]  # Last 20 bytes = address
                    else:
                        token_address = '0x' + token_address[-40:]
                    
                    # Lookup symbol
                    token_symbol = KNOWN_TOKENS.get(token_address.lower())
                    if token_symbol:
                        return token_symbol
                    
                    # Return address if unknown
                    return token_address[:10] + "..."
            
            # Compound events: cToken contract address is the log address
            # We'd need to map cToken -> underlying, but for now return contract
            if event_signature in [self.COMPOUND_MINT_SIGNATURE, self.COMPOUND_REDEEM_SIGNATURE,
                                   self.COMPOUND_BORROW_SIGNATURE, self.COMPOUND_REPAY_SIGNATURE]:
                contract_addr = log.get('address', '')
                if isinstance(contract_addr, bytes):
                    contract_addr = '0x' + contract_addr.hex()
                
                # Comprehensive cToken mappings for Compound V2
                ctoken_map = {
                    "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643": "DAI",  # cDAI
                    "0x39AA39c021dfbaE8faC545936693aC917d5E7563": "USDC", # cUSDC
                    "0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9": "USDT", # cUSDT
                    "0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5": "ETH",  # cETH
                    "0xC11b1268C1A384e55C48c2391d8d480264A3A7F4": "WBTC", # cWBTC
                    "0x6C8c6b02E7b2BE14d4fA6022Dfd6d75921D90E4E": "BAT",  # cBAT
                    "0x70e36f6BF80a52b3B46b3aF8e106CC0ed743E8e4": "COMP", # cCOMP
                    "0xFAce851a4921ce59e912d19329929CE6da6EB0c7": "LINK", # cLINK
                    "0x95b4eF2869eBD94BEb4eEE400a99824BF5DC325b": "MKR",  # cMKR
                    "0x158079Ee67Fce2f58472A96584A73C7Ab9AC95c1": "REP",  # cREP
                    "0x12392F67bdf24faE0AF363c24aC620a2f67DAd86": "TUSD", # cTUSD
                    "0x35A18000230DA775CAc24873d00Ff85BccdeD550": "UNI",  # cUNI
                    "0x041171993284df560249B57358F931D9eB7b925D": "USDT", # cUSDT
                    "0xB3319f5D18Bc0D84dD1b4825Dcde5d5f7266d407": "ZRX",  # cZRX
                    "0xccF4429DB6322D5C611ee964527D42E5d685DD6a": "WBTC2", # cWBTC2
                    "0x80a2AE356fc9ef4305676f7a3E2Ed04e12C33946": "YFI",  # cYFI
                    "0xFAce851a4921ce59e912d19329929CE6da6EB0c7": "LINK", # cLINK
                    "0xF5DCe57282A584D2746FaF1593d3121Fcac444dC": "SAI",  # cSAI (old DAI)
                }
                
                token = ctoken_map.get(contract_addr.lower())
                if token:
                    return token
                
                # Query the underlying token from the cToken contract
                try:
                    # cToken contracts have an underlying() method that returns the underlying asset address
                    # For cETH, this method doesn't exist (native ETH)
                    from web3 import Web3
                    
                    # ABI for underlying() method
                    underlying_abi = [{
                        "constant": True,
                        "inputs": [],
                        "name": "underlying",
                        "outputs": [{"name": "", "type": "address"}],
                        "type": "function"
                    }]
                    
                    # Try to call underlying() method
                    contract = self.w3.eth.contract(
                        address=Web3.to_checksum_address(contract_addr),
                        abi=underlying_abi
                    )
                    underlying_addr = contract.functions.underlying().call()
                    
                    # Lookup underlying token symbol
                    from protocol_decoder import KNOWN_TOKENS
                    underlying_symbol = KNOWN_TOKENS.get(underlying_addr.lower())
                    if underlying_symbol:
                        logger.info(f"Resolved cToken {contract_addr[:10]} -> {underlying_symbol}")
                        return underlying_symbol
                    
                    logger.warning(f"Unknown underlying token for cToken {contract_addr[:10]}: {underlying_addr}")
                    return f"cToken-{contract_addr[:10]}"
                    
                except Exception as e:
                    # If underlying() call fails, it might be cETH (native ETH)
                    if "execution reverted" in str(e).lower() or "underlying" in str(e).lower():
                        logger.debug(f"cToken {contract_addr[:10]} has no underlying() method, assuming cETH")
                        return "ETH"
                    
                    logger.warning(f"Failed to query underlying token for cToken {contract_addr[:10]}: {e}")
                    return f"cToken-{contract_addr[:10]}"
            
            # Default to ETH for unidentified events
            return "ETH"
            
        except Exception as e:
            logger.warning(f"Failed to extract asset from log: {e}")
            return None


# Known token addresses (Ethereum Mainnet) - Top DeFi tokens
KNOWN_TOKENS = {
    # Stablecoins
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
    "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT",
    "0x6b175474e89094c44da98b954eedeac495271d0f": "DAI",
    "0x4fabb145d64652a948d72533023f6e7a623c7c53": "BUSD",
    "0x8e870d67f660d95d5be530380d0ec0bd388289e1": "USDP",
    "0x056fd409e1d7a124bd7017459dfea2f387b6d5cd": "GUSD",
    "0x853d955acef822db058eb8505911ed77f175b99e": "FRAX",
    "0x5f98805a4e8be255a32880fdec7f6728c6568ba0": "LUSD",
    
    # Wrapped ETH
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "WETH",
    
    # Wrapped BTC
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "WBTC",
    "0xfe18be6b3bd88a2d2a7f928d00292e7a9963cfc6": "sBTC",
    "0xeb4c2781e4eba804ce9a9803c67d0893436bb27d": "renBTC",
    
    # Aave tokens
    "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9": "AAVE",
    
    # Compound
    "0xc00e94cb662c3520282e6f5717214004a7f26888": "COMP",
    
    # Maker
    "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2": "MKR",
    
    # Uniswap
    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": "UNI",
    
    # Curve
    "0xd533a949740bb3306d119cc777fa900ba034cd52": "CRV",
    
    # Synthetix
    "0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f": "SNX",
    "0x57ab1ec28d129707052df4df418d58a2d46d5f51": "sUSD",
    
    # Lido
    "0xae7ab96520de3a18e5e111b5eaab095312d7fe84": "stETH",
    "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0": "wstETH",
    
    # Rocket Pool
    "0xae78736cd615f374d3085123a210448e74fc6393": "rETH",
    
    # Frax Ether
    "0xac3e018457b222d93114458476f3e3416abbe38f": "sfrxETH",
    "0x5e8422345238f34275888049021821e8e08caa1f": "frxETH",
    
    # Coinbase Wrapped Staked ETH
    "0xbe9895146f7af43049ca1c1ae358b0541ea49704": "cbETH",
    
    # Balancer
    "0xba100000625a3754423978a60c9317c58a424e3d": "BAL",
    
    # Yearn
    "0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e": "YFI",
    
    # Link
    "0x514910771af9ca656af840dff83e8264ecf986ca": "LINK",
}
