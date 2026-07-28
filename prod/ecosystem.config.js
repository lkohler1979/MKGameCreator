module.exports = {
  apps: [
    {
      name: "mkgamecreator-api",
      cwd: "/var/www/mkgamecreator/backend",
      script: "dist/server.js",
      // Node 20.6+ carrega o .env nativamente antes de iniciar o script -
      // o backend nao tem dotenv nas dependencias, entao isso substitui.
      node_args: "--env-file=.env",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "mkgamecreator-frontend",
      cwd: "/var/www/mkgamecreator/frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3001",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
