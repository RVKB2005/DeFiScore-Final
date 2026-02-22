from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, Dict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"  # Ignore extra fields from .env
    )
    
    SECRET_KEY: str = "development-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    NONCE_EXPIRE_SECONDS: int = 300
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_ENABLED: bool = False  # Set to True if Redis is available
    ENVIRONMENT: str = "development"
    
    # Ethereum Networks
    ETHEREUM_MAINNET_RPC: str = "https://eth-mainnet.g.alchemy.com/v2/your-api-key"
    ETHEREUM_SEPOLIA_RPC: str = "https://eth-sepolia.g.alchemy.com/v2/your-api-key"
    ETHEREUM_HOODI_RPC: str = "https://eth-hoodi.g.alchemy.com/v2/your-api-key"
    
    # Archive Node RPC (Optional - for accurate historical balance snapshots)
    ETHEREUM_ARCHIVE_RPC: Optional[str] = None
    
    # Layer 2 - Arbitrum
    ARBITRUM_MAINNET_RPC: str = "https://arb-mainnet.g.alchemy.com/v2/your-api-key"
    ARBITRUM_SEPOLIA_RPC: str = "https://arb-sepolia.g.alchemy.com/v2/your-api-key"
    ARBITRUM_NOVA_RPC: str = "https://arbnova-mainnet.g.alchemy.com/v2/your-api-key"
    
    # Layer 2 - Optimism
    OPTIMISM_MAINNET_RPC: str = "https://opt-mainnet.g.alchemy.com/v2/your-api-key"
    OPTIMISM_SEPOLIA_RPC: str = "https://opt-sepolia.g.alchemy.com/v2/your-api-key"
    
    # Layer 2 - Base
    BASE_MAINNET_RPC: str = "https://base-mainnet.g.alchemy.com/v2/your-api-key"
    BASE_SEPOLIA_RPC: str = "https://base-sepolia.g.alchemy.com/v2/your-api-key"
    
    # Layer 2 - zkSync
    ZKSYNC_MAINNET_RPC: str = "https://zksync-mainnet.g.alchemy.com/v2/your-api-key"
    ZKSYNC_SEPOLIA_RPC: str = "https://zksync-sepolia.g.alchemy.com/v2/your-api-key"
    
    # Layer 2 - Scroll
    SCROLL_MAINNET_RPC: str = "https://rpc.scroll.io"
    SCROLL_SEPOLIA_RPC: str = "https://sepolia-rpc.scroll.io"
    
    # Layer 2 - Linea
    LINEA_MAINNET_RPC: str = "https://rpc.linea.build"
    LINEA_SEPOLIA_RPC: str = "https://rpc.sepolia.linea.build"
    
    # Layer 2 - Blast
    BLAST_MAINNET_RPC: str = "https://rpc.blast.io"
    BLAST_SEPOLIA_RPC: str = "https://sepolia.blast.io"
    
    # Layer 2 - Mantle
    MANTLE_MAINNET_RPC: str = "https://rpc.mantle.xyz"
    MANTLE_SEPOLIA_RPC: str = "https://rpc.sepolia.mantle.xyz"
    
    # Layer 2 - Metis
    METIS_MAINNET_RPC: str = "https://andromeda.metis.io/?owner=1088"
    METIS_SEPOLIA_RPC: str = "https://metis-sepolia-rpc.publicnode.com"
    
    # Layer 2 - Mode
    MODE_MAINNET_RPC: str = "https://mainnet.mode.network"
    MODE_SEPOLIA_RPC: str = "https://sepolia.mode.network"
    
    # Polygon Networks
    POLYGON_MAINNET_RPC: str = "https://polygon-mainnet.g.alchemy.com/v2/your-api-key"
    POLYGON_AMOY_RPC: str = "https://polygon-amoy.g.alchemy.com/v2/your-api-key"
    POLYGON_ZKEVM_RPC: str = "https://zkevm-rpc.com"
    
    # BNB Chain
    BNB_MAINNET_RPC: str = "https://bnb-mainnet.g.alchemy.com/v2/your-api-key"
    BNB_TESTNET_RPC: str = "https://bnb-testnet.g.alchemy.com/v2/your-api-key"
    OPBNB_MAINNET_RPC: str = "https://opbnb-mainnet.g.alchemy.com/v2/your-api-key"
    OPBNB_TESTNET_RPC: str = "https://opbnb-testnet.g.alchemy.com/v2/your-api-key"
    
    # Emerging L2s and Rollups
    ZORA_MAINNET_RPC: str = "https://zora-mainnet.g.alchemy.com/v2/your-api-key"
    ZORA_SEPOLIA_RPC: str = "https://zora-sepolia.g.alchemy.com/v2/your-api-key"
    WORLDCHAIN_MAINNET_RPC: str = "https://worldchain-mainnet.g.alchemy.com/v2/your-api-key"
    WORLDCHAIN_SEPOLIA_RPC: str = "https://worldchain-sepolia.g.alchemy.com/v2/your-api-key"
    UNICHAIN_MAINNET_RPC: str = "https://unichain-mainnet.g.alchemy.com/v2/your-api-key"
    UNICHAIN_SEPOLIA_RPC: str = "https://unichain-sepolia.g.alchemy.com/v2/your-api-key"
    SHAPE_MAINNET_RPC: str = "https://shape-mainnet.g.alchemy.com/v2/your-api-key"
    SHAPE_SEPOLIA_RPC: str = "https://shape-sepolia.g.alchemy.com/v2/your-api-key"
    INK_MAINNET_RPC: str = "https://ink-mainnet.g.alchemy.com/v2/your-api-key"
    INK_SEPOLIA_RPC: str = "https://ink-sepolia.g.alchemy.com/v2/your-api-key"
    SONEIUM_MAINNET_RPC: str = "https://soneium-mainnet.g.alchemy.com/v2/your-api-key"
    SONEIUM_MINATO_RPC: str = "https://soneium-minato.g.alchemy.com/v2/your-api-key"
    STORY_MAINNET_RPC: str = "https://story-mainnet.g.alchemy.com/v2/your-api-key"
    STORY_AENEID_RPC: str = "https://story-aeneid.g.alchemy.com/v2/your-api-key"
    
    # Gaming and Entertainment Chains
    ANIMECHAIN_MAINNET_RPC: str = "https://anime-mainnet.g.alchemy.com/v2/your-api-key"
    ANIMECHAIN_SEPOLIA_RPC: str = "https://anime-sepolia.g.alchemy.com/v2/your-api-key"
    DEGEN_MAINNET_RPC: str = "https://degen-mainnet.g.alchemy.com/v2/your-api-key"
    RONIN_MAINNET_RPC: str = "https://api.roninchain.com/rpc"
    RONIN_SAIGON_RPC: str = "https://saigon-testnet.roninchain.com/rpc"
    
    # DeFi-Focused Chains
    FRAX_MAINNET_RPC: str = "https://frax-mainnet.g.alchemy.com/v2/your-api-key"
    HYPERLIQUID_MAINNET_RPC: str = "https://hyperliquid-mainnet.g.alchemy.com/v2/your-api-key"
    HYPERLIQUID_TESTNET_RPC: str = "https://hyperliquid-testnet.g.alchemy.com/v2/your-api-key"
    
    # Other Major EVM Chains
    CELO_MAINNET_RPC: str = "https://celo-mainnet.g.alchemy.com/v2/your-api-key"
    CELO_SEPOLIA_RPC: str = "https://celo-sepolia.g.alchemy.com/v2/your-api-key"
    BERACHAIN_MAINNET_RPC: str = "https://berachain-rpc.publicnode.com"
    BOBA_MAINNET_RPC: str = "https://boba-mainnet.g.alchemy.com/v2/your-api-key"
    BOBA_SEPOLIA_RPC: str = "https://boba-sepolia.g.alchemy.com/v2/your-api-key"
    MONAD_MAINNET_RPC: str = "https://monad-mainnet.g.alchemy.com/v2/your-api-key"
    MONAD_TESTNET_RPC: str = "https://monad-testnet.g.alchemy.com/v2/your-api-key"
    GNOSIS_MAINNET_RPC: str = "https://rpc.gnosischain.com"
    GNOSIS_CHIADO_RPC: str = "https://rpc.chiadochain.net"
    MOONBEAM_MAINNET_RPC: str = "https://rpc.api.moonbeam.network"
    MOONRIVER_MAINNET_RPC: str = "https://rpc.api.moonriver.moonbeam.network"
    ASTAR_MAINNET_RPC: str = "https://evm.astar.network"
    CRONOS_MAINNET_RPC: str = "https://evm.cronos.org"
    KAVA_MAINNET_RPC: str = "https://evm.kava.io"
    FUSE_MAINNET_RPC: str = "https://rpc.fuse.io"
    HARMONY_MAINNET_RPC: str = "https://api.harmony.one"
    AURORA_MAINNET_RPC: str = "https://mainnet.aurora.dev"
    
    # Public RPCs
    AVALANCHE_MAINNET_RPC: str = "https://api.avax.network/ext/bc/C/rpc"
    AVALANCHE_FUJI_RPC: str = "https://api.avax-test.network/ext/bc/C/rpc"
    FANTOM_MAINNET_RPC: str = "https://rpc.fantom.network"
    FANTOM_TESTNET_RPC: str = "https://rpc.testnet.fantom.network"
    
    # Database Configuration
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/defiscore"
    
    # Etherscan API Configuration
    ETHERSCAN_API_KEY: Optional[str] = None
    
    # The Graph Protocol API Configuration
    GRAPH_API_KEY: Optional[str] = None
    
    # CoinGecko API Configuration (Price Oracle)
    COINGECKO_API_KEY: Optional[str] = None
    
    # Application Configuration
    BASE_URL: str = "http://localhost:8000"
    
    def get_all_networks(self) -> Dict[str, str]:
        """Get all configured network RPC URLs"""
        return {
            # Ethereum
            "ethereum": self.ETHEREUM_MAINNET_RPC,
            "ethereum_sepolia": self.ETHEREUM_SEPOLIA_RPC,
            "ethereum_hoodi": self.ETHEREUM_HOODI_RPC,
            # Arbitrum
            "arbitrum": self.ARBITRUM_MAINNET_RPC,
            "arbitrum_sepolia": self.ARBITRUM_SEPOLIA_RPC,
            "arbitrum_nova": self.ARBITRUM_NOVA_RPC,
            # Optimism
            "optimism": self.OPTIMISM_MAINNET_RPC,
            "optimism_sepolia": self.OPTIMISM_SEPOLIA_RPC,
            # Base
            "base": self.BASE_MAINNET_RPC,
            "base_sepolia": self.BASE_SEPOLIA_RPC,
            # zkSync
            "zksync": self.ZKSYNC_MAINNET_RPC,
            "zksync_sepolia": self.ZKSYNC_SEPOLIA_RPC,
            # Scroll
            "scroll": self.SCROLL_MAINNET_RPC,
            "scroll_sepolia": self.SCROLL_SEPOLIA_RPC,
            # Linea
            "linea": self.LINEA_MAINNET_RPC,
            "linea_sepolia": self.LINEA_SEPOLIA_RPC,
            # Blast
            "blast": self.BLAST_MAINNET_RPC,
            "blast_sepolia": self.BLAST_SEPOLIA_RPC,
            # Mantle
            "mantle": self.MANTLE_MAINNET_RPC,
            "mantle_sepolia": self.MANTLE_SEPOLIA_RPC,
            # Metis
            "metis": self.METIS_MAINNET_RPC,
            "metis_sepolia": self.METIS_SEPOLIA_RPC,
            # Mode
            "mode": self.MODE_MAINNET_RPC,
            "mode_sepolia": self.MODE_SEPOLIA_RPC,
            # Polygon
            "polygon": self.POLYGON_MAINNET_RPC,
            "polygon_amoy": self.POLYGON_AMOY_RPC,
            "polygon_zkevm": self.POLYGON_ZKEVM_RPC,
            # BNB
            "bnb": self.BNB_MAINNET_RPC,
            "bnb_testnet": self.BNB_TESTNET_RPC,
            "opbnb": self.OPBNB_MAINNET_RPC,
            "opbnb_testnet": self.OPBNB_TESTNET_RPC,
            # Emerging L2s
            "zora": self.ZORA_MAINNET_RPC,
            "zora_sepolia": self.ZORA_SEPOLIA_RPC,
            "worldchain": self.WORLDCHAIN_MAINNET_RPC,
            "worldchain_sepolia": self.WORLDCHAIN_SEPOLIA_RPC,
            "unichain": self.UNICHAIN_MAINNET_RPC,
            "unichain_sepolia": self.UNICHAIN_SEPOLIA_RPC,
            "shape": self.SHAPE_MAINNET_RPC,
            "shape_sepolia": self.SHAPE_SEPOLIA_RPC,
            "ink": self.INK_MAINNET_RPC,
            "ink_sepolia": self.INK_SEPOLIA_RPC,
            "soneium": self.SONEIUM_MAINNET_RPC,
            "soneium_minato": self.SONEIUM_MINATO_RPC,
            "story": self.STORY_MAINNET_RPC,
            "story_aeneid": self.STORY_AENEID_RPC,
            # Gaming
            "animechain": self.ANIMECHAIN_MAINNET_RPC,
            "animechain_sepolia": self.ANIMECHAIN_SEPOLIA_RPC,
            "degen": self.DEGEN_MAINNET_RPC,
            "ronin": self.RONIN_MAINNET_RPC,
            "ronin_saigon": self.RONIN_SAIGON_RPC,
            # DeFi
            "frax": self.FRAX_MAINNET_RPC,
            "hyperliquid": self.HYPERLIQUID_MAINNET_RPC,
            "hyperliquid_testnet": self.HYPERLIQUID_TESTNET_RPC,
            # Other
            "celo": self.CELO_MAINNET_RPC,
            "celo_sepolia": self.CELO_SEPOLIA_RPC,
            "berachain": self.BERACHAIN_MAINNET_RPC,
            "boba": self.BOBA_MAINNET_RPC,
            "boba_sepolia": self.BOBA_SEPOLIA_RPC,
            "monad": self.MONAD_MAINNET_RPC,
            "monad_testnet": self.MONAD_TESTNET_RPC,
            "gnosis": self.GNOSIS_MAINNET_RPC,
            "gnosis_chiado": self.GNOSIS_CHIADO_RPC,
            "moonbeam": self.MOONBEAM_MAINNET_RPC,
            "moonriver": self.MOONRIVER_MAINNET_RPC,
            "astar": self.ASTAR_MAINNET_RPC,
            "cronos": self.CRONOS_MAINNET_RPC,
            "kava": self.KAVA_MAINNET_RPC,
            "fuse": self.FUSE_MAINNET_RPC,
            "harmony": self.HARMONY_MAINNET_RPC,
            "aurora": self.AURORA_MAINNET_RPC,
            "avalanche": self.AVALANCHE_MAINNET_RPC,
            "avalanche_fuji": self.AVALANCHE_FUJI_RPC,
            "fantom": self.FANTOM_MAINNET_RPC,
            "fantom_testnet": self.FANTOM_TESTNET_RPC,
        }
    
    def get_mainnet_networks(self) -> Dict[str, str]:
        """Get only mainnet RPC URLs"""
        all_nets = self.get_all_networks()
        # Filter out testnets
        return {k: v for k, v in all_nets.items() if not any(x in k for x in ['sepolia', 'testnet', 'hoodi', 'amoy', 'fuji', 'chiado', 'saigon', 'bartio', 'minato', 'aeneid'])}


settings = Settings()
