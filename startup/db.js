const mongoose = require("mongoose");
const chalk = require("chalk");

module.exports = function () {
  mongoose
    .connect("mongodb://localhost/SimpleWerewolf", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
    })
    .then(() => console.log(chalk.yellow("Connecting to MongoDB")));
};
