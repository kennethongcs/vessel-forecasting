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
// custom middleware to verify hash DOING add to helper function file
const checkAuth = (req, res, next) => {
  // set the default value
  req.isUserLoggedIn = false;

  // check to see if the cookies you need exists
  if (req.cookies.loggedIn && req.cookies.userId) {
    // get the hased value that should be inside the cookie
    const hash = getHash(req.cookies.userId);

    // test the value of the cookie
    if (req.cookies.loggedIn === hash) {
      req.isUserLoggedIn = true;
    }
  }

  next();
};

app.listen(3004);

// index page
app.get('/', (req, res) => {
  res.render('main');
});

// login page
app.get('/login', (req, res) => {
  // if user already logged in, redirect to index '/'
  res.render('login');
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
        res.send('Logged in.');
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
  // res.send(
  //   'Successfully logged out, Click <a href="/">here</a> to head back to the homepage'
  // );
  res.render('logout');
});
