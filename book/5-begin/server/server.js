const express = require('express');
const session = require('express-session');
const mongoSessionStore = require('connect-mongo');
const next = require('next');
const mongoose = require('mongoose');

const setupGoogle = require('./google');
const api = require('./api');
const { insertTemplates } = require('./models/EmailTemplate');

require('dotenv').config();

const dev = process.env.NODE_ENV !== 'production';
const MONGO_URL = process.env.MONGO_URL_TEST;

const options = {
  useNewUrlParser: true,
  useCreateIndex: true,
  useFindAndModify: false,
  useUnifiedTopology: true,
};
mongoose.connect(MONGO_URL, options);

const port = process.env.PORT || 8000;
const ROOT_URL = `http://localhost:${port}`;

const URL_MAP = {
  '/login': '/public/login',
  '/my-books': '/customer/my-books',
};

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const server = express();

  const MongoStore = mongoSessionStore(session);
  const sess = {
    name: process.env.SESSION_NAME,
    secret: process.env.SESSION_SECRET,
    store: new MongoStore({
      mongooseConnection: mongoose.connection,
      ttl: 14 * 24 * 60 * 60, // save session 14 days
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 14 * 24 * 60 * 60 * 1000, // expires in 14 days
      domain: 'localhost',
    },
  };

  server.use(session(sess));

  await insertTemplates();

  setupGoogle({ server, ROOT_URL });
  api(server);

  server.get('/books/:bookSlug/:chapterSlug', (req, res) => {
    const { bookSlug, chapterSlug } = req.params;
    app.render(req, res, '/public/read-chapter', { bookSlug, chapterSlug });
  });

  server.get('*', (req, res) => {
    const url = URL_MAP[req.path];
    if (url) {
      app.render(req, res, url);
    } else {
      handle(req, res);
    }
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on ${ROOT_URL}`);
  });
});
