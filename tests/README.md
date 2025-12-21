# Quotex SDK Tests

This directory contains Bun test files for the Quotex SDK.

## Running Tests

### Run all tests:
```bash
bun test
```

### Run specific test file:
```bash
bun test tests/connection.test.ts
bun test tests/indicators.test.ts
bun test tests/market-data.test.ts
bun test tests/assets.test.ts
bun test tests/history.test.ts
```

### Run with watch mode:
```bash
bun test --watch
```

## Environment Variables

For actual testing with real API, set these environment variables:

```bash
export QUOTEX_EMAIL="your@email.com"
export QUOTEX_PASSWORD="your_password"
```

Or create a `.env` file:
```
QUOTEX_EMAIL=your@email.com
QUOTEX_PASSWORD=your_password
```

## Test Files

### `connection.test.ts`
Tests basic connection, authentication, and WebSocket functionality:
- Client creation
- Connection/disconnection
- Profile retrieval
- Balance checking
- WebSocket alive status (@NEW_FUNCTION)

### `assets.test.ts`
Tests asset management functionality:
- Getting all instruments
- Getting asset names
- Checking asset status
- Payout information
- Asset search

### `indicators.test.ts`
Tests technical indicator calculations:
- RSI, MACD, Bollinger Bands
- **ADX indicator (@NEW_FUNCTION)**
- **ICHIMOKU indicator (@NEW_FUNCTION)**
- **Real-time indicator subscription (@NEW_FUNCTION)**

### `market-data.test.ts`
Tests market data functionality:
- Historical candles
- **Opening/closing candle info (@NEW_FUNCTION)**
- **Store settings apply (@NEW_FUNCTION)**
- Candle streams
- Real-time price/sentiment

### `history.test.ts`
Tests trade history functionality:
- Trade history retrieval
- **Paginated trader history (@NEW_FUNCTION)**
- History by asset
- History by date range

## Notes

- Tests marked with **@NEW_FUNCTION** are for newly implemented features
- Some tests require valid credentials to pass
- Tests may skip if market data is not available
- Tests have timeouts to handle network delays
- Connection tests have 30-second timeout
- Most other tests have 10-15 second timeouts

