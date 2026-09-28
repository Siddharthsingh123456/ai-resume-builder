const authApp = require("./api/auth.js");

module.exports = {
  plugins: [
    {
      name: "local-auth-api",
      configureServer(server) {
        server.middlewares.use(authApp);
      },
    },
  ],
};