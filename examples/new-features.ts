/**
 * New Features Example (@NEW_FUNCTION)
 * 
 * This example demonstrates all the newly added functions that match Python SDK
 */

import { QuotexClient } from '../src';

async function main() {
  // Create client instance
  const client = new QuotexClient({
    email: process.env.QUOTEX_EMAIL || 'your@email.com',
    password: process.env.QUOTEX_PASSWORD || 'your_password',
    lang: 'en',
    debug: true,
  });

  try {
    // Connect to platform
    console.log('🔌 Connecting to Quotex...');
    const connection = await client.connect();
    
    if (!connection.success) {
      console.error('❌ Failed to connect:', connection.message);
      return;
    }

    console.log('✅ Connected successfully!\n');

    // ==================== NEW INDICATORS ====================
    console.log('📊 Testing New Indicators...\n');

    // Test ADX Indicator
    console.log('1️⃣  Testing ADX Indicator:');
    try {
      const adx = await client.calculateIndicator({
        asset: 'EURUSD_otc',
        indicator: 'ADX',
        params: { period: 14 },
        timeframe: 60,
      });
      console.log('   ADX Result:', {
        current: adx.current,
        historySize: adx.historySize,
      });
    } catch (error) {
      console.log('   ⚠️  ADX calculation failed:', (error as Error).message);
    }

    // Test ICHIMOKU Indicator
    console.log('\n2️⃣  Testing ICHIMOKU Indicator:');
    try {
      const ichimoku = await client.calculateIndicator({
        asset: 'EURUSD_otc',
        indicator: 'ICHIMOKU',
        params: { tenkanPeriod: 9, kijunPeriod: 26, senkouBPeriod: 52 },
        timeframe: 300,
      });
      console.log('   ICHIMOKU Result:', {
        current: ichimoku.current,
        historySize: ichimoku.historySize,
      });
    } catch (error) {
      console.log('   ⚠️  ICHIMOKU calculation failed:', (error as Error).message);
    }

    // ==================== WEBSOCKET STATUS ====================
    console.log('\n🔗 Testing WebSocket Status...\n');

    console.log('3️⃣  WebSocket Alive Check:');
    const isAlive = client.websocketAlive();
    console.log('   WebSocket Status:', isAlive ? '✅ Connected' : '❌ Disconnected');

    // ==================== MARKET DATA FUNCTIONS ====================
    console.log('\n📈 Testing New Market Data Functions...\n');

    // Test Opening/Closing Current Candle
    console.log('4️⃣  Testing Opening/Closing Current Candle:');
    try {
      const candleInfo = await client.openingClosingCurrentCandle('EURUSD_otc', 60);
      if (candleInfo) {
        console.log('   Candle Info:', {
          symbol: candleInfo.symbol,
          open: candleInfo.open,
          close: candleInfo.close,
          remaining: `${candleInfo.remaining}s`,
        });
      } else {
        console.log('   ⚠️  No candle data available yet');
      }
    } catch (error) {
      console.log('   ⚠️  Failed:', (error as Error).message);
    }

    // Test Store Settings Apply
    console.log('\n5️⃣  Testing Store Settings Apply:');
    try {
      const settings = await client.storeSettingsApply(
        'EURUSD_otc',
        60,
        'TIME',
        50,
        false,
        1
      );
      console.log('   Settings Applied:', {
        asset: settings.currentAsset?.symbol,
        dealValue: settings.dealValue,
        timePeriod: settings.timePeriod,
      });
    } catch (error) {
      console.log('   ⚠️  Failed:', (error as Error).message);
    }

    // ==================== HISTORY FUNCTIONS ====================
    console.log('\n📜 Testing History Functions...\n');

    // Test Get Trader History
    console.log('6️⃣  Testing Trader History:');
    try {
      const history = await client.getTraderHistory('demo', 1);
      console.log('   History Retrieved:', {
        dataCount: history.data?.length || 0,
        hasData: !!history.data,
      });
      
      if (history.data && history.data.length > 0) {
        console.log('   Latest Trade:', {
          asset: history.data[0].asset,
          amount: history.data[0].amount,
          profit: history.data[0].profitAmount,
        });
      }
    } catch (error) {
      console.log('   ⚠️  Failed:', (error as Error).message);
    }

    // ==================== REAL-TIME INDICATOR SUBSCRIPTION ====================
    console.log('\n🔔 Testing Real-time Indicator Subscription...\n');

    console.log('7️⃣  Subscribing to Real-time RSI:');
    let updateCount = 0;
    const unsubscribe = await client.subscribeIndicator({
      asset: 'EURUSD_otc',
      indicator: 'RSI',
      params: { period: 14 },
      timeframe: 60,
      callback: (result) => {
        updateCount++;
        console.log(`   📊 RSI Update #${updateCount}:`, {
          current: result.current,
          timestamp: new Date().toISOString(),
        });
        
        // Stop after 3 updates
        if (updateCount >= 3) {
          console.log('   ✅ Received 3 updates, unsubscribing...');
          unsubscribe();
        }
      },
    });

    console.log('   ✅ Subscribed to RSI updates (waiting for 3 updates...)');
    
    // Wait for updates
    await new Promise(resolve => setTimeout(resolve, 15000));

    console.log('\n✅ All new features tested!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Disconnect
    console.log('\n👋 Disconnecting...');
    await client.disconnect();
    console.log('✅ Disconnected');
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}

export { main as testNewFeatures };

