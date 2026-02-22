"""
Verify 24h change matches sparkline trend
"""
import asyncio
from market_data_service import market_data_service

async def test():
    print("Checking if 24h change matches 7d sparkline...")
    assets = await market_data_service.get_top_assets(10)
    
    for asset in assets[:5]:
        sparkline = asset['sparklineData']
        if not sparkline or len(sparkline) < 2:
            continue
            
        symbol = asset['symbol']
        current_price = asset['price']
        change_24h = asset['priceChange24h']
        
        # Calculate 7-day change from sparkline
        first_price = sparkline[0]
        last_price = sparkline[-1]
        change_7d = ((last_price - first_price) / first_price) * 100
        
        # Calculate what 24h change should be from sparkline
        # Last point in sparkline is most recent, second-to-last is ~21 hours ago
        if len(sparkline) >= 2:
            recent_price = sparkline[-2]
            sparkline_24h_change = ((last_price - recent_price) / recent_price) * 100
        else:
            sparkline_24h_change = 0
        
        print(f"\n{symbol}:")
        print(f"  Current Price: ${current_price:.2f}")
        print(f"  24h Change (API): {change_24h:+.2f}%")
        print(f"  7d Change (sparkline): {change_7d:+.2f}%")
        print(f"  Sparkline: ${first_price:.2f} → ${last_price:.2f}")
        
        # Check consistency
        if (change_24h > 0 and change_7d < -5) or (change_24h < 0 and change_7d > 5):
            print(f"  ⚠️  MISMATCH: 24h is {'+' if change_24h > 0 else '-'} but 7d trend is {'+' if change_7d > 0 else '-'}")
        else:
            print(f"  ✓ Consistent")

if __name__ == "__main__":
    asyncio.run(test())
