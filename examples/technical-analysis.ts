/**
 * Technical Analysis Example
 * 
 * This example demonstrates how to use technical indicators
 * for trading decisions
 */

import { QuotexClient, TIMEFRAMES } from '../src';

async function main() {
  const client = new QuotexClient({
    email: 'your@email.com',
    password: 'your_password',
    lang: 'en',
  });

  try {
    console.log('📊 Technical Analysis Demo');
    
    // Connect
    const connection = await client.connect();
    if (!connection.success) {
      throw new Error('Failed to connect');
    }

    const asset = 'EURUSD';
    const timeframe = TIMEFRAMES.M5; // 5 minutes

    console.log(`\nAnalyzing ${asset} on ${timeframe}s timeframe...\n`);

    // Calculate RSI
    const rsi = await client.calculateIndicator({
      asset,
      indicator: 'RSI',
      params: { period: 14 },
      timeframe,
    });
    console.log('📈 RSI:', rsi.current.toFixed(2));
    console.log('  Status:', rsi.current > 70 ? 'Overbought' : rsi.current < 30 ? 'Oversold' : 'Neutral');

    // Calculate MACD
    const macd = await client.calculateIndicator({
      asset,
      indicator: 'MACD',
      params: {},
      timeframe,
    });
    console.log('\n📊 MACD:');
    console.log('  MACD Line:', macd.current.macd.toFixed(5));
    console.log('  Signal Line:', macd.current.signal.toFixed(5));
    console.log('  Histogram:', macd.current.histogram.toFixed(5));
    console.log('  Trend:', macd.current.histogram > 0 ? 'Bullish' : 'Bearish');

    // Calculate Bollinger Bands
    const bb = await client.calculateIndicator({
      asset,
      indicator: 'BOLLINGER',
      params: { period: 20, std: 2 },
      timeframe,
    });
    console.log('\n📉 Bollinger Bands:');
    console.log('  Upper:', bb.current.upper.toFixed(5));
    console.log('  Middle:', bb.current.middle.toFixed(5));
    console.log('  Lower:', bb.current.lower.toFixed(5));

    // Get current price
    const prices = await client.getRealtimePrice(asset);
    const currentPrice = prices[prices.length - 1]?.price;
    
    if (currentPrice) {
      console.log('\n💹 Current Price:', currentPrice.toFixed(5));
      
      if (currentPrice > bb.current.upper) {
        console.log('  Position: Above upper band (potential reversal)');
      } else if (currentPrice < bb.current.lower) {
        console.log('  Position: Below lower band (potential reversal)');
      } else {
        console.log('  Position: Within bands');
      }
    }

    // Trading decision
    console.log('\n🎯 Trading Signal:');
    if (rsi.current < 30 && macd.current.histogram > 0) {
      console.log('  ✅ STRONG BUY (Oversold RSI + Bullish MACD)');
    } else if (rsi.current > 70 && macd.current.histogram < 0) {
      console.log('  ❌ STRONG SELL (Overbought RSI + Bearish MACD)');
    } else if (rsi.current < 40 && macd.current.histogram > 0) {
      console.log('  📈 BUY (RSI + Bullish MACD)');
    } else if (rsi.current > 60 && macd.current.histogram < 0) {
      console.log('  📉 SELL (RSI + Bearish MACD)');
    } else {
      console.log('  ⏸️  NEUTRAL (Wait for clearer signal)');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.disconnect();
  }
}

if (import.meta.main) {
  main();
}

