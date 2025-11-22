/**
 * Market Monitoring Example
 * 
 * This example demonstrates real-time market data monitoring
 */

import { QuotexClient } from '../src';

async function main() {
  const client = new QuotexClient({
    email: 'your@email.com',
    password: 'your_password',
    lang: 'en',
  });

  try {
    console.log('📡 Market Monitor Starting...\n');
    
    const connection = await client.connect();
    if (!connection.success) {
      throw new Error('Failed to connect');
    }

    const assets = ['EURUSD', 'GBPUSD', 'USDJPY'];
    const period = 60; // 1 minute

    console.log(`Monitoring assets: ${assets.join(', ')}\n`);

    // Subscribe to multiple asset streams
    for (const asset of assets) {
      // Subscribe to candles
      client.subscribeToCandleStream(asset, period, (candle) => {
        const change = ((candle.close - candle.open) / candle.open * 100).toFixed(2);
        const trend = candle.close > candle.open ? '📈' : '📉';
        
        console.log(`${trend} ${asset} | O: ${candle.open.toFixed(5)} H: ${candle.high.toFixed(5)} L: ${candle.low.toFixed(5)} C: ${candle.close.toFixed(5)} | ${change}%`);
      });

      // Subscribe to sentiment
      client.subscribeToSentimentStream(asset, (sentiment) => {
        const { buy, sell } = sentiment.sentiment;
        const buyBar = '█'.repeat(Math.floor(buy / 5));
        const sellBar = '█'.repeat(Math.floor(sell / 5));
        
        console.log(`💭 ${asset} Sentiment:`);
        console.log(`   BUY  [${buyBar.padEnd(20, '░')}] ${buy}%`);
        console.log(`   SELL [${sellBar.padEnd(20, '░')}] ${sell}%\n`);
      });
    }

    // Start signals data
    client.startSignalsData();

    // Monitor for a period
    console.log('Monitoring for 60 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 60000));

    // Get final statistics
    console.log('\n📊 Session Summary:');
    for (const asset of assets) {
      const candles = await client.getRealtimeCandles(asset);
      if (candles.length > 0) {
        const firstCandle = candles[0];
        const lastCandle = candles[candles.length - 1];

        if ( !lastCandle || !firstCandle) {
          throw new Error('Required fields not found')
        }
        
        const change = ((lastCandle.close - firstCandle.open) / firstCandle.open * 100).toFixed(2);
        
        console.log(`${asset}: ${change}% (${firstCandle.open.toFixed(5)} → ${lastCandle.close.toFixed(5)})`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.disconnect();
    console.log('\n👋 Monitor stopped');
  }
}

if (import.meta.main) {
  main();
}

