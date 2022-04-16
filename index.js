/* eslint-disable spaced-comment */
import express, { urlencoded } from 'express';
import pg from 'pg';
import methodOverride from 'method-override';
import cookieParser from 'cookie-parser';
import jsSHA from 'jssha';
import multer from 'multer';
import axios from 'axios';
import moment from 'moment';
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
  app.locals.user = req.user;
  next();
});

const port = 3004;

app.listen(port, () => {
  console.log(`Server is up, listening on port ${port}.`);
});

///////////
// index // DOING
///////////

app.get('/', (req, res) => {
  // if user is not logged in redirect to login page
  if (!req.isUserLoggedIn) {
    res.render('loginForm');
    return;
  }
  // if user is logged in, redirect to index
  if (req.isUserLoggedIn) {
    const userData = req.user;
    let vesselAllocation = {};
    const data = {};
    const balLoadingsQuery = 'SELECT * FROM vessel_alloc_at_port';
    pool.query(balLoadingsQuery).then((result) => {
      const data = result.rows;
      vesselAllocation = { data };
    });
    if (req.user.super_user) {
      const scheduleQuery =
        'SELECT vessel_schedule.id, vessel_name.id AS vessel_name_id ,vessel_name.vessel_name, vessel_voyage.id AS voyage_number_id, vessel_voyage.voyage_number, service_name.service_name, port_name.port_code, vessel_schedule.eta, vessel_schedule.etd FROM vessel_schedule INNER JOIN vessel_name ON vessel_schedule.vessel_name = vessel_name.id INNER JOIN vessel_voyage ON vessel_schedule.voyage_number = vessel_voyage.id INNER JOIN service_name ON vessel_schedule.service_name = service_name.id INNER JOIN port_name ON vessel_schedule.port_name = port_name.id';
      pool
        .query(scheduleQuery)
        .then((result) => {
          data.schedule = result.rows;
          const balanceAtPortQuery =
            'SELECT loadings.vessel_name, loadings.voyage_number, loadings.pol, vessel_alloc_at_port.teu AS teu_alloc, vessel_alloc_at_port.tons AS tons_alloc, loadings.amt_of_containers, loadings.container_tonnage FROM loadings INNER JOIN vessel_alloc_at_port ON loadings.pol = vessel_alloc_at_port.port_name AND loadings.vessel_name = vessel_alloc_at_port.vessel_name';
          return pool.query(balanceAtPortQuery);
        })
        .then((result) => {
          const loadData = result.rows;
          const reduce = Array.from(
            // take out amt_of_containers key
            loadData
              .reduce((acc, { amt_of_containers, container_tonnage, ...r }) => {
                const key = JSON.stringify(r);
                const current = acc.get(key) || {
                  ...r,
                  amt_of_containers: 0,
                  container_tonnage: 0,
                };
                return acc.set(key, {
                  ...current,
                  amt_of_containers:
                    current.amt_of_containers + amt_of_containers,
                  container_tonnage:
                    current.container_tonnage + container_tonnage,
                });
              }, new Map())
              .values()
          );
          data.balanceLoadings = reduce;
          // convert db date using moment
          Object.values(data.schedule).forEach((x) => {
            x.eta = moment(x.eta).format('DD/MMM/YY');
            x.etd = moment(x.etd).format('DD/MMM/YY');
          });
          res.render('index', { userData, data });
        });
    } else {
      // if not super user, then only show vessels that has that country's port code
      const originCountry = [userData.origin_country];
      const data = {};
      const scheduleQuery =
        'SELECT vessel_schedule.id, vessel_name.id AS vessel_name_id ,vessel_name.vessel_name, vessel_voyage.id AS voyage_number_id, vessel_voyage.voyage_number, service_name.service_name, port_name.port_code, country.id AS country_id, vessel_schedule.eta, vessel_schedule.etd FROM vessel_schedule INNER JOIN vessel_name ON vessel_schedule.vessel_name = vessel_name.id INNER JOIN vessel_voyage ON vessel_schedule.voyage_number = vessel_voyage.id INNER JOIN service_name ON vessel_schedule.service_name = service_name.id INNER JOIN port_name ON vessel_schedule.port_name = port_name.id INNER JOIN country ON country.id = port_name.origin_country WHERE country.id = $1';
      pool
        .query(scheduleQuery, originCountry)
        .then((result) => {
          data.schedule = result.rows;
          const balanceAtPortQuery =
            'SELECT loadings.vessel_name, loadings.voyage_number, loadings.pol, vessel_alloc_at_port.teu AS teu_alloc, vessel_alloc_at_port.tons AS tons_alloc, loadings.amt_of_containers, loadings.container_tonnage FROM loadings INNER JOIN vessel_alloc_at_port ON loadings.pol = vessel_alloc_at_port.port_name AND loadings.vessel_name = vessel_alloc_at_port.vessel_name';
          return pool.query(balanceAtPortQuery);
        })
        .then((result) => {
          const loadData = result.rows;
          const reduce = Array.from(
            // take out amt_of_containers key
            loadData
              .reduce((acc, { amt_of_containers, container_tonnage, ...r }) => {
                const key = JSON.stringify(r);
                const current = acc.get(key) || {
                  ...r,
                  amt_of_containers: 0,
                  container_tonnage: 0,
                };
                return acc.set(key, {
                  ...current,
                  amt_of_containers:
                    current.amt_of_containers + amt_of_containers,
                  container_tonnage:
                    current.container_tonnage + container_tonnage,
                });
              }, new Map())
              .values()
          );
          data.balanceLoadings = reduce;
          // convert db date using moment
          Object.values(data.schedule).forEach((x) => {
            x.eta = moment(x.eta).format('DD/MMM/YY');
            x.etd = moment(x.etd).format('DD/MMM/YY');
          });
          res.render('index', { userData, data });
        });
    }
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

////////////
// voyage //
////////////
// GET shows form to create new vessel / voyage
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

////////////////
// allocation //
////////////////
app.get('/allocation-creation', (req, res) => {
  // check if admin
  if (req.user.super_user) {
    const allQueryObj = {};
    const countryQuery = 'SELECT * FROM country';
    pool
      .query(countryQuery)
      .then((result) => {
        allQueryObj.country = result.rows;
        const serviceQuery = 'SELECT * FROM service_name';
        return pool.query(serviceQuery);
      })
      .then((result) => {
        allQueryObj.service = result.rows;
        const vesselQuery = 'SELECT * FROM vessel_name';
        return pool.query(vesselQuery);
      })
      .then((result) => {
        allQueryObj.vessel = result.rows;
        const portQuery = 'SELECT * FROM port_name';
        return pool.query(portQuery);
      })
      .then((result) => {
        allQueryObj.port = result.rows;
        const allocQuery =
          'SELECT vessel_alloc_at_port.id, service_name.service_name, port_name.port_code, country.country_name, vessel_name.vessel_name, vessel_alloc_at_port.teu, vessel_alloc_at_port.tons FROM vessel_alloc_at_port INNER JOIN service_name ON vessel_alloc_at_port.service_name = service_name.id INNER JOIN port_name ON vessel_alloc_at_port.port_name = port_name.id INNER JOIN country ON vessel_alloc_at_port.country_name = country.id INNER JOIN vessel_name ON vessel_alloc_at_port.vessel_name = vessel_name.id';
        return pool.query(allocQuery);
      })
      .then((result) => {
        const data = result.rows;
        res.render('allocation-creation-form', { allQueryObj, data });
      })
      .catch((err) => {
        console.log('Error: ', err);
        res.status(500).send('Server error. Please check with administrator.');
      });
  } else {
    res.redirect('/');
  }
});
app.post('/allocation-creation', (req, res) => {
  const input = [
    req.body.service_name,
    req.body.port_name,
    req.body.country_name,
    req.body.vessel_name,
    req.body.teu,
    req.body.tons,
  ];
  const inputEdit = input.map((x) => {
    return x.toUpperCase().trim();
  });
  const insertQuery =
    'INSERT INTO vessel_alloc_at_port(service_name, port_name, country_name, vessel_name, teu, tons) VALUES($1, $2, $3, $4, $5, $6)';
  pool
    .query(insertQuery, inputEdit)
    .then(() => {
      console.log('Service name inserted successfully.');
      res.redirect('/allocation-creation');
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});
app.get('/allocation-creation/:id/edit', (req, res) => {
  const { id } = req.params;
  const input = [id];
  const allQueryObj = {};
  const countryQuery = 'SELECT * FROM country';
  pool
    .query(countryQuery)
    .then((result) => {
      allQueryObj.country = result.rows;
      const serviceQuery = 'SELECT * FROM service_name';
      return pool.query(serviceQuery);
    })
    .then((result) => {
      allQueryObj.service = result.rows;
      const vesselQuery = 'SELECT * FROM vessel_name';
      return pool.query(vesselQuery);
    })
    .then((result) => {
      allQueryObj.vessel = result.rows;
      const portQuery = 'SELECT * FROM port_name';
      return pool.query(portQuery);
    })
    .then((result) => {
      allQueryObj.port = result.rows;
      const allocQuery =
        'SELECT vessel_alloc_at_port.id, service_name.service_name, port_name.port_code, country.country_name, vessel_name.vessel_name, vessel_alloc_at_port.teu, vessel_alloc_at_port.tons FROM vessel_alloc_at_port INNER JOIN service_name ON vessel_alloc_at_port.service_name = service_name.id INNER JOIN port_name ON vessel_alloc_at_port.port_name = port_name.id INNER JOIN country ON vessel_alloc_at_port.country_name = country.id INNER JOIN vessel_name ON vessel_alloc_at_port.vessel_name = vessel_name.id';
      return pool.query(allocQuery);
    })
    .then((result) => {
      const data = result.rows[0];
      res.render('allocation-creation-edit', { allQueryObj, data });
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});
app.put('/allocation-creation/:id', (req, res) => {
  const { id } = req.params;
  const input = [
    req.body.service_name,
    req.body.port_name,
    req.body.country_name,
    req.body.vessel_name,
    req.body.teu,
    req.body.tons,
    id,
  ];
  const inputEdit = input.map((x) => {
    return x.toUpperCase().trim();
  });
  const updateQuery =
    'UPDATE vessel_alloc_at_port SET service_name=$1, port_name=$2, country_name=$3, vessel_name=$4, teu=$5, tons=$6 WHERE id=$7';
  pool
    .query(updateQuery, inputEdit)
    .then(() => {
      console.log('Allocation updated successfully.');
      res.redirect('/allocation-creation');
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});
app.delete('/allocation-creation/:id', (req, res) => {
  const { id } = req.params;
  const input = [id];
  const deleteQuery = 'DELETE FROM vessel_alloc_at_port WHERE id=$1';
  pool
    .query(deleteQuery, input)
    .then(() => {
      console.log('Allocation deleted successfully.');
      res.redirect('/allocation-creation');
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});

//////////////
// schedule //
//////////////
// GET shows available vessels
app.get('/vessels-selection', (req, res) => {
  // check if user is logged in
  if (req.isUserLoggedIn) {
    if (req.user.super_user) {
      // query list of vessels
      const queryVessels = 'SELECT * FROM vessel_name';
      pool
        .query(queryVessels)
        .then((result) => {
          const data = result.rows;
          res.render('vessel-list-selection', { data });
        })
        .catch((err) => {
          console.log('Vessel get error: ', err);
          res.status(500).send('Please contact administrator');
        });
    } else {
      res.redirect('/');
    }
  } else {
    res.redirect('/');
  }
});
app.get('/schedule-creation/:id', (req, res) => {
  // check if admin
  if (req.user.super_user) {
    // select vessel to add schedule
    const allQueryObj = {};
    const input = [req.params.id];
    const voyageQuery =
      'SELECT vessel_voyage.vessel_name AS vessel_name_id, vessel_name.vessel_name, vessel_voyage.id AS vessel_voyage_id,vessel_voyage.voyage_number,  vessel_name.teu, vessel_name.tons FROM vessel_voyage INNER JOIN vessel_name ON vessel_voyage.vessel_name = vessel_name.id WHERE vessel_voyage.vessel_name = $1';
    pool
      .query(voyageQuery, input)
      .then((result) => {
        allQueryObj.voyage = result.rows;
        const serviceQuery = 'SELECT * FROM service_name';
        return pool.query(serviceQuery);
      })
      .then((result) => {
        allQueryObj.service = result.rows;
        const vesselQuery = 'SELECT * FROM vessel_name';
        return pool.query(vesselQuery);
      })
      .then((result) => {
        allQueryObj.vessel = result.rows;
        const portQuery = 'SELECT * FROM port_name';
        return pool.query(portQuery);
      })
      .then((result) => {
        allQueryObj.port = result.rows;
        const scheduleQuery =
          'SELECT vessel_schedule.id, vessel_name.id AS vessel_name_id ,vessel_name.vessel_name, vessel_voyage.voyage_number, service_name.service_name, port_name.port_code, vessel_schedule.eta, vessel_schedule.etd FROM vessel_schedule INNER JOIN vessel_name ON vessel_schedule.vessel_name = vessel_name.id INNER JOIN vessel_voyage ON vessel_schedule.voyage_number = vessel_voyage.id INNER JOIN service_name ON vessel_schedule.service_name = service_name.id INNER JOIN port_name ON vessel_schedule.port_name = port_name.id WHERE vessel_name.id=$1';
        return pool.query(scheduleQuery, input);
      })
      .then((result) => {
        const data = result.rows;
        // use moment to convert date
        Object.values(data).forEach((x) => {
          x.eta = moment(x.eta).format('DD/MMM/YY');
          x.etd = moment(x.etd).format('DD/MMM/YY');
        });
        res.render('schedule-creation-form', { allQueryObj, data });
      })
      .catch((err) => {
        console.log('Error: ', err);
        res.status(500).send('Server error. Please check with administrator.');
      });
  } else {
    res.redirect('/');
  }
});
app.post('/schedule-creation', (req, res) => {
  const input = [
    req.body.vessel_name,
    req.body.voyage_number,
    req.body.service_name,
    req.body.port_code,
    req.body.eta,
    req.body.etd,
  ];
  const insertQuery =
    'INSERT INTO vessel_schedule(vessel_name, voyage_number, service_name, port_name, eta, etd) VALUES($1, $2, $3, $4, $5, $6)';
  pool
    .query(insertQuery, input)
    .then(() => {
      console.log('Schedule inserted successfully.');
      res.redirect('/vessels-selection');
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});
app.get('/schedule-creation/:id/edit', (req, res) => {
  const { id } = req.params;
  const input = [id];
  const serviceEditQuery =
    'SELECT vessel_schedule.id, vessel_name.id AS vessel_name_id ,vessel_name.vessel_name, vessel_voyage.voyage_number, service_name.service_name, port_name.port_code, vessel_schedule.eta, vessel_schedule.etd FROM vessel_schedule INNER JOIN vessel_name ON vessel_schedule.vessel_name = vessel_name.id INNER JOIN vessel_voyage ON vessel_schedule.voyage_number = vessel_voyage.id INNER JOIN service_name ON vessel_schedule.service_name = service_name.id INNER JOIN port_name ON vessel_schedule.port_name = port_name.id WHERE vessel_schedule.id = $1';
  pool
    .query(serviceEditQuery, input)
    .then((result) => {
      const data = result.rows;
      Object.values(data).forEach((x) => {
        x.eta = moment(x.eta).format('YYYY-MM-DD');
        x.etd = moment(x.etd).format('YYYY-MM-DD');
      });
      res.render('schedule-creation-edit', { data });
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});
app.put('/schedule-creation/:id', (req, res) => {
  const { id } = req.params;
  const input = [req.body.eta, req.body.etd, id];
  const inputEdit = input.map((x) => {
    return x.toUpperCase().trim();
  });
  const updateQuery = 'UPDATE vessel_schedule SET eta=$1, etd=$2 WHERE id=$3';
  pool
    .query(updateQuery, inputEdit)
    .then(() => {
      console.log('Schedule updated successfully.');
      res.redirect('/vessels-selection');
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});
app.delete('/schedule-creation/:id', (req, res) => {
  const { id } = req.params;
  const input = [id];
  const deleteQuery = 'DELETE FROM vessel_schedule WHERE id=$1';
  pool
    .query(deleteQuery, input)
    .then(() => {
      console.log('Schedule deleted successfully.');
      res.redirect('/vessels-selection');
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});

//////////////
// customer //
//////////////
// for user to view
app.get('/customer-list', (req, res) => {
  if (req.isUserLoggedIn) {
    const customerQuery = 'SELECT * FROM customers';
    pool
      .query(customerQuery)
      .then((result) => {
        const data = result.rows;
        res.render('customer-creation-form-user', { data });
      })
      .catch((err) => {
        console.log('Error: ', err);
        res.status(500).send('Server error. Please check with administrator.');
      });
  } else {
    res.redirect('/');
  }
});
// for admin to view
app.get('/customer-creation', (req, res) => {
  // check if admin
  if (req.user.super_user) {
    const customerQuery = 'SELECT * FROM customers';
    pool
      .query(customerQuery)
      .then((result) => {
        const data = result.rows;
        res.render('customer-creation-form-admin', { data });
      })
      .catch((err) => {
        console.log('Error: ', err);
        res.status(500).send('Server error. Please check with administrator.');
      });
  } else {
    res.redirect('/');
  }
});
app.post('/customer-creation', (req, res) => {
  const input = [req.body.customer_name, req.body.op_code];
  const inputEdit = input.map((x) => {
    return x.toUpperCase().trim();
  });
  const insertQuery =
    'INSERT INTO customers(customer_name, op_code) VALUES($1, $2)';
  pool
    .query(insertQuery, inputEdit)
    .then(() => {
      console.log('Customer inserted successfully.');
      res.redirect('back');
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});
app.get('/customer-creation/:id/edit', (req, res) => {
  const { id } = req.params;
  const input = [id];
  const customerEditQuery = 'SELECT * FROM customers WHERE id=$1';
  pool
    .query(customerEditQuery, input)
    .then((result) => {
      const data = result.rows[0];
      res.render('customer-creation-edit', { data });
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});
app.put('/service-creation/:id', (req, res) => {
  const { id } = req.params;
  const input = [req.body.customer_name, req.body.op_code, id];
  const inputEdit = input.map((x) => {
    return x.toUpperCase().trim();
  });
  const updateQuery =
    'UPDATE customers SET customer_name=$1, op_code=$2 WHERE id=$3';
  pool
    .query(updateQuery, inputEdit)
    .then(() => {
      console.log('Customer updated successfully.');
      res.redirect('/customer-creation');
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});
app.delete('/customer-creation/:id', (req, res) => {
  const { id } = req.params;
  const input = [id];
  const deleteQuery = 'DELETE FROM customers WHERE id=$1';
  pool
    .query(deleteQuery, input)
    .then(() => {
      console.log('Customer deleted successfully.');
      res.redirect('/customer-creation');
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});

//////////////
// Loadings //
//////////////
app.get('/loadings-creation/:id', (req, res) => {
  if (req.isUserLoggedIn) {
    const userData = req.user;
    // check if admin
    if (req.user.super_user) {
      const data = {};
      const insert = [req.params.id];
      const scheduleQuery =
        'SELECT vessel_schedule.id, vessel_name.id AS vessel_name_id ,vessel_name.vessel_name, vessel_voyage.id AS voyage_number_id, vessel_voyage.voyage_number, service_name.service_name, port_name.id AS port_id, port_name.port_code, vessel_schedule.eta, vessel_schedule.etd FROM vessel_schedule INNER JOIN vessel_name ON vessel_schedule.vessel_name = vessel_name.id INNER JOIN vessel_voyage ON vessel_schedule.voyage_number = vessel_voyage.id INNER JOIN service_name ON vessel_schedule.service_name = service_name.id INNER JOIN port_name ON vessel_schedule.port_name = port_name.id WHERE vessel_voyage.id = $1';
      pool
        .query(scheduleQuery, insert)
        .then((result) => {
          data.scheduleData = result.rows[0];
          const customerListQuery = 'SELECT * FROM customers';
          return pool.query(customerListQuery);
        })
        .then((result) => {
          data.customerData = result.rows;
          const containerSizes = 'SELECT * FROM container_sizes';
          return pool.query(containerSizes);
        })
        .then((result) => {
          data.containerSizes = result.rows;
          const containerTypes = 'SELECT * FROM container_types';
          return pool.query(containerTypes);
        })
        .then((result) => {
          data.containerTypes = result.rows;
          const insert = [req.params.id];
          const loadingsQuery =
            'SELECT loadings.voyage_number, loadings.id, customers.op_code, container_sizes.size, container_types.type, loadings.amt_of_containers, loadings.container_tonnage, port_name.port_code AS pod FROM loadings INNER JOIN customers ON loadings.customer_name = customers.id INNER JOIN vessel_name ON loadings.vessel_name = vessel_name.id INNER JOIN vessel_voyage ON loadings.voyage_number = vessel_voyage.id INNER JOIN container_sizes ON loadings.container_size = container_sizes.id INNER JOIN container_types ON loadings.container_type = container_types.id INNER JOIN port_name ON loadings.pod = port_name.id WHERE loadings.voyage_number = $1';
          return pool.query(loadingsQuery, insert);
        })
        .then((result) => {
          data.loadings = result.rows;
          const portQuery = 'SELECT * FROM port_name';
          return pool.query(portQuery);
        })
        .then((result) => {
          data.port = result.rows;
          // console.log(data);
          res.render('loadings-creation-form', {
            data,
            userData,
          });
        })
        .catch((err) => {
          console.log('Error: ', err);
          res
            .status(500)
            .send('Server error. Please check with administrator.');
        });
    } else {
      // if not admin but logged in DOING
      const data = {};
      const insert = [req.params.id];
      const scheduleQuery =
        'SELECT vessel_schedule.id, vessel_name.id AS vessel_name_id ,vessel_name.vessel_name, vessel_voyage.id AS voyage_number_id, vessel_voyage.voyage_number, service_name.service_name, port_name.id AS port_id, port_name.port_code, vessel_schedule.eta, vessel_schedule.etd, port_name.origin_country FROM vessel_schedule INNER JOIN vessel_name ON vessel_schedule.vessel_name = vessel_name.id INNER JOIN vessel_voyage ON vessel_schedule.voyage_number = vessel_voyage.id INNER JOIN service_name ON vessel_schedule.service_name = service_name.id INNER JOIN port_name ON vessel_schedule.port_name = port_name.id WHERE vessel_voyage.id = $1';
      pool
        .query(scheduleQuery, insert)
        .then((result) => {
          data.scheduleData = result.rows[0];
          if (req.user.origin_country !== data.scheduleData.origin_country) {
            // BUG
            res.redirect('/');
            // return
          }
          const customerListQuery = 'SELECT * FROM customers';
          return pool.query(customerListQuery);
        })
        .then((result) => {
          data.customerData = result.rows;
          const containerSizes = 'SELECT * FROM container_sizes';
          return pool.query(containerSizes);
        })
        .then((result) => {
          data.containerSizes = result.rows;
          const containerTypes = 'SELECT * FROM container_types';
          return pool.query(containerTypes);
        })
        .then((result) => {
          data.containerTypes = result.rows;
          const loadingsQuery =
            'SELECT loadings.id, customers.op_code, container_sizes.size, container_types.type, loadings.amt_of_containers, loadings.container_tonnage, port_name.port_code AS pod FROM loadings INNER JOIN customers ON loadings.customer_name = customers.id INNER JOIN vessel_name ON loadings.vessel_name = vessel_name.id INNER JOIN vessel_voyage ON loadings.voyage_number = vessel_voyage.id INNER JOIN container_sizes ON loadings.container_size = container_sizes.id INNER JOIN container_types ON loadings.container_type = container_types.id INNER JOIN port_name ON loadings.pod = port_name.id';
          return pool.query(loadingsQuery);
        })
        .then((result) => {
          data.loadings = result.rows;
          const portQuery = 'SELECT * FROM port_name';
          return pool.query(portQuery);
        })
        .then((result) => {
          data.port = result.rows;
          // console.log(data);
          res.render('loadings-creation-form', {
            data,
            userData,
          });
        })
        .catch((err) => {
          console.log('Error: ', err);
          res
            .status(500)
            .send('Server error. Please check with administrator.');
        });
    }
  } else {
    res.redirect('/');
  }
});
app.post('/loadings-creation', (req, res) => {
  // input into loading_
  const input = [
    req.body.customer_name,
    req.body.vessel_name,
    req.body.vessel_voyage,
    req.body.user_name,
    req.body.container_size,
    req.body.container_type,
    req.body.amt_of_containers,
    req.body.container_tonnage,
    req.body.pol,
    req.body.pod,
  ];
  const inputEdit = input.map((x) => {
    return x.toUpperCase().trim();
  });
  const insertQuery =
    'INSERT INTO loadings(customer_name, vessel_name, voyage_number, user_name, container_size, container_type, amt_of_containers, container_tonnage, pol, pod) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)';
  pool
    .query(insertQuery, inputEdit)
    .then(() => {
      console.log('Loadings inserted successfully.');
      res.redirect('back');
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Server error. Please check with administrator.');
    });
});
