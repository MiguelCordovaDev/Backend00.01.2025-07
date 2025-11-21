const db = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = db.user;
const Role = db.role;

exports.signup = async (req, res) => {
  try {
    const { username, email, password, roles } = req.body;

    const newUser = new User({
      username,
      email,
      password: bcrypt.hashSync(password, 8),
    });

    let assignedRoles;

    if (roles) {
      assignedRoles = await Role.find({ name: { $in: roles } });
    } else {
      const userRole = await Role.findOne({ name: "user" });
      assignedRoles = [userRole];
    }

    newUser.roles = assignedRoles.map((r) => r._id);
    await newUser.save();

    res.send({ message: "Usuario creado correctamente" });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.signin = async (req, res) => {
  try {
    const user = await User.findOne({
      username: req.body.username,
    }).populate("roles");

    if (!user) {
      return res.status(404).send({ message: "Usuario no encontrado" });
    }

    const passwordValid = bcrypt.compareSync(req.body.password, user.password);

    if (!passwordValid) {
      return res.status(401).send({ message: "Contraseña incorrecta" });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    req.session.token = token;

    res.status(200).send({
      id: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles.map((r) => r.name),
      accessToken: token,
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.signout = (req, res) => {
  req.session = null;
  res.status(200).send({ message: "Sesión cerrada correctamente" });
};
