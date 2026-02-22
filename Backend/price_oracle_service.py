"""
Price Oracle Service
Fetches cryptocurrency prices for USD conversion
"""
import requests
import logging
from typing import Dict, Optional
from datetime import datetime, timedelta
import time
import os

logger = logging.getLogger(__name__)


class PriceOracleService:
    """
    Service for fetching cryptocurrency prices
    
    Supports:
    - CoinGecko API (free tier: 10-50 calls/minute, with key: 500 calls/minute)
    - Caching to minimize API calls
    - Fallback prices for common tokens
    """
    
    # CoinGecko API endpoints
    COINGECKO_API = "https://api.coingecko.com/api/v3"
    COINGECKO_PRO_API = "https://pro-api.coingecko.com/api/v3"
    
    # Token ID mappings (CoinGecko IDs)
    TOKEN_IDS = {
        "ETH": "ethereum",
        "WETH": "ethereum",
        "BTC": "bitcoin",
        "WBTC": "wrapped-bitcoin",
        "USDC": "usd-coin",
        "USDT": "tether",
        "DAI": "dai",
        "BUSD": "binance-usd",
        "FRAX": "frax",
        "LUSD": "liquity-usd",
        "AAVE": "aave",
        "COMP": "compound-governance-token",
        "MKR": "maker",
        "UNI": "uniswap",
        "CRV": "curve-dao-token",
        "SNX": "synthetix-network-token",
        "stETH": "staked-ether",
        "wstETH": "wrapped-steth",
        "rETH": "rocket-pool-eth",
        "cbETH": "coinbase-wrapped-staked-eth",
        "sfrxETH": "staked-frax-ether",
        "BAL": "balancer",
        "YFI": "yearn-finance",
        "LINK": "chainlink",
        "MATIC": "matic-network",
        "BNB": "binancecoin",
        "AVAX": "avalanche-2",
        "FTM": "fantom",
    }
    
    # Fallback prices (approximate, for when API fails)
    FALLBACK_PRICES = {
        "ETH": 2500.0,
        "WETH": 2500.0,
        "BTC": 45000.0,
        "WBTC": 45000.0,
        "USDC": 1.0,
        "USDT": 1.0,
        "DAI": 1.0,
        "BUSD": 1.0,
        "FRAX": 1.0,
        "LUSD": 1.0,
    }
    
    def __init__(self, cache_ttl_minutes: int = 5, api_key: Optional[str] = None):
        """
        Initialize price oracle service
        
        Args:
            cache_ttl_minutes: Cache TTL in minutes (default: 5)
            api_key: CoinGecko API key (optional, increases rate limits)
        """
        self.cache_ttl = timedelta(minutes=cache_ttl_minutes)
        self.price_cache: Dict[str, tuple] = {}  # {symbol: (price, timestamp)}
        self.last_api_call = 0
        
        # Get API key from environment or parameter
        self.api_key = api_key or os.getenv('COINGECKO_API_KEY')
        
        # Set API endpoint and rate limits based on key availability
        if self.api_key:
            self.api_base = self.COINGECKO_PRO_API
            self.min_api_interval = 2.0  # 30 calls/minute = 0.5 calls/sec (2 sec interval)
            logger.info("CoinGecko API initialized with API key (30 calls/min, 10k/month)")
        else:
            self.api_base = self.COINGECKO_API
            self.min_api_interval = 6.0  # 10 calls/minute = 0.167 calls/sec (6 sec interval)
            logger.info("CoinGecko Free API initialized (10 calls/min)")
    
    def get_price(self, symbol: str) -> Optional[float]:
        """
        Get current USD price for a token
        
        Args:
            symbol: Token symbol (e.g., "ETH", "USDC")
            
        Returns:
            Price in USD or None if unavailable
        """
        symbol = symbol.upper()
        
        # Check cache first
        if symbol in self.price_cache:
            price, timestamp = self.price_cache[symbol]
            if datetime.now() - timestamp < self.cache_ttl:
                return price
        
        # Stablecoins always $1
        if symbol in ["USDC", "USDT", "DAI", "BUSD", "FRAX", "LUSD", "USDP", "GUSD"]:
            self.price_cache[symbol] = (1.0, datetime.now())
            return 1.0
        
        # Get token ID
        token_id = self.TOKEN_IDS.get(symbol)
        if not token_id:
            logger.warning(f"Unknown token symbol: {symbol}")
            return self.FALLBACK_PRICES.get(symbol)
        
        # Rate limiting
        time_since_last_call = time.time() - self.last_api_call
        if time_since_last_call < self.min_api_interval:
            time.sleep(self.min_api_interval - time_since_last_call)
        
        # Fetch from CoinGecko
        try:
            url = f"{self.api_base}/simple/price"
            params = {
                "ids": token_id,
                "vs_currencies": "usd"
            }
            
            headers = {}
            if self.api_key:
                headers["x-cg-pro-api-key"] = self.api_key
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            self.last_api_call = time.time()
            
            if response.status_code == 200:
                data = response.json()
                if token_id in data and "usd" in data[token_id]:
                    price = float(data[token_id]["usd"])
                    self.price_cache[symbol] = (price, datetime.now())
                    logger.debug(f"Fetched price for {symbol}: ${price:.2f}")
                    return price
            
            # API call failed
            logger.error(f"CoinGecko API failed for {symbol}: {response.status_code}")
            fallback = self.FALLBACK_PRICES.get(symbol)
            if fallback:
                logger.warning(f"FALLBACK: Using approximate price for {symbol}: ${fallback:.2f} (API unavailable)")
                logger.warning(f"This may affect credit score accuracy. Consider using CoinGecko Pro API.")
                return fallback
            
            logger.error(f"No price available for {symbol} - API failed and no fallback configured")
            raise ValueError(f"Unable to fetch price for {symbol}: API unavailable and no fallback price")
            
        except Exception as e:
            logger.error(f"Failed to fetch price for {symbol}: {e}")
            fallback = self.FALLBACK_PRICES.get(symbol)
            if fallback:
                logger.warning(f"FALLBACK: Using approximate price for {symbol}: ${fallback:.2f} (Exception: {e})")
                logger.warning(f"This may affect credit score accuracy. Consider using CoinGecko Pro API.")
                return fallback
            
            logger.error(f"No price available for {symbol} - Exception occurred and no fallback configured")
            raise ValueError(f"Unable to fetch price for {symbol}: {e}")
    
    def get_prices_batch(self, symbols: list) -> Dict[str, float]:
        """
        Get prices for multiple tokens in a single API call
        
        Args:
            symbols: List of token symbols
            
        Returns:
            Dictionary of {symbol: price}
        """
        symbols = [s.upper() for s in symbols]
        prices = {}
        
        # Separate stablecoins and other tokens
        stablecoins = [s for s in symbols if s in ["USDC", "USDT", "DAI", "BUSD", "FRAX", "LUSD", "USDP", "GUSD"]]
        other_tokens = [s for s in symbols if s not in stablecoins]
        
        # Stablecoins are always $1
        for symbol in stablecoins:
            prices[symbol] = 1.0
            self.price_cache[symbol] = (1.0, datetime.now())
        
        if not other_tokens:
            return prices
        
        # Check cache for other tokens
        uncached_tokens = []
        for symbol in other_tokens:
            if symbol in self.price_cache:
                price, timestamp = self.price_cache[symbol]
                if datetime.now() - timestamp < self.cache_ttl:
                    prices[symbol] = price
                else:
                    uncached_tokens.append(symbol)
            else:
                uncached_tokens.append(symbol)
        
        if not uncached_tokens:
            return prices
        
        # Get token IDs for uncached tokens
        token_ids = []
        symbol_to_id = {}
        for symbol in uncached_tokens:
            token_id = self.TOKEN_IDS.get(symbol)
            if token_id:
                token_ids.append(token_id)
                symbol_to_id[token_id] = symbol
        
        if not token_ids:
            # Use fallback prices
            for symbol in uncached_tokens:
                fallback = self.FALLBACK_PRICES.get(symbol)
                if fallback:
                    prices[symbol] = fallback
            return prices
        
        # Rate limiting
        time_since_last_call = time.time() - self.last_api_call
        if time_since_last_call < self.min_api_interval:
            time.sleep(self.min_api_interval - time_since_last_call)
        
        # Fetch from CoinGecko (batch)
        try:
            url = f"{self.api_base}/simple/price"
            params = {
                "ids": ",".join(token_ids),
                "vs_currencies": "usd"
            }
            
            headers = {}
            if self.api_key:
                headers["x-cg-pro-api-key"] = self.api_key
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            self.last_api_call = time.time()
            
            if response.status_code == 200:
                data = response.json()
                for token_id, symbol in symbol_to_id.items():
                    if token_id in data and "usd" in data[token_id]:
                        price = float(data[token_id]["usd"])
                        prices[symbol] = price
                        self.price_cache[symbol] = (price, datetime.now())
                        logger.debug(f"Fetched price for {symbol}: ${price:.2f}")
            else:
                logger.warning(f"CoinGecko API batch failed: {response.status_code}")
                # Use fallback prices
                for symbol in uncached_tokens:
                    if symbol not in prices:
                        fallback = self.FALLBACK_PRICES.get(symbol)
                        if fallback:
                            prices[symbol] = fallback
                            logger.info(f"Using fallback price for {symbol}: ${fallback:.2f}")
            
        except Exception as e:
            logger.error(f"Failed to fetch batch prices: {e}")
            # Use fallback prices
            for symbol in uncached_tokens:
                if symbol not in prices:
                    fallback = self.FALLBACK_PRICES.get(symbol)
                    if fallback:
                        prices[symbol] = fallback
                        logger.info(f"Using fallback price for {symbol}: ${fallback:.2f}")
        
        return prices
    
    def convert_to_usd(self, amount: float, symbol: str) -> Optional[float]:
        """
        Convert token amount to USD
        
        Args:
            amount: Token amount
            symbol: Token symbol
            
        Returns:
            USD value or None
        """
        price = self.get_price(symbol)
        if price is None:
            return None
        return amount * price


# Global instance
price_oracle = PriceOracleService(cache_ttl_minutes=5)
