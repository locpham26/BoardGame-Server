const express = require("express");
const chalk = require("chalk");
const cors = require("cors");
const http = require("http");

const app = express();
const server = http.createServer(app);
app.use(cors());

require("./startup/logging")();
require("./startup/routes")(app);
require("./startup/socketio")(server);
require("./startup/db")();
require("./startup/config");
require("./startup/validation");

let port = 3001;
server.listen(port, () =>
  console.log(chalk.yellow(`Listening on port ${port}...`))
);
