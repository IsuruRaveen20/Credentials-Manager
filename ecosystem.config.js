// PM2 process definitions for the native (no-Docker) EC2 deployment described in
// docs/ec2-deploy-alongside-hearmee.md. Not used by local Docker dev — the dev
// containers run `pnpm ... dev` directly and never invoke PM2 or this file.
//
// Paths below assume the repo is cloned to ~/WebMee-Credentials-Manager-VaultOps
// on the server. If you ever clone to a different path, update `cwd` / `env_file`
// / `script` here to match — nothing else in the repo reads this file.
module.exports = {
  apps: [
    {
      name: "vaultops-api",
      script: "dist/main.js",
      cwd: "/home/ubuntu/WebMee-Credentials-Manager-VaultOps/apps/api",
      env_file: "/home/ubuntu/WebMee-Credentials-Manager-VaultOps/.env",
      env: { NODE_ENV: "production", PORT: "4001" },
      instances: 1,
      autorestart: true,
      watch: false,
      // Conservative cap — see docs/ec2-deploy-alongside-hearmee.md §9 (memory budget).
      max_memory_restart: "200M",
    },
    {
      name: "vaultops-web",
      script: "apps/web/.next/standalone/apps/web/server.js",
      cwd: "/home/ubuntu/WebMee-Credentials-Manager-VaultOps",
      env: { NODE_ENV: "production", PORT: "4000", HOSTNAME: "0.0.0.0" },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "200M",
    },
  ],
};
