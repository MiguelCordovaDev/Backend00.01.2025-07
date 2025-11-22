require('dotenv').config();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { UserModel } = require('./database/db');

function firstEnv(keys, fallback) {
  for (const k of keys) {
    const v = process.env[k];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return fallback;
}
function mask(v, keepStart = 6, keepEnd = 4) {
  if (!v) return '(empty)';
  if (v.length <= keepStart + keepEnd) return v;
  return v.slice(0, keepStart) + '...' + v.slice(-keepEnd);
}

const GOOGLE_CLIENT_ID = firstEnv(['GOOGLE_CLIENT_ID', 'CLIENTID']);
const GOOGLE_CLIENT_SECRET = firstEnv(['GOOGLE_CLIENT_SECRET', 'SECRETID']);
const GOOGLE_CALLBACK_URL = firstEnv(['GOOGLE_CALLBACK_URL', 'CALLBACKURL'], 'http://localhost:3000/google/callback');

if (!GOOGLE_CLIENT_ID) {
  console.error('Falta GOOGLE_CLIENT_ID o CLIENTID en .env');
  process.exit(1);
}
if (!GOOGLE_CLIENT_SECRET) {
  console.error('Falta GOOGLE_CLIENT_SECRET o SECRETID en .env');
  process.exit(1);
}
if (!GOOGLE_CALLBACK_URL) {
  console.error('Falta GOOGLE_CALLBACK_URL o CALLBACKURL en .env');
  process.exit(1);
}

console.log(`[OAuth] Google clientID=${mask(GOOGLE_CLIENT_ID)} callback=${GOOGLE_CALLBACK_URL}`);

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await UserModel.findById(id);
    done(null, user);
  } catch (e) {
    done(e);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const user = await UserModel.findOrCreateFromGoogle(profile);
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

module.exports = passport;