module.exports = {
  apps: [
    {
      name: "Zypher-MD",
      script: "index.js",
      watch: false,
      autorestart: true,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 9090
      }
    },
    {
      name: "Call-Bridge",
      script: "live-call-bridge.js",
      watch: false,
      autorestart: true,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        CALL_PORT: 3000
      }
    }
  ]
};

