require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const passport = require('./passport');
const { testConnection, ensureSchema, PackageModel, LocationModel, MessageModel } = require('./database/db');
const authRoutes = require('./routes/auth.routes');
const packageRoutes = require('./routes/package.routes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean) || '*',
    credentials: true
  }
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean) || '*',
  credentials: true
}));
app.use(compression());
app.use(morgan('dev'));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionStore = new MySQLStore({
  host: process.env.MYSQLHOST,
  port: process.env.MYSQLPORT || 3306,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASS,
  database: process.env.MYSQLBBDD,
  createDatabaseTable: true,
  clearExpired: true,
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: 24 * 60 * 60 * 1000
});

const sessionMiddleware = session({
  key: 'curier_session',
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
});

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, 'public')));

// Rutas API
app.use('/auth', authRoutes);
app.use('/api/packages', packageRoutes);

// Callback Google dinámico según .env
const oauthCallbackUrl = (process.env.GOOGLE_CALLBACK_URL || process.env.CALLBACKURL || 'http://localhost:3000/google/callback').trim();
let callbackPath = '/google/callback';
try {
  callbackPath = new URL(oauthCallbackUrl).pathname || '/google/callback';
} catch {
  callbackPath = '/google/callback';
}
console.log(`[OAuth] Ruta de callback registrada: ${callbackPath}`);

app.get(callbackPath,
  passport.authenticate('google', { failureRedirect: '/login.html' }),
  (_req, res) => res.redirect('/')
);

// Vistas
app.get('/', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.sendFile(path.join(__dirname, 'public', 'tracking.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Compartir sesión con Socket.io
io.use((socket, next) => sessionMiddleware(socket.request, {}, next));

// Autenticación en sockets
io.use((socket, next) => {
  const sess = socket.request.session;
  if (sess?.passport?.user) return next();
  next(new Error('No autenticado'));
});

// Eventos Socket.io
io.on('connection', (socket) => {
  const userId = socket.request.session.passport.user;
  socket.data.userId = userId;

  socket.on('track:join', (tracking) => {
    socket.join(`package:${tracking}`);
  });

  socket.on('track:leave', (tracking) => {
    socket.leave(`package:${tracking}`);
  });

  socket.on('location:update', async (data) => {
    try {
      const { tracking, latitude, longitude, location_name, description, status } = data;
      const pkg = await PackageModel.findByTracking(tracking);
      if (!pkg) return socket.emit('error', { message: 'Paquete no encontrado' });
      if (pkg.courier_id !== userId) return socket.emit('error', { message: 'No autorizado' });

      await LocationModel.add(pkg.id, { latitude, longitude, location_name, description, status });
      io.to(`package:${tracking}`).emit('location:updated', {
        tracking, latitude, longitude, location_name, description, status, timestamp: new Date()
      });
    } catch (e) {
      console.error('socket location:update error:', e);
      socket.emit('error', { message: 'Error actualizando ubicación' });
    }
  });

  socket.on('message:send', async ({ tracking, message }) => {
    try {
      const pkg = await PackageModel.findByTracking(tracking);
      if (!pkg) return socket.emit('error', { message: 'Paquete no encontrado' });

      const receiverId = (pkg.courier_id === userId) ? pkg.sender_id : pkg.courier_id;
      const id = await MessageModel.create({
        package_id: pkg.id,
        sender_id: userId,
        receiver_id: receiverId,
        message,
        type: 'chat'
      });

      io.to(`package:${tracking}`).emit('message:received', {
        id, tracking, sender_id: userId, message, timestamp: new Date()
      });
    } catch (e) {
      console.error('socket message:send error:', e);
      socket.emit('error', { message: 'Error enviando mensaje' });
    }
  });

  socket.on('disconnect', () => {});
});

// Manejo de errores
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: process.env.NODE_ENV === 'production' ? 'Error interno' : err.message });
});

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await testConnection();
    await ensureSchema(); // <- crea tablas si faltan
    server.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (e) {
    console.error('❌ No se pudo iniciar el servidor', e);
    process.exit(1);
  }
}

start();

module.exports = { app, io };