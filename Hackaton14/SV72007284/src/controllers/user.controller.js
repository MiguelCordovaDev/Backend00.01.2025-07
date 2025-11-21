const db = require("../models");
const User = db.user;

exports.allAccess = (req, res) => {
  res.status(200).send("Contenido público");
};

exports.onlyUser = async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).send({ message: "Usuario no encontrado" });

  res.status(200).send(`Contenido del usuario ${user.username}`);
};

exports.onlyModerator = (req, res) => {
  res.status(200).send("Contenido exclusivo de moderador");
};

exports.onlyAdmin = (req, res) => {
  res.status(200).send("Contenido exclusivo de administrador");
};
