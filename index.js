import express, { urlencoded } from 'express';
import pg from 'pg';
import methodOverride from 'method-override';
import cookieParser from 'cookie-parser';
import jsSHA from 'jssha';
import multer from 'multer';

const pgConnectionConfigs = {
  user: 'kennethongcs',
  host: 'localhost',
  database: 'vessel-forecasting',
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

app.listen(3004);

// index page
app.get('/', (req, res) => {
  res.render('main');
});

// login page
app.get('/login', (req, res) => {
  res.render('login');
});
