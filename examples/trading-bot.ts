/**
 * Simple Trading Bot Example
 * 
 * This example demonstrates how to build a simple trading bot
 * using market sentiment analysis
 */

import { QuotexClient } from '../src';

async function main() {
  const client = new QuotexClient({
    email: 'your@email.com',
    password: 'your_password',
    lang: 'en',
  });

  try {
    console.log('🤖 Starting Trading Bot...');
    
    // Connect
    const connection = await client.connect();
    if (!connection.success) {
      throw new Error('Failed to connect');
    }

    // Set to demo mode
    client.setAccountMode('PRACTICE');
    console.log('✓ Using PRACTICE mode');

    // Configuration
    const asset = 'EURUSD';
    const amount = 50;
    const duration = 60; // seconds

    // Check if asset is available
    const assetInfo = await client.getAvailableAsset(asset, true);
    if (!assetInfo || !assetInfo.isOpen) {
      console.error('❌ Asset is not available');
      return;
    }

    console.log(`✓ Trading ${assetInfo.name} (Payout: ${assetInfo.payout}%)`);

    // Get initial balance
    const initialBalance = await client.getBalance();
    console.log(`💰 Initial Balance: $${initialBalance}`);

    // Subscribe to market sentiment
    let latestSentiment: any = null;
    client.subscribeToSentimentStream(asset, (sentiment) => {
      latestSentiment = sentiment;
      console.log(`📊 Sentiment - Buy: ${sentiment.sentiment.buy}% | Sell: ${sentiment.sentiment.sell}%`);
    });

    // Wait for sentiment data
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Make trading decision based on sentiment
    if (latestSentiment) {
      const { buy, sell } = latestSentiment.sentiment;
      
      if (buy > 65) {
        console.log('📈 Strong buy signal detected, placing CALL order...');
        
        const result = await client.buy({
          amount,
          asset: assetInfo.name,
          direction: 'call',
          duration,
        });

        if (result.success && result.data) {
          console.log('✓ Order placed:', result.data.id);
          
          // Wait for result
          const won = await client.checkWin(result.data.id);
          const profit = client.getProfit();
          
          if (won) {
            console.log(`✅ WIN! Profit: $${profit}`);
          } else {
            console.log(`❌ LOSS: -$${Math.abs(profit)}`);
          }

          // Get final balance
          const finalBalance = await client.getBalance();
          console.log(`💰 Final Balance: $${finalBalance}`);
          console.log(`📊 Change: ${finalBalance > initialBalance ? '+' : ''}$${(finalBalance - initialBalance).toFixed(2)}`);
        }
      } else if (sell > 65) {
        console.log('📉 Strong sell signal detected, placing PUT order...');
        // Similar logic for PUT orders
      } else {
        console.log('⏸️  No strong signal, skipping trade');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.disconnect();
    console.log('👋 Bot stopped');
  }
}

if (import.meta.main) {
  main();
}

