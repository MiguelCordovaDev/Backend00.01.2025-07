const express = require('express');
const router = express.Router();
const passport = require('../passport');

router.get('/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    const u = req.user;
    return res.json({
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      email: u.email,
      avatar: u.avatar_url,
      role: u.role
    });
  }
  return res.status(401).json({ error: 'No autenticado' });
});

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Nota: el callback real se mapea en server.js a /google/callback para respetar el valor dado en .env
router.post('/logout', (req, res) => {
  req.logout(err => {
    if (err) return res.status(500).json({ error: 'Error al cerrar sesión' });
    req.session.destroy(() => {
      res.clearCookie('curier_session');
      res.json({ message: 'Sesión cerrada' });
    });
  });
});

module.exports = router;