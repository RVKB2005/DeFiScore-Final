# CDN Files for DeFi Credit Score

## Files Prepared

- **DeFiCreditScore.wasm**
  - Original: 1.93 MB
  - Compressed: 957.69 KB (51.6% reduction)
  - Checksum: e36fe4a49208cccb90087e51945744de092e7a46ec7359f0e1c1133293471c38

- **DeFiCreditScore_final.zkey**
  - Original: 678.56 KB
  - Compressed: 433.69 KB (36.1% reduction)
  - Checksum: 01cd8e438d971453f31a5c88727bdcae2b689529e7f144cef41852e97cec39c1

- **verification_key.json**
  - Original: 4.64 KB
  - Compressed: 4.64 KB (0% reduction)
  - Checksum: 0cca161702e6af36db9df2dd1ba31c2c6763728dff69bf8deb63139ef4f0551b


## Upload Instructions

### 1. Upload to CDN

Upload these files to your CDN:
- DeFiCreditScore.wasm.gz
- DeFiCreditScore_final.zkey.gz
- verification_key.json

### 2. CDN Configuration

**CORS Headers:**
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, HEAD
Access-Control-Allow-Headers: Content-Type, Range
Access-Control-Expose-Headers: Content-Length, Content-Range
```

**Cache Headers:**
```
Cache-Control: public, max-age=31536000, immutable
```

**Compression:**
```
Content-Encoding: gzip (for .gz files)
```

### 3. Environment Variables

**Backend (.env):**
```
CIRCUIT_WASM_URL=https://cdn.yourdomain.com/circuits/DeFiCreditScore.wasm
CIRCUIT_ZKEY_URL=https://cdn.yourdomain.com/circuits/DeFiCreditScore_final.zkey
VERIFICATION_KEY_URL=https://cdn.yourdomain.com/circuits/verification_key.json
```

**Frontend (.env):**
```
VITE_CIRCUIT_WASM_URL=https://cdn.yourdomain.com/circuits/DeFiCreditScore.wasm
VITE_PROVING_KEY_URL=https://cdn.yourdomain.com/circuits/DeFiCreditScore_final.zkey
```

### 4. Verification

After upload, verify files are accessible:
```bash
curl -I https://cdn.yourdomain.com/circuits/DeFiCreditScore.wasm
curl -I https://cdn.yourdomain.com/circuits/DeFiCreditScore_final.zkey
```

Check response headers include:
- Access-Control-Allow-Origin: *
- Cache-Control: public, max-age=31536000
- Content-Encoding: gzip

## CDN Providers

Recommended CDN providers:
- **Cloudflare R2** - Free tier, excellent performance
- **AWS CloudFront + S3** - Enterprise-grade, pay-as-you-go
- **Vercel Blob Storage** - Easy integration with Vercel deployments
- **Netlify Large Media** - Good for Netlify-hosted frontends

## File Integrity

Verify file integrity after upload using checksums:
- DeFiCreditScore.wasm: e36fe4a49208cccb90087e51945744de092e7a46ec7359f0e1c1133293471c38
- DeFiCreditScore_final.zkey: 01cd8e438d971453f31a5c88727bdcae2b689529e7f144cef41852e97cec39c1
- verification_key.json: 0cca161702e6af36db9df2dd1ba31c2c6763728dff69bf8deb63139ef4f0551b
