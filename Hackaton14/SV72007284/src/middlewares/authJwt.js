const db = require("../models");
const jwt = require("jsonwebtoken");

const User = db.user;
const Role = db.role;

exports.verifyToken = (req, res, next) => {
  const token = req.session?.token;

  if (!token) {
    return res.status(401).send({ message: "Token no proporcionado" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).send({ message: "Token inválido" });

    req.userId = decoded.id;
    next();
  });
};

exports.isModerator = async (req, res, next) => {
  const user = await User.findById(req.userId);
  const roles = await Role.find({ _id: { $in: user.roles } });

  if (roles.some((r) => r.name === "moderator")) return next();

  res.status(403).send({ message: "Requiere Rol Moderador" });
};

exports.isAdmin = async (req, res, next) => {
  const user = await User.findById(req.userId);
  const roles = await Role.find({ _id: { $in: user.roles } });

  if (roles.some((r) => r.name === "admin")) return next();

  res.status(403).send({ message: "Requiere Rol Admin" });
};
