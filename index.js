/* eslint-disable spaced-comment */
import express, { urlencoded } from 'express';
import pg from 'pg';
import methodOverride from 'method-override';
import cookieParser from 'cookie-parser';
import jsSHA from 'jssha';
import multer from 'multer';
import { getHash, getHashSalted } from './helper_functions.js';

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

const port = 3004;

app.listen(port, () => {
  console.log(`Server is up, listening on port ${port}.`);
});

// index page DOING
app.get('/', (req, res) => {
  // if user is not logged in redirect to login page
  if (!req.isUserLoggedIn) {
    res.render('loginForm');
    return;
  }
  // if user is logged in, redirect to index
  if (req.isUserLoggedIn) {
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
  // check if user is logged in
  if (!req.isUserLoggedIn) {
    res.render('loginForm');
    return;
  }
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

/////////////////
// ADMIN PANEL //
/////////////////

////////////
// voyage //
////////////
// GET shows admin panel
app.get('/admin', (req, res) => {
  // verify if user has super user rights
  if (req.user.super_user) {
    // show admin ejs
    res.render('admin');
  } else {
    res.redirect('/');
  }
});
// GET shows form to create new vessel / voyage
// GET shows current vessels in DB DOING
app.get('/voyage-creation', (req, res) => {
  // verify if user has super user rights
  if (req.user.super_user) {
    let data;
    // show admin ejs
    const vesselNameQuery = 'SELECT * FROM vessel_name';
    pool
      .query(vesselNameQuery)
      .then((result) => {
        // add all vessel name into obj
        data = {
          name: result.rows,
        };
        const vesselVoyageQuery =
          'SELECT vessel_voyage.id, vessel_name.id AS vessel_name_id, vessel_name.vessel_name, vessel_voyage.voyage_number FROM vessel_name INNER JOIN vessel_voyage ON vessel_name.id = vessel_voyage.vessel_name';
        return pool.query(vesselVoyageQuery);
      })
      .then((result) => {
        // add all vessel voy into obj
        data.voyage = result.rows;
        res.render('voyage-creation-form', { data });
      })
      .catch((err) => {
        console.log('Error getting voyage:', err);
        res.status(500).send('Server error.');
      });
  } else {
    res.redirect('/');
  }
});
// POST for vessel-voyage-creation form
// adds new voyage into DB
app.post('/voyage-creation', (req, res) => {
  // retrieve data from form input
  const data = req.body;
  // convert text to upper case
  data.vessel_name = data.vessel_name.toUpperCase();
  const formData = [data.vessel_name, data.voyage_number];
  // query to add data into vessel_voyage table
  const voyageAddQuery =
    'INSERT INTO vessel_voyage(vessel_name, voyage_number) VALUES($1, $2)';
  pool
    .query(voyageAddQuery, formData)
    .then((result) => {
      console.log('Added voyage successfully');
      res.redirect('back');
    })
    .catch((err) => {
      console.log('Posting error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});
// GET for vessel-voyage-creation
// edit voyage
app.get('/voyage-creation/:id/edit', (req, res) => {
  if (req.user.super_user) {
    const { id } = req.params;
    const input = [id];
    const vesselVoyageQuery =
      'SELECT vessel_voyage.id, vessel_name.id AS vessel_name_id, vessel_name.vessel_name, vessel_voyage.voyage_number FROM vessel_name INNER JOIN vessel_voyage ON vessel_name.id = vessel_voyage.vessel_name WHERE vessel_voyage.id=$1';
    pool
      .query(vesselVoyageQuery, input)
      .then((result) => {
        const data = result.rows[0];
        res.render('voyage-creation-edit', { data });
      })
      .catch((err) => {
        console.log('Error: ', err);
        res.status(500).send('Server error. Please check with administrator.');
      });
  } else {
    res.redirect('/');
  }
});
// PUT for vessel-voyage-creation
app.put('/voyage-creation/:id/', (req, res) => {
  const { id } = req.params;
  const input = [req.body.voyage_number, id];
  // trim white spaces from input
  const trimInput = input.map((x) => {
    return x.trim();
  });
  const updateQuery = 'UPDATE vessel_voyage SET voyage_number=$1 WHERE id=$2';
  pool
    .query(updateQuery, trimInput)
    .then(() => {
      console.log('Successfully updated.');
      res.redirect('/voyage-creation');
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});
// DEL for vessel-voyage-creation
app.delete('/voyage-creation/:id', (req, res) => {
  const { id } = req.params;
  const input = [id];
  const delQuery = 'DELETE from vessel_voyage WHERE id=$1';
  pool
    .query(delQuery, input)
    .then(() => {
      console.log('Voyage deleted successfully.');
      res.redirect('back');
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});

////////////
// vessel //
////////////

app.get('/vessel-creation', (req, res) => {
  // check if admin
  if (req.user.super_user) {
    const vesselsQuery = 'SELECT * FROM vessel_name';
    pool
      .query(vesselsQuery)
      .then((result) => {
        const data = result.rows;
        res.render('vessel-creation-form', { data });
      })
      .catch((err) => {
        console.log('Error: ', err);
        res.status(500).send('Server error. Please check with administrator.');
      });
  } else {
    res.redirect('/');
  }
});
app.post('/vessel-creation', (req, res) => {
  const input = [req.body.vessel_name, req.body.teu, req.body.tons];
  const inputTrim = input.map((x) => {
    return x.toUpperCase().trim();
  });
  const vesselCreationQuery =
    'INSERT INTO vessel_name(vessel_name, teu, tons) VALUES($1,$2,$3)';
  pool
    .query(vesselCreationQuery, inputTrim)
    .then(() => {
      console.log('Vessel name successfully added.');
      res.redirect('back');
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});
app.get('/vessel-creation/:id/edit', (req, res) => {
  if (req.user.super_user) {
    const { id } = req.params;
    const input = [id];
    const vesselQuery = 'SELECT * FROM vessel_name WHERE id=$1';
    pool
      .query(vesselQuery, input)
      .then((result) => {
        const data = result.rows[0];
        res.render('vessel-creation-edit', { data });
      })
      .catch((err) => {
        console.log('Error: ', err);
        res.status(500).send('Server error. Please check with administrator.');
      });
  } else {
    res.redirect('/');
  }
});
app.put('/vessel-creation/:id', (req, res) => {
  const { id } = req.params;
  const input = [req.body.vessel_name, req.body.teu, req.body.tons, id];
  const inputTrim = input.map((x) => {
    return x.toUpperCase().trim();
  });
  console.log(inputTrim);
  const vesselEditQuery =
    'UPDATE vessel_name SET vessel_name=$1, teu=$2, tons=$3 WHERE id=$4';
  pool
    .query(vesselEditQuery, inputTrim)
    .then(() => {
      console.log('Vessel name / teu / tons updated successfully.');
      res.redirect('/vessel-creation');
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});
app.delete('/vessel-creation/:id', (req, res) => {
  const { id } = req.params;
  const input = [id];
  const delQuery = 'DELETE FROM vessel_name WHERE id=$1';
  pool
    .query(delQuery, input)
    .then(() => {
      console.log('Vessel successfully deleted.');
      res.redirect('/vessel-creation');
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});

//////////
// port //
//////////
app.get('/port-creation', (req, res) => {
  // check if admin
  if (req.user.super_user) {
    const portQuery = 'SELECT * FROM port_name';
    pool
      .query(portQuery)
      .then((result) => {
        const data = result.rows;
        res.render('port-creation-form', { data });
      })
      .catch((err) => {
        console.log('Error: ', err);
        res.status(500).send('Server error. Please check with administrator.');
      });
  } else {
    res.redirect('/');
  }
});
app.post('/port-creation', (req, res) => {
  const input = [req.body.port_name, req.body.port_code];
  const inputEdit = input.map((x) => {
    return x.toUpperCase().trim();
  });
  const insertQuery =
    'INSERT INTO port_name(port_name, port_code) VALUES($1, $2)';
  pool
    .query(insertQuery, inputEdit)
    .then(() => {
      console.log('Port name / code inserted successfully.');
      res.redirect('/port-creation');
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});
app.get('/port-creation/:id/edit', (req, res) => {
  const { id } = req.params;
  const input = [id];
  const portEditQuery = 'SELECT * FROM port_name WHERE id=$1';
  pool
    .query(portEditQuery, input)
    .then((result) => {
      const data = result.rows[0];
      res.render('port-creation-edit', { data });
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});
app.put('/port-creation/:id', (req, res) => {
  const { id } = req.params;
  const input = [req.body.port_name, req.body.port_code, id];
  const inputEdit = input.map((x) => {
    return x.toUpperCase().trim();
  });
  const updateQuery =
    'UPDATE port_name SET port_name=$1, port_code=$2 WHERE id=$3';

  pool
    .query(updateQuery, inputEdit)
    .then(() => {
      console.log('Port name / code updated successfully.');
      res.redirect('/port-creation');
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});
app.delete('/port-creation/:id', (req, res) => {
  const { id } = req.params;
  const input = [id];
  const deleteQuery = 'DELETE FROM port_name WHERE id=$1';
  pool
    .query(deleteQuery, input)
    .then(() => {
      console.log('Port name / code deleted successfully.');
      res.redirect('/port-creation');
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});

/////////////
// service //
/////////////
app.get('/service-creation', (req, res) => {
  // check if admin
  if (req.user.super_user) {
    const serviceQuery = 'SELECT * FROM service_name';
    pool
      .query(serviceQuery)
      .then((result) => {
        const data = result.rows;
        res.render('service-creation-form', { data });
      })
      .catch((err) => {
        console.log('Error: ', err);
        res.status(500).send('Server error. Please check with administrator.');
      });
  } else {
    res.redirect('/');
  }
});
app.post('/service-creation', (req, res) => {
  const input = [req.body.service_name];
  const inputEdit = input.map((x) => {
    return x.toUpperCase().trim();
  });
  const insertQuery = 'INSERT INTO service_name(service_name) VALUES($1)';
  pool
    .query(insertQuery, inputEdit)
    .then(() => {
      console.log('Service name inserted successfully.');
      res.redirect('/service-creation');
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});
app.get('/service-creation/:id/edit', (req, res) => {
  const { id } = req.params;
  const input = [id];
  const serviceEditQuery = 'SELECT * FROM service_name WHERE id=$1';
  pool
    .query(serviceEditQuery, input)
    .then((result) => {
      const data = result.rows[0];
      res.render('service-creation-edit', { data });
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});
app.put('/service-creation/:id', (req, res) => {
  const { id } = req.params;
  const input = [req.body.service_name, id];
  const inputEdit = input.map((x) => {
    return x.toUpperCase().trim();
  });
  const updateQuery = 'UPDATE service_name SET service_name=$1 WHERE id=$2';
  pool
    .query(updateQuery, inputEdit)
    .then(() => {
      console.log('Service name updated successfully.');
      res.redirect('/service-creation');
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});
app.delete('/service-creation/:id', (req, res) => {
  const { id } = req.params;
  const input = [id];
  const deleteQuery = 'DELETE FROM service_name WHERE id=$1';
  pool
    .query(deleteQuery, input)
    .then(() => {
      console.log('Service name deleted successfully.');
      res.redirect('/service-creation');
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});
