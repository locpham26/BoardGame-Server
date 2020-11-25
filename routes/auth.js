const express = require("express");
const _ = require("lodash");
const bcrypt = require("bcrypt");
const Joi = require("joi");
const router = express.Router();
const { User } = require("../models/user");

router.post("/", async (req, res) => {
  const { error } = validate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  let user = await User.findOne({ name: req.body.name });
  if (!user) return res.status(400).send("Invalid name or password");

  const validPassword = await bcrypt.compare(req.body.password, user.password);
  if (!validPassword) return res.status(400).send("Invalid email or password");

  const token = user.generateAuthToken();

  res.send(token);
});

function validate(req) {
  const schema = Joi.object({
    name: Joi.string().required(),
    password: Joi.string().min(6).max(1024).required(),
  });

  return schema.validate(req);
}

module.exports = router;
