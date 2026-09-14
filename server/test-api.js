// Quick API test — run with: node test-api.js
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testHealth() {
  console.log('\n=== Testing /api/health ===');
  const res = await fetch(`${BASE_URL}/api/health`);
  console.log('Status:', res.status);
  console.log('Body:', await res.json());
}

async function testAdminLogin() {
  console.log('\n=== Testing /adminlogin ===');
  const res = await fetch(`${BASE_URL}/adminlogin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'gymnasium', password: 'usbv7173' }),
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Body:', data);
  return data.idToken;
}

async function testGetClients(token) {
  console.log('\n=== Testing /api/clients (with token) ===');
  const res = await fetch(`${BASE_URL}/api/clients`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Count:', Array.isArray(data) ? data.length : 'error');
  console.log('Body (first 500 chars):', JSON.stringify(data).slice(0, 500));
}

async function run() {
  try {
    await testHealth();
    const token = await testAdminLogin();
    if (token) await testGetClients(token);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

run();
