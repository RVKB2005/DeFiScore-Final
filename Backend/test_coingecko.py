import asyncio
import httpx
from config import settings

async def test_coingecko():
    headers = {"x-cg-demo-api-key": settings.COINGECKO_API_KEY} if settings.COINGECKO_API_KEY else {}
    
    print(f"Testing CoinGecko API...")
    print(f"API Key: {settings.COINGECKO_API_KEY[:10]}..." if settings.COINGECKO_API_KEY else "No API key")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Test ping
            resp = await client.get("https://api.coingecko.com/api/v3/ping", headers=headers)
            print(f"Ping: {resp.status_code} - {resp.text}")
            
            # Test global data
            resp = await client.get("https://api.coingecko.com/api/v3/global", headers=headers)
            print(f"Global: {resp.status_code}")
            if resp.status_code == 200:
                data = resp.json()
                print(f"Total Market Cap: ${data['data']['total_market_cap']['usd']:,.0f}")
            
            # Test markets
            resp = await client.get(
                "https://api.coingecko.com/api/v3/coins/markets",
                params={"vs_currency": "usd", "ids": "ethereum", "sparkline": "true"},
                headers=headers
            )
            print(f"Markets: {resp.status_code}")
            if resp.status_code == 200:
                data = resp.json()
                if data:
                    print(f"ETH Price: ${data[0]['current_price']}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_coingecko())
