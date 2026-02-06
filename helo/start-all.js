const { spawn } = require('child_process');
const path = require('path');

function run(name, command, args, cwd) {
  const process = spawn(command, args, { cwd, stdio: 'inherit', shell: true });
  process.on('error', (err) => console.error(`[${name}] Error:`, err));
  return process;
}

console.log('🚀 Starting AfroConnect Services...');

// 1. Backend on 3001
run('BACKEND', 'node', ['server.js'], path.join(__dirname, 'backend'));

// 2. Gateway on 5000
run('GATEWAY', 'node', ['gateway.js'], __dirname);

// 3. Expo Web on 3002
run('EXPO', 'CI=1 EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0 NODE_OPTIONS=--max-old-space-size=512 npx', ['expo', 'start', '--port', '3002'], __dirname);

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  process.exit();
});
