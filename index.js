import express, { urlencoded } from 'express';
import pg from 'pg';
import methodOverride from 'method-override';
import cookieParser from 'cookie-parser';
import jsSHA from 'jssha';
import multer from 'multer';
import { getHash } from './helper_functions.js';
import { getHashSalted } from './helper_functions.js';

const pgConnectionConfigs = {
  user: 'kennethongcs',
  host: 'localhost',
  database: 'vessel_forecast',
  port: 5432,
};

const { Pool } = pg;
const pool = new Pool(pgConnectionConfigs);
const app = express();

// to use ejs
app.set('view engine', 'ejs');
// to use 'public' folder
app.use(express.static('public'));
// to use req.body for retrieving form data
app.use(urlencoded({ extended: false }));
// to use DEL or PUT
app.use(methodOverride('_method'));
// to parse cooking string from req into an obj
app.use(cookieParser());
// set the name of the upload directory here
const multerUpload = multer({ dest: 'uploads/' });

// check if user is logged in and passes it into a cookie
app.use((req, res, next) => {
  // set the default value
  req.isUserLoggedIn = false;

  // check to see if the cookies you need exists
  if (req.cookies.userId && req.cookies.sessionId) {
    // get the hased value that should be inside the cookie
    const hash = getHashSalted(req.cookies.userId);

    // test the value of the cookie
    if (req.cookies.sessionId === hash) {
      req.isUserLoggedIn = true;

      // look for this user in the database
      const values = [req.cookies.userId];

      // try to get the user
      pool.query(
        'SELECT * FROM accounts WHERE user_name=$1',
        values,
        (error, result) => {
          if (error || result.rows.length < 1) {
            res.status(503).send('Check with admin');
            return;
          }
          // set the user as a key in the req object so that it's accessible in the route
          req.user = result.rows[0];
          // remove password from user
          delete req.user.password;
          next();
        }
      );
      // make sure we don't get down to the next() below
      return;
    }
  }
  next();
});
// set 'user' so it can be retrieved in every view
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

app.listen(3004);

// index page DOING
app.get('/', (req, res) => {
  // check if user is logged in, else redirect to login page
  if (!req.isUserLoggedIn) {
    res.redirect('login');
    return;
  }
  // check if user is a super user
  if (req.user.super_user === 1) {
    const userData = req.user;
    res.render('index', userData);
  }
});

// login page
app.get('/login', (req, res) => {
  // if user already logged in, redirect to index '/'
  res.render('loginForm');

  // TODO
  // if not logged in then show this page, else don't show login button and redirect from login page
});

// post for login
app.post('/login', (req, res) => {
  // retrieve password
  const { password } = req.body;
  // retrieve username
  const input = [req.body.username];
  // hash password
  const hashedPassword = getHash(password);
  const queryPassword = 'SELECT * FROM accounts WHERE user_name = $1';
  pool
    .query(queryPassword, input)
    .then((result) => {
      const passwordDB = result.rows[0].password;
      // check if form pw is the same as stored pw
      const userId = result.rows[0].user_name;
      if (passwordDB === hashedPassword) {
        // if password is same, add a cookie for userID and hashed session
        res.cookie('userId', userId);
        // hash session ID
        const saltedUserId = getHashSalted(userId);
        res.cookie('sessionId', saltedUserId);
        res.render('login-transfer-page');
        console.log(`Logged in user: ${userId}`);
      } else {
        res.status(403).send('Sorry user/pass is wrong.');
      }
    })
    .catch((err) => {
      console.log('User id/pass retrieval error: ', err);
      res.status(500).send('Server error');
    });
});

// logout
app.get('/logout', (req, res) => {
  res.clearCookie('userId');
  res.clearCookie('sessionId');
  res.render('logout');
});

// GET shows available vessels
app.get('/vessels', (req, res) => {
  // query list of vessels
  const queryVessels = 'SELECT * FROM vessel_name';
  pool
    .query(queryVessels)
    .then((result) => {
      const data = result.rows;
      res.render('vessel-list', { data });
    })
    .catch((err) => {
      console.log('Vessel get error: ', err);
      res.status(500).send('Please contact administrator');
    });
});

// GET shows vessel and form to input vessel's voyage
app.get('/vessel-voyage', (req, res) => {
  //
});
