# 🚀 QuotexSDK - TypeScript SDK for Quotex Trading Platform

A complete, production-ready TypeScript SDK for Quotex trading platform built with Bun.

## ✨ Features

- ✅ **Automated Browser Login** - Bypasses anti-bot protection using Playwright
- ✅ Full trading operations (buy, sell, pending orders)
- ✅ Real-time market data & streaming
- ✅ 9 Technical indicators (RSI, MACD, Bollinger Bands, etc.)
- ✅ Account management (demo/real switching)
- ✅ Asset discovery & management
- ✅ WebSocket-based real-time updates
- ✅ Type-safe with TypeScript
- ✅ Session persistence
- ✅ Smart fallback: HTTP → Browser automation

---

## 📦 Installation & Setup

### Step 1: Install Dependencies

```bash
bun install
```

### Step 2: Configure Environment Variables

1. Copy the example environment file:
```bash
cp .env.example .env.local
```

2. Edit `.env.local` with your Quotex credentials:
```env
QUOTEX_EMAIL=your@email.com
QUOTEX_PASSWORD=yourpassword
QUOTEX_LANG=en
QUOTEX_MODE=PRACTICE
DEBUG=true
```

**⚠️ Important:** Always start with `QUOTEX_MODE=PRACTICE` (demo account) for testing!

---

## 🚀 Quick Start

### Run the Example

```bash
bun run index.ts
```

This will:
1. Connect to Quotex
2. Get your profile and balance
3. List all available assets
4. Find assets with highest payout
5. Get historical candles for EURUSD
6. Calculate RSI indicator
7. Subscribe to real-time price updates

---

## 📖 Usage Examples

### Basic Connection

```typescript
import { QuotexClient } from './src';

const client = new QuotexClient({
  email: process.env.QUOTEX_EMAIL!,
  password: process.env.QUOTEX_PASSWORD!,
  lang: 'en',
  debug: true,
});

await client.connect();
console.log('Connected!');
```

### Get Balance

```typescript
const balance = await client.getBalance();
console.log('Balance:', balance);
```

### Get All Assets

```typescript
const assets = await client.getAllAssets();
console.log('Available assets:', assets);
```

### Get Historical Candles

```typescript
const candles = await client.getCandles({
  asset: 'EURUSD',
  offset: 3600,  // Last hour
  period: 60,    // 1-minute candles
});

console.log('Candles:', candles);
```

### Calculate Technical Indicators

```typescript
// RSI
const rsi = await client.calculateIndicator({
  asset: 'EURUSD',
  indicator: 'RSI',
  params: { period: 14 },
  timeframe: 300, // 5 minutes
});
console.log('RSI:', rsi.current);

// MACD
const macd = await client.calculateIndicator({
  asset: 'EURUSD',
  indicator: 'MACD',
  params: {},
  timeframe: 300,
});
console.log('MACD:', macd.current);
```

### Subscribe to Real-Time Prices

```typescript
const unsubscribe = client.subscribeToPriceStream(
  'EURUSD',
  60,
  (price) => {
    console.log(`Price: ${price.price} at ${price.time}`);
  }
);

// Stop subscription
setTimeout(() => unsubscribe(), 60000);
```

### Place a Trade

```typescript
// Set to demo mode (required for testing)
client.setAccountMode('PRACTICE');

// Place trade
const result = await client.buy({
  amount: 10,
  asset: 'EURUSD',
  direction: 'call',
  duration: 60,
});

if (result.success) {
  console.log('Trade placed:', result.data?.id);
  
  // Check result
  const won = await client.checkWin(result.data!.id);
  console.log(won ? 'WIN!' : 'LOSS');
}
```

### Get Market Sentiment

```typescript
const sentiment = await client.getRealtimeSentiment('EURUSD');
console.log('Buy:', sentiment?.sentiment.buy + '%');
console.log('Sell:', sentiment?.sentiment.sell + '%');
```

---

## 🎯 Available Functions

### Connection
- `connect()` - Connect to Quotex
- `disconnect()` - Disconnect
- `isConnected()` - Check connection status

### Trading
- `buy(options)` - Place a trade
- `openPending(options)` - Schedule a trade
- `sellOption(id)` - Close position early
- `checkWin(id)` - Check if trade won
- `getProfit()` - Get last profit/loss

### Market Data
- `getCandles(options)` - Get historical candles
- `getRealtimeCandles(asset)` - Get real-time candles
- `getRealtimePrice(asset)` - Get current price
- `getRealtimeSentiment(asset)` - Get market sentiment

### Subscriptions
- `subscribeToCandleStream(asset, period, callback)` - Real-time candles
- `subscribeToPriceStream(asset, period, callback)` - Real-time prices
- `subscribeToSentimentStream(asset, callback)` - Real-time sentiment

### Indicators
- `calculateIndicator(options)` - Calculate technical indicators
  - Supported: RSI, MACD, BOLLINGER, SMA, EMA, ATR, STOCHASTIC

### Account
- `getProfile()` - Get user profile
- `getBalance()` - Get current balance
- `setAccountMode(mode)` - Switch between PRACTICE/REAL
- `editPracticeBalance(amount)` - Refill demo balance

### Assets
- `getAllAssets()` - Get all available assets
- `checkAssetOpen(name)` - Check if asset is tradable
- `getAvailableAsset(name, forceOTC)` - Get asset (try OTC if closed)
- `getPayoutByAsset(name)` - Get payout percentage
- `searchAssets(query)` - Search assets

---

## ⚙️ Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `QUOTEX_EMAIL` | Your Quotex email | - | ✅ Yes |
| `QUOTEX_PASSWORD` | Your Quotex password | - | ✅ Yes |
| `QUOTEX_LANG` | Language (en/pt/es) | `en` | No |
| `QUOTEX_MODE` | PRACTICE or REAL | `PRACTICE` | No |
| `DEBUG` | Enable debug logs | `false` | No |
| `BROWSER_HEADLESS` | Hide browser (false=visible) | `true` | No |

---

## 📁 Project Structure

```
quotexsdk/
├── src/                    # Source code
│   ├── client/            # Main QuotexClient
│   ├── core/              # WebSocket, HTTP, Session
│   ├── features/          # Trading, Market Data, Indicators
│   ├── types/             # TypeScript types
│   ├── utils/             # Utilities
│   └── config/            # Configuration
├── examples/              # Usage examples
├── index.ts              # Quick start example
├── .env.example          # Environment template
├── .env.local            # Your configuration
└── README.md             # This file
```

---

## 🛠️ Available Scripts

```bash
# Run the example
bun run index.ts

# Run specific examples
bun run examples/basic-usage.ts
bun run examples/trading-bot.ts
bun run examples/technical-analysis.ts
bun run examples/market-monitoring.ts

# Build the SDK
bun run build

# Development mode
bun run dev
```

---

## 📊 Timeframes

Available timeframes for candles and indicators:

| Name | Seconds | Description |
|------|---------|-------------|
| M1 | 60 | 1 minute |
| M5 | 300 | 5 minutes |
| M15 | 900 | 15 minutes |
| M30 | 1800 | 30 minutes |
| H1 | 3600 | 1 hour |
| H2 | 7200 | 2 hours |
| H4 | 14400 | 4 hours |
| D1 | 86400 | 1 day |

---

## ⚠️ Important Notes

### Safety First
1. **Always test in PRACTICE mode first** before using real money
2. **Never commit your .env.local file** - it contains your credentials
3. **Implement proper risk management** - don't risk more than you can afford
4. **Monitor your bot** - don't leave automated trading unattended

### Trading Risks
- Trading involves substantial risk of loss
- Past performance does not guarantee future results
- This SDK is a tool - success depends on your strategy
- Always use stop-loss limits and position sizing

### Technical Notes
- Session data is saved in `quotex-session.json`
- WebSocket reconnects automatically on disconnect
- All trading functions are async/await
- Type-safe with full TypeScript support

---

## 🔧 Troubleshooting

### 🚀 Automated Browser Authentication

**Good News!** The SDK now automatically uses Playwright to bypass anti-bot protection (same as the Python SDK).

**How it works:**
1. SDK first tries direct HTTP login (fast)
2. If blocked (403 error), automatically launches headless Chrome
3. Browser fills the form like a real user
4. Extracts session cookies and tokens automatically

**You don't need to do anything!** Just provide your credentials in `.env.local`.

### 🚧 Common Issues

#### HTTP 403 Forbidden Error (Anti-Bot Protection)

**Issue**: Quotex uses CloudFlare protection that blocks automated HTTP requests.

**Solution**: The SDK automatically falls back to browser automation (Playwright).

**Debug Mode**: 
- Set `DEBUG=true` in `.env.local` to see detailed logs
- Set `BROWSER_HEADLESS=false` to see the browser in action (great for debugging!)

**Manual Session (Alternative)**:
If you prefer to skip browser automation, manually create `quotex-session.json`:
```json
{
  "token": "your_token_from_browser",
  "cookies": "your_cookies_from_browser",
  "userAgent": "Mozilla/5.0...",
  "timestamp": 1234567890
}
```

#### Connection Failed
- ✅ Check your email and password in `.env.local` (use real credentials, not placeholders!)
- ✅ Make sure you have internet connection
- ✅ SDK automatically uses browser when needed
- ✅ Set `DEBUG=true` to see detailed logs
- ⚠️  First run may be slower (Playwright downloads Chromium)

#### Login Still Fails
- Verify credentials are correct (try logging in manually at qxbroker.com)
- Check if your account requires 2FA (not yet supported)
- Try running with headless: false to see the browser
- Some accounts may have restrictions

#### Asset is Closed
- Use `getAvailableAsset(asset, true)` to try OTC version
- Check trading hours for the asset
- Some assets are only available at certain times

#### Trade Failed
- Check your balance is sufficient
- Verify the asset is open for trading
- Make sure you're in the correct account mode

#### Environment Variables Not Loading
- Make sure `.env.local` exists
- Bun loads `.env.local` automatically
- Check for typos in variable names

---

## 📚 Additional Resources

### Examples Directory
Check the `examples/` folder for complete working examples:
- `basic-usage.ts` - Getting started
- `trading-bot.ts` - Simple trading bot
- `technical-analysis.ts` - Using indicators
- `market-monitoring.ts` - Real-time monitoring

### Type Definitions
Full TypeScript types are in `src/types/` - use your IDE's autocomplete for documentation.

---

## 🎯 Next Steps

1. **Setup**: Copy `.env.example` to `.env.local` and add your credentials
2. **Test**: Run `bun run index.ts` to verify everything works
3. **Explore**: Check examples in `examples/` directory
4. **Build**: Create your own trading strategy
5. **Test**: Always test thoroughly in PRACTICE mode
6. **Deploy**: Only use REAL mode after extensive testing

---

## 📝 License

MIT License - Use at your own risk

---

## ⚠️ Disclaimer

This SDK is for educational and development purposes. Trading involves risk. The authors are not responsible for any financial losses. Always trade responsibly and within your means.

---

**Ready to start? Edit `.env.local` and run `bun run index.ts`** 🚀
