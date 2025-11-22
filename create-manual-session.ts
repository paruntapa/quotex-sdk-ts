/**
 * Manual Session Creator
 * 
 * Use this when automated browser login is blocked by CloudFlare.
 * 
 * Instructions:
 * 1. Open https://qxbroker.com/en/sign-in/ in your regular browser
 * 2. Login manually
 * 3. Open DevTools (F12)
 * 4. Run this script to extract session info:
 * 
 * Copy and paste this in the browser console:
 * ───────────────────────────────────────────────────────────
 * 
 * copy(JSON.stringify({
 *   token: window.settings?.token || null,
 *   cookies: document.cookie,
 *   userAgent: navigator.userAgent,
 *   timestamp: Date.now()
 * }, null, 2))
 * 
 * ───────────────────────────────────────────────────────────
 * 
 * 5. The session JSON is now in your clipboard
 * 6. Run this script: bun run create-manual-session.ts
 * 7. Paste the JSON when prompted
 */

import { writeFile } from 'fs/promises';
import { join } from 'path';

const SESSION_FILE = join(process.cwd(), 'quotex-session.json');

console.log(`
════════════════════════════════════════════════════════════════
        📝 MANUAL SESSION CREATOR
════════════════════════════════════════════════════════════════

CloudFlare is blocking automated login. Let's create a manual session!

🔧 STEP 1: Login in your real browser
   1. Open: https://qxbroker.com/en/sign-in/
   2. Login with your credentials
   3. Wait until you see the trading page

🔧 STEP 2: Extract session data
   1. Open DevTools (Press F12)
   2. Go to Console tab
   3. Copy and paste this code:

   ───────────────────────────────────────────────────────────
   copy(JSON.stringify({
     token: window.settings?.token || null,
     cookies: document.cookie,
     userAgent: navigator.userAgent,
     timestamp: Date.now()
   }, null, 2))
   ───────────────────────────────────────────────────────────

   4. Press Enter
   5. The session JSON is now in your clipboard!

🔧 STEP 3: Save the session
   Paste the JSON below (then press Enter twice):

`);

// Read from stdin
const stdin = process.stdin;
const chunks: string[] = [];

stdin.setEncoding('utf8');

stdin.on('data', (chunk) => {
  chunks.push(chunk as any);
});

stdin.on('end', async () => {
  const input = chunks.join('');
  
  try {
    const session = JSON.parse(input.trim());
    
    // Validate session
    if (!session.token && !session.cookies) {
      console.error('❌ Error: Session must have either token or cookies');
      process.exit(1);
    }
    
    // Save to file
    await writeFile(SESSION_FILE, JSON.stringify(session, null, 2));
    
    console.log(`
✅ SUCCESS! Session saved to: ${SESSION_FILE}

📊 Session Info:
   - Token: ${session.token ? '✓ Present' : '✗ Missing'}
   - Cookies: ${session.cookies ? '✓ Present' : '✗ Missing'}
   - User Agent: ${session.userAgent ? '✓ Present' : '✗ Missing'}
   - Timestamp: ${new Date(session.timestamp).toLocaleString()}

🚀 NEXT STEP: Run the SDK
   The SDK will automatically use this session:
   
   bun run index.ts

   The session is valid for a few days, then you'll need to create a new one.

════════════════════════════════════════════════════════════════
`);
    
  } catch (error) {
    console.error('\n❌ Error parsing JSON:', error);
    console.error('\nMake sure you:');
    console.error('1. Copied the ENTIRE output from the browser console');
    console.error('2. Pasted it correctly');
    console.error('3. The JSON is valid\n');
    process.exit(1);
  }
});

// Trigger end after timeout or Ctrl+D
console.log('(Press Ctrl+D when done pasting)\n');

// If run non-interactively, show help
if (!process.stdin.isTTY) {
  console.log('⚠️  This script needs to be run interactively');
  console.log('   Run: bun run create-manual-session.ts');
  process.exit(1);
}

