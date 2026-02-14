# DeFiScore Credit Scoring Platform - Backend

Production-ready DeFi credit scoring platform with trustless wallet authentication, multi-chain blockchain data ingestion, and behavioral feature extraction for on-chain credit analysis.

## Quick Start

```bash
# 1. Setup (installs dependencies and creates .env)
python setup.py

# 2. Initialize database
python init_db.py

# 3. Start server
python main.py
```

Server runs on `http://localhost:8000` | API Docs: `http://localhost:8000/docs`

## Features

### Module 1: Wallet Authentication ✅
- Trustless wallet authentication using cryptographic signatures
- Support for MetaMask, Coinbase Wallet, WalletConnect, and generic wallets
- Nonce-based replay attack prevention
- JWT session management
- QR code generation for mobile wallet connections
- Redis-based nonce storage with in-memory fallback

### Module 2 Part 1: Multi-Chain Data Ingestion ✅
- **74 blockchain networks** - Ingest from ALL major EVM chains simultaneously
- Deterministic on-chain data collection for credit scoring
- Wallet metadata extraction (balance, transaction count, age)
- DeFi protocol event decoding (Aave, Compound)
- Balance snapshot creation
- **Parallel ingestion** across multiple networks
- PostgreSQL storage for structured data

### Module 2 Part 2: Feature Extraction & Classification ✅
- **5 feature groups** extracted from raw blockchain data:
  - Activity features (15+ metrics): transaction patterns, frequency, gaps
  - Financial features (7+ metrics): balance, volatility, value transferred
  - Protocol interaction features (8+ metrics): DeFi behavior, borrow/repay
  - Risk features (5+ indicators): failures, liquidations, anomalies
  - Temporal features (4+ metrics): regularity, burst patterns
- **5-dimensional behavioral classification**:
  - Longevity: new/established/veteran
  - Activity: dormant/occasional/active/hyperactive
  - Capital: micro/small/medium/large/whale
  - Credit Behavior: no_history/responsible/risky/defaulter
  - Risk: low/medium/high/critical
- Multi-chain feature aggregation
- Deterministic, rule-based feature engineering
- Feature normalization (ratios, log-scaling, time-normalized)

## System Status

✅ **Module 1**: Wallet Authentication - Production Ready  
✅ **Module 2 Part 1**: Data Ingestion - 74 networks operational (100%)  
✅ **Module 2 Part 2**: Feature Extraction - Fully implemented  
⏳ **Module 2 Part 3**: Credit Score Calculation - Next phase

### Known Operational Limitations

These are expected behaviors with the current free-tier setup:

1. **Rate Limiting (429 errors)**: Alchemy free tier has request limits
   - Solution: Upgrade to Growth/Scale tier for production
   - Current: Gracefully handled, doesn't break functionality

2. **Block Range Errors**: Some RPC providers limit block range queries
   - Solution: Already implemented with 2000-block chunking
   - Current: Automatically retries with smaller chunks

3. **POA Chain Warnings**: Polygon and BNB use Proof-of-Authority
   - Solution: POA middleware automatically injected
   - Current: Warnings suppressed, functionality works

4. **Transaction History**: Requires external indexer integration
   - Solution: Integrate Etherscan API or The Graph
   - Current: Infrastructure ready, API integration pending

All core functionality is operational despite these limitations.

## Architecture

### Authentication Flow

1. **Wallet Connection**: User connects wallet (browser extension or mobile)
2. **Nonce Generation**: Backend generates cryptographically secure nonce
3. **Message Signing**: User signs authentication message with wallet
4. **Signature Verification**: Backend verifies signature and wallet ownership
5. **Session Creation**: Backend issues JWT token for authenticated session

## Architecture

### Authentication Flow

```
┌─────────┐         ┌─────────┐         ┌─────────┐
│ Wallet  │         │ Frontend│         │ Backend │
└────┬────┘         └────┬────┘         └────┬────┘
     │                   │                   │
     │  1. Connect       │                   │
     │◄──────────────────┤                   │
     │                   │                   │
     │  2. Request Nonce │                   │
     │                   ├──────────────────►│
     │                   │                   │
     │                   │  3. Generate      │
     │                   │     Nonce         │
     │                   │◄──────────────────┤
     │                   │                   │
     │  4. Sign Message  │                   │
     │◄──────────────────┤                   │
     │                   │                   │
     │  5. Signature     │                   │
     ├──────────────────►│                   │
     │                   │                   │
     │                   │  6. Verify        │
     │                   ├──────────────────►│
     │                   │                   │
     │                   │  7. JWT Token     │
     │                   │◄──────────────────┤
     │                   │                   │
```

### Component Architecture

```
Backend/
├── main.py                        # FastAPI application entry
├── config.py                      # Configuration management
│
├── Module 1: Authentication
│   ├── routes.py                  # Auth API endpoints
│   ├── auth_service.py            # Core authentication logic
│   ├── crypto_utils.py            # Signature verification
│   ├── jwt_handler.py             # JWT token management
│   ├── nonce_store.py             # Nonce storage (Redis/Memory)
│   ├── wallet_utils.py            # Wallet-specific utilities
│   └── models.py                  # Auth Pydantic models
│
├── Module 2: Data Ingestion
│   ├── data_ingestion_routes.py  # Ingestion API endpoints
│   ├── data_ingestion_service.py # Core ingestion logic
│   ├── blockchain_client.py      # Ethereum RPC client
│   ├── protocol_decoder.py       # DeFi event decoder
│   ├── wallet_connection_service.py # Wallet connection handling
│   ├── data_ingestion_models.py  # Ingestion Pydantic models
│   ├── database.py                # PostgreSQL models & ORM
│   └── init_db.py                 # Database initialization
│
├── Shared Infrastructure
│   ├── middleware.py              # Security & logging
│   ├── exceptions.py              # Error handling
│   └── dependencies.py            # FastAPI dependencies
│
└── Testing & Setup
    ├── test_auth.py               # Authentication tests
    ├── test_ingestion.py          # Data ingestion tests
    └── setup.py                   # Automated setup script
```

### Security Properties

| Threat | Mitigation |
|--------|-----------|
| Replay attacks | Single-use nonces with expiration |
| Address spoofing | Cryptographic signature verification |
| Session hijacking | Short-lived JWT tokens |
| Phishing | Domain-bound messages |
| Backend impersonation | Wallet-side signing |

## Installation

### Prerequisites

- Python 3.9+
- Redis (optional for auth, falls back to in-memory storage)
- PostgreSQL 12+ (required for data ingestion)
- Ethereum RPC endpoint (Alchemy, Infura, or local node)

### Automated Setup

```bash
python setup.py
```

This will:
- Install all dependencies
- Generate secure SECRET_KEY
- Create .env configuration
- Check Redis availability

After setup:
1. Configure your Ethereum RPC URL in `.env`
2. Configure PostgreSQL connection in `.env`
3. Initialize database: `python init_db.py`
4. Start server: `python main.py`

### Manual Setup

1. Install dependencies: `pip install -r requirements.txt`
2. Copy environment: `cp .env.example .env`
3. Edit .env with your configuration
4. Start server: `python main.py`

### Windows

```cmd
python setup.py
run.bat dev
```

### Linux/Mac

```bash
python setup.py
chmod +x run.sh
./run.sh dev
```

## API Endpoints

### Authentication Endpoints (Module 1)

#### POST /auth/nonce
Generate authentication nonce for wallet address.

**Request:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

**Response:**
```json
{
  "nonce": "8f3b9e1c4a7d9c21...",
  "message": "DeFiScore Authentication\n\nWallet: 0x742d35...\nNonce: 8f3b9e1c...\n...",
  "expires_at": "2026-02-14T12:35:00"
}
```

#### POST /auth/verify
Verify wallet signature and create session.

**Request:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "message": "DeFiScore Authentication\n...",
  "signature": "0xdeadbeef..."
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 1800,
  "wallet_address": "0x742d35cc6634c0532925a3b844bc9e7595f0beb"
}
```

#### GET /auth/me
Get current authenticated wallet (requires JWT token).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "wallet_address": "0x742d35cc6634c0532925a3b844bc9e7595f0beb",
  "authenticated": true
}
```

#### GET /auth/wallet-info/{wallet_type}
Get wallet connection information and QR codes.

**Parameters:**
- `wallet_type`: metamask | coinbase | walletconnect | other
- `connection_url` (query): URL for QR code generation

**Response:**
```json
{
  "wallet_type": "walletconnect",
  "qr_code": "data:image/png;base64,...",
  "deep_link": "wc:..."
}
```

---

### Data Ingestion Endpoints (Module 2)

#### POST /api/v1/ingestion/wallet/connect
Initiate wallet connection for data ingestion.

**Request:**
```json
{
  "wallet_type": "metamask",
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

**Response:**
```json
{
  "wallet_type": "metamask",
  "connection_method": "deep_link",
  "deep_link": "https://metamask.app.link/dapp/...",
  "qr_code_data": null,
  "session_id": null
}
```

#### POST /api/v1/ingestion/wallet/{wallet_address}/ingest
Ingest blockchain data for credit scoring (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `days_back`: Number of days to fetch (default: 90)
- `full_history`: Fetch complete history (default: false)

**Response:**
```json
{
  "wallet_address": "0x742d35cc6634c0532925a3b844bc9e7595f0beb",
  "ingestion_window": {
    "start_block": 18500000,
    "end_block": 19000000,
    "start_timestamp": "2024-11-14T00:00:00Z",
    "end_timestamp": "2026-02-14T00:00:00Z"
  },
  "total_transactions": 0,
  "total_protocol_events": 15,
  "balance_snapshots": 10,
  "ingestion_started_at": "2026-02-14T12:00:00Z",
  "ingestion_completed_at": "2026-02-14T12:01:30Z",
  "status": "completed",
  "errors": []
}
```

#### GET /api/v1/ingestion/wallet/{wallet_address}/metadata
Get current wallet metadata without full ingestion.

**Response:**
```json
{
  "wallet_address": "0x742d35cc6634c0532925a3b844bc9e7595f0beb",
  "first_seen_block": 18000000,
  "first_seen_timestamp": "2024-10-01T00:00:00Z",
  "current_balance_wei": 1500000000000000000,
  "current_balance_eth": 1.5,
  "transaction_count": 250,
  "ingestion_timestamp": "2026-02-14T12:00:00Z"
}
```

#### GET /api/v1/ingestion/wallet/{wallet_address}/protocol-events
Get DeFi protocol interaction events.

**Query Parameters:**
- `days_back`: Number of days to fetch (default: 30)

**Response:**
```json
{
  "wallet_address": "0x742d35cc6634c0532925a3b844bc9e7595f0beb",
  "window": {
    "start_block": 18800000,
    "end_block": 19000000
  },
  "total_events": 15,
  "events": [
    {
      "event_type": "deposit",
      "wallet_address": "0x742d35cc6634c0532925a3b844bc9e7595f0beb",
      "protocol_name": "Aave",
      "contract_address": "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      "tx_hash": "0xabc123...",
      "block_number": 18850000,
      "timestamp": "2024-12-01T10:30:00Z",
      "asset": null,
      "amount_wei": 1000000000000000000,
      "amount_eth": 1.0,
      "log_index": 45
    }
  ]
}
```

#### GET /api/v1/ingestion/health
Health check for data ingestion service.

**Response:**
```json
{
  "status": "healthy",
  "blockchain_connected": true,
  "latest_block": 19000000,
  "chain_id": 1
}
```

## Configuration

Edit `.env` file:

```env
# Authentication
SECRET_KEY=your-secret-key-change-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=30
NONCE_EXPIRE_SECONDS=300
REDIS_HOST=localhost
REDIS_PORT=6379
ENVIRONMENT=development

# Blockchain
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-api-key
ETHEREUM_TESTNET_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-api-key

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/defiscore

# Application
BASE_URL=http://localhost:8000
```

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| SECRET_KEY | JWT signing key (auto-generated) | - | Yes |
| ACCESS_TOKEN_EXPIRE_MINUTES | JWT token lifetime | 30 | No |
| NONCE_EXPIRE_SECONDS | Nonce validity period | 300 | No |
| REDIS_HOST | Redis server host | localhost | No |
| REDIS_PORT | Redis server port | 6379 | No |
| ENVIRONMENT | development or production | development | No |
| ETHEREUM_RPC_URL | Ethereum mainnet RPC endpoint | - | Yes (Module 2) |
| ETHEREUM_TESTNET_RPC_URL | Ethereum testnet RPC endpoint | - | No |
| DATABASE_URL | PostgreSQL connection string | - | Yes (Module 2) |
| BASE_URL | Application base URL | http://localhost:8000 | No |

### Getting RPC Endpoints

**Alchemy (Recommended):**
1. Sign up at https://www.alchemy.com/
2. Create a new app
3. Copy the HTTPS endpoint
4. Add to `.env` as `ETHEREUM_RPC_URL`

**Infura:**
1. Sign up at https://infura.io/
2. Create a new project
3. Copy the endpoint URL
4. Add to `.env` as `ETHEREUM_RPC_URL`

**Local Node:**
```env
ETHEREUM_RPC_URL=http://localhost:8545
```

## Supported Wallets

| Wallet | Type | Features |
|--------|------|----------|
| MetaMask | Browser Extension | Direct connection |
| Coinbase Wallet | Browser + Mobile | Deep links, QR codes |
| WalletConnect | Universal | QR codes for any wallet |
| Other Wallets | Generic | QR code generation |

### Wallet Integration

**MetaMask (Browser):**
```javascript
// Frontend example
const accounts = await window.ethereum.request({ 
  method: 'eth_requestAccounts' 
});
const address = accounts[0];
```

**WalletConnect (Mobile):**
```javascript
// Generate QR code via API
const response = await fetch('/auth/wallet-info/walletconnect?connection_url=' + wcUri);
const { qr_code } = await response.json();
// Display qr_code to user
```

**Coinbase Wallet (Mobile):**
```javascript
// Get deep link via API
const response = await fetch('/auth/wallet-info/coinbase?connection_url=' + appUrl);
const { deep_link } = await response.json();
// Redirect user to deep_link
```

## Security Best Practices

1. **Production Secret Key**: Generate strong SECRET_KEY for production
2. **HTTPS Only**: Always use HTTPS in production
3. **CORS Configuration**: Restrict allowed origins in production
4. **Token Expiration**: Keep JWT expiration short (30 minutes recommended)
5. **Nonce Expiration**: Keep nonce lifetime short (5 minutes recommended)
6. **Redis in Production**: Use Redis for distributed nonce storage

## Development

Run with auto-reload:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API documentation available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Testing

### Authentication Tests
```bash
python test_auth.py
```

Tests include:
- Wallet creation
- Nonce generation
- Message signing
- Signature verification
- JWT token validation
- Replay attack prevention

### Data Ingestion Tests
```bash
python test_ingestion.py
```

Tests include:
- Blockchain connection
- Wallet metadata fetching
- Ingestion window determination
- Protocol event decoding
- Balance snapshots
- Full ingestion workflow
- Wallet connection methods (MetaMask, WalletConnect, Coinbase)

### Integration Examples
```bash
python integration_example.py
```

Demonstrates:
- MetaMask authentication flow
- Coinbase Wallet with deep links
- WalletConnect with QR codes
- Replay attack prevention
- Session management

## Production Deployment

1. Set `ENVIRONMENT=production` in `.env`
2. Generate strong `SECRET_KEY` (done automatically by setup.py)
3. Configure Redis connection (required for production)
4. Set up HTTPS/TLS
5. Configure CORS for your frontend domain in `main.py`
6. Use production WSGI server

### Production Commands

**Linux/Mac:**
```bash
./run.sh
```

**Windows:**
```cmd
run.bat
```

**Manual (with gunicorn):**
```bash
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Docker Deployment (Optional)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["gunicorn", "main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

## Module 2: Data Ingestion Architecture

### Overview

The Data Ingestion module collects deterministic, verifiable blockchain data for credit scoring. It does NOT compute scores or make judgments—it only collects and normalizes facts.

### Data Flow

```
┌─────────────┐
│   Wallet    │
│  Connected  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  1. Determine Ingestion Window      │
│     - Calculate block range         │
│     - Define time period            │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  2. Fetch Wallet Metadata           │
│     - Current balance               │
│     - Transaction count             │
│     - Wallet age estimation         │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  3. Fetch Transaction History       │
│     - All wallet transactions       │
│     - Gas usage patterns            │
│     - Counterparty analysis         │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  4. Fetch Protocol Events           │
│     - Aave deposits/borrows         │
│     - Compound interactions         │
│     - Liquidation events            │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  5. Create Balance Snapshots        │
│     - Historical balance points     │
│     - Capital stability tracking    │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  6. Store in PostgreSQL             │
│     - Normalized data               │
│     - Indexed for queries           │
│     - Audit trail maintained        │
└─────────────────────────────────────┘
```

### Supported Protocols

| Protocol | Events Decoded | Status |
|----------|----------------|--------|
| Aave V2 | Deposit, Withdraw, Borrow, Repay, Liquidation | ✅ Active |
| Aave V3 | Deposit, Withdraw, Borrow, Repay, Liquidation | ✅ Active |
| Compound | Mint, Redeem, Borrow, Repay | ✅ Active |

### Database Schema

**wallet_metadata**
- Stores current wallet state
- Updated on each ingestion
- Indexed by wallet_address

**transactions**
- All wallet transactions
- Indexed by wallet_address, block_number, timestamp
- Includes gas usage and status

**protocol_events**
- DeFi protocol interactions
- Indexed by wallet_address, protocol_name, event_type
- Links to transaction hash

**balance_snapshots**
- Historical balance points
- Indexed by wallet_address, timestamp
- Used for capital stability analysis

**ingestion_logs**
- Audit trail of all ingestions
- Tracks success/failure
- Error logging for debugging

### Data Quality Guarantees

| Guarantee | Implementation |
|-----------|----------------|
| Deterministic | Same input → same output |
| Reproducible | Can be re-run and verified |
| Auditable | Raw source always traceable |
| Append-only | No mutation of history |
| Idempotent | Safe to re-run ingestion |

### Ingestion Strategy

**Incremental ETL:**
1. Initial full sync (one-time per wallet)
2. Store last processed block
3. Periodically ingest new blocks
4. Never rescan old data unless forced

**Benefits:**
- Scales efficiently
- Avoids repeated work
- Deterministic results
- Easy to debug and audit

### Wallet Connection Methods

The module supports multiple wallet connection methods:

**MetaMask:**
- Browser extension direct connection
- Deep links for mobile app

**WalletConnect:**
- Universal QR code protocol
- Works with any WalletConnect-compatible wallet
- Session management

**Coinbase Wallet:**
- Deep links for mobile
- QR codes for desktop users
- Dual connection method

**Generic Wallets:**
- QR code generation for any wallet
- Custom connection URLs
- Session-based tracking

### Performance Considerations

**RPC Rate Limits:**
- Chunks requests to avoid limits
- Configurable batch sizes
- Automatic retry logic

**Archive Node Requirements:**
- Historical balance queries require archive node
- Current implementation uses latest block only
- Can be upgraded with archive access

**Database Optimization:**
- Indexed queries for fast lookups
- Partitioning by wallet_address
- Efficient time-range queries

### Future Enhancements

- Support for more DeFi protocols (Uniswap, Curve, etc.)
- ERC-20 token balance tracking
- NFT ownership history
- Cross-chain data ingestion
- Real-time event streaming
- Advanced caching strategies
