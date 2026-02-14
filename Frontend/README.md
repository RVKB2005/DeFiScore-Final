# DeFiScore – Frontend

Frontend for **DeFiScore**, a privacy-first decentralized credit scoring platform built during the internship at **SprintXplore**.

DeFiScore enables wallet-based credit scoring using on-chain activity while preserving user privacy through Zero-Knowledge techniques.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and set VITE_API_BASE_URL to your backend URL

# 3. Start development server
npm run dev
```

Frontend runs on `http://localhost:8080`

---

## Backend Connection

This frontend connects to the DeFiScore Backend API for wallet authentication.

### Prerequisites
1. Backend server must be running (see `../Backend/README.md`)
2. Backend should be accessible at the URL specified in `.env`

### Environment Configuration

Create `.env` file:
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_ENVIRONMENT=development
```

For production:
```env
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_ENVIRONMENT=production
```

---

## Wallet Authentication Flow

The frontend implements secure wallet-based authentication:

1. **User clicks "Connect Wallet"**
2. **Wallet selection** (MetaMask, Coinbase Wallet, WalletConnect)
3. **Wallet connection** via browser extension
4. **Backend nonce request** - Frontend requests authentication challenge
5. **Message signing** - User signs message in wallet (no gas fees)
6. **Signature verification** - Backend verifies signature
7. **JWT token issued** - Session established
8. **Authenticated state** - User can access protected features

### Supported Wallets

| Wallet | Status | Type |
|--------|--------|------|
| MetaMask | ✅ Active | Browser Extension |
| Coinbase Wallet | ✅ Active | Browser Extension |
| WalletConnect | 🔄 Coming Soon | QR Code |

---

## Key Features

- ✅ Real wallet connection (MetaMask, Coinbase)
- ✅ Cryptographic authentication (no passwords)
- ✅ JWT session management
- ✅ Automatic session persistence
- ✅ Account change detection
- ✅ Network change handling
- ✅ Credit score dashboard
- ✅ Market overview & analytics
- ✅ Lending & borrowing interface
- ✅ Transaction history
- ✅ Privacy-first design
- ✅ Responsive dark UI
- ✅ Fast performance with Vite

---

## Tech Stack

### Frontend
- React 18
- TypeScript
- Tailwind CSS
- Vite
- Framer Motion

### Web3 / Blockchain
- Ethers.js v6
- Wallet integration (MetaMask, Coinbase)
- Message signing (EIP-191)

### State & UI
- React Router
- Context API
- Recharts (charts & analytics)
- Shadcn UI components
- Sonner (toast notifications)

---

## Architecture Overview

```
User Wallet → Frontend → Backend API → Authentication
     ↓           ↓            ↓
  Sign Msg   Display UI   Verify Sig
```

### Authentication Flow:
1. User connects wallet (MetaMask/Coinbase)
2. Frontend requests nonce from backend
3. User signs authentication message
4. Backend verifies signature
5. JWT token issued and stored
6. Protected routes accessible

---

## Project Structure

```
src/
├── components/
│   ├── layout/          # Layout components
│   ├── modals/          # Modal dialogs
│   ├── charts/          # Data visualizations
│   └── ui/              # Shadcn UI components
├── pages/               # Route pages
├── hooks/               # Custom React hooks
│   └── useWallet.tsx    # Wallet authentication hook
├── services/
│   ├── authService.ts   # Backend API calls
│   └── walletConnector.ts # Wallet connection logic
├── config/
│   └── api.ts           # API configuration
├── types/               # TypeScript types
├── utils/               # Utility functions
├── App.tsx              # Main app component
└── main.tsx             # Entry point
```

---

## Installation & Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- MetaMask or Coinbase Wallet browser extension

### Development Setup

```bash
# Clone repository
git clone https://github.com/coeffx-technologies/DeFiScore.git
cd DeFiScore/Frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your backend URL

# Start development server
npm run dev
```

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

---

## API Integration

The frontend communicates with the backend through REST API:

### Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/nonce` | POST | Request authentication nonce |
| `/auth/verify` | POST | Verify wallet signature |
| `/auth/me` | GET | Get authenticated user info |
| `/auth/logout` | POST | Logout and revoke session |

### Example API Call

```typescript
import { authService } from '@/services/authService';

// Request nonce
const { nonce, message } = await authService.requestNonce(walletAddress);

// Sign message with wallet
const signature = await signer.signMessage(message);

// Verify and get token
const { access_token } = await authService.verifySignature(
  walletAddress,
  message,
  signature
);
```

---

## Security Features

- ✅ No private keys stored
- ✅ Message signing (not transactions)
- ✅ Nonce-based replay protection
- ✅ JWT token with expiration
- ✅ Automatic session cleanup
- ✅ Account change detection
- ✅ Network change handling

---

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run test         # Run tests
```

### Adding New Features

1. Create components in `src/components/`
2. Add pages in `src/pages/`
3. Update routes in `src/App.tsx`
4. Add API calls in `src/services/`
5. Update types in `src/types/`

---

## Troubleshooting

### Wallet Connection Issues

**Problem:** MetaMask not detected
- **Solution:** Install MetaMask browser extension
- **Solution:** Refresh page after installation

**Problem:** Connection rejected
- **Solution:** User must approve connection in wallet
- **Solution:** Check wallet is unlocked

**Problem:** Signature rejected
- **Solution:** User must sign message to authenticate
- **Solution:** No gas fees required for signing

### Backend Connection Issues

**Problem:** API calls failing
- **Solution:** Ensure backend is running
- **Solution:** Check `VITE_API_BASE_URL` in `.env`
- **Solution:** Verify CORS is enabled on backend

**Problem:** Authentication failing
- **Solution:** Check backend logs for errors
- **Solution:** Ensure Redis is running (or in-memory fallback)
- **Solution:** Verify wallet address format

---

## Future Improvements

- ✅ WalletConnect integration (QR code)
- ✅ Multi-chain support
- ✅ Mobile wallet deep links
- ⏳ Zero-knowledge proof verification UI
- ⏳ Mobile app support
- ⏳ AI-based risk analysis
- ⏳ Real-time notifications
- ⏳ Credit history timeline

---

## License

This project is part of the SprintXplore internship program.

---

# Full Stack Integration Guide

## Quick Start (Full Stack)

### 1. Start Backend

```bash
cd Backend
python setup.py
python main.py
```

Backend runs on `http://localhost:8000`

### 2. Start Frontend

```bash
cd Frontend
npm install
cp .env.example .env
npm run dev
```

Frontend runs on `http://localhost:8080`

### 3. Test Connection

1. Open `http://localhost:8080`
2. Click "Connect Wallet"
3. Select MetaMask or Coinbase Wallet
4. Approve connection in wallet
5. Sign authentication message
6. You're authenticated!

---

## Complete Authentication Flow

### Step 1: User Clicks "Connect Wallet"
Frontend displays wallet selection modal

### Step 2: Wallet Connection
MetaMask/Coinbase popup appears, user approves, wallet address retrieved

### Step 3: Request Nonce
Frontend → Backend: `POST /auth/nonce` with wallet address
Backend generates random nonce, creates message, stores with 5-min expiration

### Step 4: Sign Message
MetaMask shows message, user signs (no gas fees), signature generated

### Step 5: Verify Signature
Frontend → Backend: `POST /auth/verify` with address, message, signature
Backend verifies nonce unused, verifies signature, consumes nonce, creates JWT

### Step 6: Store Session
Token stored in localStorage, user marked authenticated, UI updates

### Step 7: Authenticated Requests
All API calls include: `Authorization: Bearer <token>`

---

## Environment Configuration

### Backend (.env)
```env
SECRET_KEY=<auto-generated-by-setup>
ACCESS_TOKEN_EXPIRE_MINUTES=30
NONCE_EXPIRE_SECONDS=300
REDIS_HOST=localhost
REDIS_PORT=6379
ENVIRONMENT=development
```

### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_ENVIRONMENT=development
```

---

## Troubleshooting

**MetaMask not detected:** Install MetaMask browser extension

**User rejected connection:** User must approve in wallet

**Failed to request nonce:** Check backend running: `curl http://localhost:8000/auth/health`

**Invalid signature:** Ensure message not modified, correct wallet connected

**Token expired:** JWT expires after 30 minutes, reconnect wallet

**Network error:** Check `VITE_API_BASE_URL` in Frontend `.env`

---

## Production Deployment

### Backend
1. Set `ENVIRONMENT=production` in `.env`
2. Configure Redis (required)
3. Set up HTTPS/TLS
4. Configure CORS for production domain
5. Use: `gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker`

### Frontend
1. Update `.env`: `VITE_API_BASE_URL=https://api.yourdomain.com`
2. Build: `npm run build`
3. Deploy `dist/` folder
4. Configure HTTPS
