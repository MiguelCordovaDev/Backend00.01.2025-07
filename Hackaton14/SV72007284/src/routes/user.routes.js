const { authJwt } = require("../middlewares");
const controller = require("../controllers/user.controller");

module.exports = (app) => {
  app.get("/api/test/all", controller.allAccess);

  app.get("/api/test/user", [authJwt.verifyToken], controller.onlyUser);

  app.get(
    "/api/test/moderator",
    [authJwt.verifyToken, authJwt.isModerator],
    controller.onlyModerator
  );

  app.get(
    "/api/test/admin",
    [authJwt.verifyToken, authJwt.isAdmin],
    controller.onlyAdmin
  );
};
