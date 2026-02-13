import { QuotexClient } from './src';
import { existsSync } from 'fs';
import { AssetManager } from './src/features/assets/AssetManager';

async function main() {
  console.log('🚀 Quotex SDK - Account & API Test\n');

  const sessionFile = './quotex-session.json';
  if (!existsSync(sessionFile)) {
    console.error('❌ Error: quotex-session.json not found!');
    console.log('\n📝 Create a session first:');
    console.log('1. Run: bun run create-session');
    console.log('2. Or read: CLOUDFLARE_WORKAROUND.md\n');
    process.exit(1);
  }

  const config = {
    email: process.env.QUOTEX_EMAIL ||'session-user',
    password: process.env.QUOTEX_PASSWORD || 'session-pass',
    lang: (process.env.QUOTEX_LANG || 'en') as 'en' | 'pt' | 'es',
    debug: process.env.DEBUG === 'true',
  };

  const client = new QuotexClient(config);

  try {
    console.log('\n📡 Connecting to Quotex with session...\n');
    const connection = await client.connect();
    if (!connection.success) {
      console.error('❌ Connection failed:', connection.message);
      console.log('\n💡 Your session might be expired. Create a new one:');
      return;
    }

    console.log('✅ Connected successfully!\n');
    console.log('═'.repeat(60));

    await Bun.file('./quotex-session.json').json();
   
    if (client.isConnected()) {
      console.log('🎉 WebSocket is WORKING!');
      console.log('   All real-time features are available!');
    } else {
      console.log('ℹ️  Note: WebSocket disconnected.');
    }

    
    await Bun.sleep(2000);
    

  } catch (error) {
    console.error('\n❌ Error occurred:', error);
  } finally {
    await client.disconnect();
    console.log('👋 Disconnected from Quotex\n');
  }
}

if (import.meta.main) {
  main().catch(console.error);
}
