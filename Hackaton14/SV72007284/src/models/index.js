const mongoose = require("mongoose");
mongoose.Promise = global.Promise;

const db = {};

db.mongoose = mongoose;
db.user = require("./user.model");
db.role = require("./role.model");

db.ROLES = ["admin", "moderator", "user"];

db.init = async () => {
  try {
    const count = await db.role.estimatedDocumentCount();
    if (count === 0) {
      await new db.role({ name: "user" }).save();
      await new db.role({ name: "moderator" }).save();
      await new db.role({ name: "admin" }).save();

      console.log("✔ Roles creados correctamente");
    }
  } catch (err) {
    console.log("Error inicializando roles:", err);
  }
};

module.exports = db;
