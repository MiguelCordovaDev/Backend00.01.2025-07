const db = require("../models");
const ROLES = db.ROLES;
const User = db.user;

exports.checkDuplicateUsernameOrEmail = async (req, res, next) => {
  try {
    const { username, email } = req.body;

    if (await User.findOne({ username })) {
      return res.status(400).send({ message: "El username ya existe" });
    }

    if (await User.findOne({ email })) {
      return res.status(400).send({ message: "El email ya existe" });
    }

    next();
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.checkRoleExisted = (req, res, next) => {
  if (req.body.roles) {
    for (const role of req.body.roles) {
      if (!ROLES.includes(role)) {
        return res.status(400).send({
          message: `El rol '${role}' no es válido`,
        });
      }
    }
  }

  next();
};
