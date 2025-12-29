const path = require('path');
const { Service } = require('node-windows');

// Absolute path to your main server file (adjust if different)
const scriptPath = path.join(__dirname, '..', 'server.js');

console.log("script path",scriptPath)
// Create a new service object
const svc = new Service({
  name: 'MyNodeBackendService',
  description: 'Runs the Node.js backend continuously as a Windows service',
  script: scriptPath,
  nodeOptions: [
    '--max_old_space_size=512' // Optional: set memory limit
  ]
});

// Event handlers (optional but useful for logs)
svc.on('install', () => {
  console.log('Service installed');
  svc.start();
});

svc.on('alreadyinstalled', () => {
  console.log('Service is already installed.');
});

svc.on('start', () => {
  console.log('Service started successfully.');
});

svc.on('error', err => {
  console.error('Service error:', err);
});

// Install the service
svc.install();