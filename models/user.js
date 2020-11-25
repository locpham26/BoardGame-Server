const Joi = require("joi");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const config = require("config");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    maxlength: 50,
  },
  email: {
    type: String,
    required: true,
    minlength: 5,
    maxlength: 255,
    unique: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    maxlength: 1024,
  },
});

userSchema.methods.generateAuthToken = function () {
  const token = jwt.sign({ name: this.name }, config.get("jwtPrivateKey"));
  return token;
};

const User = mongoose.model("User", userSchema);

function validateUser(user) {
  const schema = Joi.object({
    name: Joi.string().max(50).required(),
    email: Joi.string().max(255).min(5).required().email(),
    password: Joi.string().min(6).max(1024).required(),
  });
  return schema.validate(user);
}

exports.User = User;
exports.validateUser = validateUser;
