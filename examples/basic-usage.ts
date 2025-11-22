/**
 * Basic Usage Example
 * 
 * This example demonstrates the basic usage of the Quotex SDK
 */

import { QuotexClient } from '../src';

async function main() {
  // Create client instance
  const client = new QuotexClient({
    email: 'your@email.com',
    password: 'your_password',
    lang: 'en',
    debug: true,
  });

  try {
    // Connect to platform
    console.log('Connecting to Quotex...');
    const connection = await client.connect();
    
    if (!connection.success) {
      console.error('Failed to connect:', connection.message);
      return;
    }

    console.log('✓ Connected successfully!');

    // Get profile information
    const profile = await client.getProfile();
    console.log('Profile:', {
      name: profile?.nickName,
      demoBalance: profile?.demoBalance,
      liveBalance: profile?.liveBalance,
    });

    // Get current balance
    const balance = await client.getBalance();
    console.log('Current Balance:', balance);

    // Get available assets
    const assets = await client.getAllAssetNames();
    console.log('Available Assets:', assets.slice(0, 5));

    // Check if specific asset is open
    const assetInfo = await client.checkAssetOpen('EURUSD');
    console.log('EURUSD Status:', {
      name: assetInfo?.name,
      isOpen: assetInfo?.isOpen,
      payout: assetInfo?.payout,
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Disconnect
    await client.disconnect();
    console.log('Disconnected');
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}

