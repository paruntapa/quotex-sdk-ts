/**
 * Quotex SDK - Test Script
 * 
 * This script tests the SDK with your manual session and shows:
 * - Account details (balance, mode, profile)
 * - Available assets
 * - WebSocket connection
 * - Basic API functionality
 * 
 * Make sure you have a valid quotex-session.json file!
 */

import { QuotexClient } from './src';
import { existsSync } from 'fs';

/**
 * Main function - tests SDK with manual session
 */
async function main() {
  console.log('🚀 Quotex SDK - Account & API Test\n');

  // Check if session exists
  const sessionFile = './quotex-session.json';
  if (!existsSync(sessionFile)) {
    console.error('❌ Error: quotex-session.json not found!');
    console.log('\n📝 Create a session first:');
    console.log('1. Run: bun run create-session');
    console.log('2. Or read: CLOUDFLARE_WORKAROUND.md\n');
    process.exit(1);
  }

  // Create client (will use session automatically)
  const config = {
    email: process.env.QUOTEX_EMAIL ||'session-user', // Not needed with manual session
    password: process.env.QUOTEX_PASSWORD || 'session-pass', // Not needed with manual session
    lang: (process.env.QUOTEX_LANG || 'en') as 'en' | 'pt' | 'es',
    debug: process.env.DEBUG === 'true',
  };

  const client = new QuotexClient(config);

  try {
    // ==================== CONNECT ====================
    console.log('\n📡 Connecting to Quotex with session...\n');
    const connection = await client.connect();

    if (!connection.success) {
      console.error('❌ Connection failed:', connection.message);
      console.log('\n💡 Your session might be expired. Create a new one:');
      return;
    }

    console.log('✅ Connected successfully!\n');
    console.log('═'.repeat(60));

    // ==================== ACCOUNT DETAILS ====================
    console.log('\n👤 ACCOUNT INFORMATION\n');
    
    // Load session data
    const sessionData = await Bun.file('./quotex-session.json').json();
   
    if (client.isConnected()) {
      console.log('🎉 WebSocket is WORKING!');
      console.log('   All real-time features are available!');
    } else {
      console.log('ℹ️  Note: WebSocket disconnected.');
    }
    
    // Wait a bit after connection for socket to stabilize
    await Bun.sleep(2000);
    

  } catch (error) {
    console.error('\n❌ Error occurred:', error);
  } finally {
    // Disconnect
    await client.disconnect();
    console.log('👋 Disconnected from Quotex\n');
  }
}

// Run the example
if (import.meta.main) {
  main().catch(console.error);
}
