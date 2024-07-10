const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const QRCode = require('qrcode');
const bodyParser = require('body-parser');
const { UserModel, Cashier, Employee, TicketPrice, SystemSettings } = require('./models/UserAndCashier'); // Adjust the path as necessary

const app = express();
const port = 7000;
const router = express.Router();

const dbUrl = 'mongodb+srv://ibrvevv:B2zuySIQVuVndUDr@cluster0.em9iau7.mongodb.net/mydatabase?retryWrites=true&w=majority&appName=Cluster0';


router.get('/api/system-settings', async (req, res) => {
  try {
    const settings = await SystemSettings.findOne({});
    res.json(settings);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Update system settings
router.post('/api/system-settings', async (req, res) => {
  try {
    const { paymentSystemEnabled, modelEnabled, testPeriodEnabled } = req.body;
    const settings = await SystemSettings.findOneAndUpdate({}, {
      paymentSystemEnabled,
      modelEnabled,
      testPeriodEnabled
    }, { new: true, upsert: true });
    res.json(settings);
  } catch (err) {
    res.status(500).send(err);
  }
});

module.exports = router;

router.post('/admin/set-price', async (req, res) => {
    const { city, price } = req.body;

    try {
        let ticketPrice = await TicketPrice.findOne({ city });
        if (ticketPrice) {
            ticketPrice.price = price;
        } else {
            ticketPrice = new TicketPrice({ city, price });
        }
        await ticketPrice.save();
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка при установке цены' });
    }
});

router.get('/cashier/price/:city', async (req, res) => {
    const { city } = req.params;
    try {
        const ticketPrice = await TicketPrice.findOne({ city });
        if (ticketPrice) {
            res.json({ success: true, price: ticketPrice.price });
        } else {
            res.json({ success: false, message: 'Цена не найдена' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка при получении цены' });
    }
});

module.exports = router;

// Получить цену для конкретного города
router.get('/price/:city', async (req, res) => {
  const city = req.params.city;
  try {
    const price = await TicketPrice.findOne({ city });
    if (price) {
      res.json({ success: true, price: price.price });
    } else {
      res.json({ success: false, message: 'Price not found' });
    }
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});
app.post('/admin/set-price', async (req, res) => {
  const { city, price } = req.body;
  try {
    const updatedPrice = await TicketPrice.findOneAndUpdate(
      { city: city },
      { price: price },
      { new: true, upsert: true }
    );
    res.json({ success: true, price: updatedPrice.price });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Получить цену для всех городов
router.get('/prices', async (req, res) => {
  try {
    const prices = await TicketPrice.find({});
    res.json({ success: true, prices });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});
app.get('/cashier/price/:city', async (req, res) => {
  try {
      const city = req.params.city;
      const ticketPrice = await TicketPrice.findOne({ city: city });
      if (ticketPrice) {
          res.json({ success: true, price: ticketPrice.price });
      } else {
          res.status(404).json({ success: false, message: 'City not found' });
      }
  } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
// Обновить цену для конкретного города
router.post('/prices', async (req, res) => {
  const { city, price } = req.body;
  try {
    const existingPrice = await TicketPrice.findOne({ city });
    if (existingPrice) {
      existingPrice.price = price;
      await existingPrice.save();
    } else {
      const newPrice = new TicketPrice({ city, price });
      await newPrice.save();
    }
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

module.exports = router;
// Настройка хранилища для загружаемых файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

// Инициализация multer с использованием настроек хранилища
const upload = multer({ storage: storage });

const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/img', express.static(path.join(__dirname, 'views', 'img')));

app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Note: set secure: true in production with HTTPS
}));

mongoose.connect(dbUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000,
})
.then(async () => {
  console.log('Connected to MongoDB Atlas');
  
  try {
    const existingAdmin = await UserModel.findOne({ username: 'admin' });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('Admin123', 10); // Replace with your secure password
      const adminUser = new UserModel({
        username: 'admin',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'admin'
      });
      await adminUser.save();
      console.log('Admin user created');
    }

    // Check if Cashier collection exists, create if it doesn't
    const collections = await mongoose.connection.db.listCollections().toArray();
    if (!collections.some(coll => coll.name === 'cashiers')) {
      await mongoose.connection.createCollection('cashiers');
      console.log('Cashier collection created');
    }
  } catch (error) {
    console.error('Error connecting or creating Cashier collection:', error);
  }
})
.catch((err) => {
  console.error('Connection error', err);
});
app.use(express.json());
// Signup route
app.get('/signup', (req, res) => {
  res.render('signup', { error: null });
});

const CitySchema = new mongoose.Schema({
  name: String,
  ticketPrice: Number
});

const City = mongoose.model('City', CitySchema);

app.post('/admin/prices', async (req, res) => {
  const { city, price } = req.body;

  try {
      // Example logic to update price in database
      const updatedPrice = await PriceModel.findOneAndUpdate(
          { city: city },
          { price: price },
          { new: true }
      );

      if (updatedPrice) {
          res.json({ success: true, message: 'Цена успешно обновлена', updatedPrice });
      } else {
          res.status(404).json({ success: false, message: 'Не удалось найти город для обновления цены' });
      }
  } catch (error) {
      console.error('Ошибка при обновлении цены:', error.message);
      res.status(500).json({ success: false, message: 'Ошибка при обновлении цены' });
  }
});

app.get('/admin/prices', async (req, res) => {
  try {
      // Fetch prices from your database or another source
      const prices = await TicketPrice.find(); // Assuming TicketPrice is your Mongoose model
      res.json({ success: true, prices });
  } catch (err) {
      console.error('Error fetching prices:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch prices' });
  }
});

// Example route to handle fetching city data
app.get('/api/city/:name', async (req, res) => {
  const cityName = req.params.name;
  try {
    // Fetch city data from MongoDB
    const city = await City.findOne({ name: cityName });
    if (city) {
      res.json({ ticketPrice: city.ticketPrice });
    } else {
      res.status(404).json({ error: 'City not found' });
    }
  } catch (error) {
    console.error('Error fetching city:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Example route to handle updating city data
app.put('/api/city/:name', async (req, res) => {
  const cityName = req.params.name;
  const { ticketPrice } = req.body;
  try {
    // Update city data in MongoDB
    const updatedCity = await City.findOneAndUpdate(
      { name: cityName },
      { ticketPrice },
      { new: true }
    );
    if (updatedCity) {
      res.json({ ticketPrice: updatedCity.ticketPrice });
    } else {
      res.status(404).json({ error: 'City not found' });
    }
  } catch (error) {
    console.error('Error updating city:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.post('/signup', async (req, res) => {
  const { username, email, password, role, city } = req.body;

  try {
    const existingUser = await UserModel.findOne({ username });
    if (existingUser) {
      return res.render('signup', { error: 'Пользователь с таким именем уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new UserModel({
      username: username,
      email: email,
      password: hashedPassword,
      role: role || 'cashier', // Default role is cashier
      city: city 
    });

    await newUser.save();

    req.session.user = newUser;

    if (role === 'admin') {
        res.redirect('/admin');
    } else if (user.role === 'cashier') {
      const { city } = req.session.user;
            if (city === 'Бухара') {
                res.redirect('/cashierbuhara');
            } else {
                if (city === 'Самарканд') {
                    res.redirect('/cashiersamarkand');
                } else {
                    if (city === 'Хива') {
                        res.redirect('/cashierhiva');
                    }
                    else {
                      res.redirect('/');
                    } 
                }
            }
    } else {
      res.redirect('/');
    }
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).send('Error registering user: ' + error.message);
  }
});

app.use(bodyParser.json());



// Define Payment schema
const paymentSchema = new mongoose.Schema({
  description: String,
  id: String,
  cardNumber: String,
  dateTime: String,
  amount: String,
  receipt: String
});
// Create Payment model
const Payment = mongoose.model('Payment', paymentSchema);

// Route to get payment history
app.get('/get-payments', async (req, res) => {
  try {
      const payments = await Payment.find();
      res.json({ success: true, payments });
  } catch (err) {
      res.json({ success: false, message: err.message });
  }
});

// Route to add a payment
app.post('/add-payment', async (req, res) => {
  const { description, cardNumber, amount, dateTime, receipt } = req.body;
  const payment = new Payment({
      description,
      id: `#${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
      cardNumber,
      dateTime,
      amount,
      receipt
  });
  try {
      await payment.save();
      res.json({ success: true });
  } catch (err) {
      res.json({ success: false, message: err.message });
  }
});

app.get('/', (req, res) => {
  const cities = [
    {
      id: 'buhara',
      name: 'Бухара',
      organizations: ['Organization 1', 'Organization 2', 'Organization 3'],
      department: ['логист', 'Психолог', 'Инженер'],
      position: ['Водитель', 'Программист', 'Учитель']
    },
    {
      id: 'samarkand',
      name: 'Самарканд',
      organizations: ['Organization 1', 'Organization 2', 'Organization 3'],
      department: ['логист', 'Психолог', 'Инженер'],
      position: ['Водитель', 'Программист', 'Учитель']
    },
    {
      id: 'hiva',
      name: 'Хива',
      organizations: ['Organization 1', 'Organization 2', 'Organization 3'],
      department: ['логист', 'Психолог', 'Инженер'],
      position: ['Водитель', 'Программист', 'Учитель']
    },
  ];

  const organizations = [
    { name: 'Organization 1' },
    { name: 'Organization 2' },
    { name: 'Organization 3' }
  ];

  const departments = [
    { name: 'логист' },
    { name: 'Психолог' },
    { name: 'Инженер' }
  ];

  const positions = [
    { name: 'Водитель' },
    { name: 'Программист' },
    { name: 'Учитель' }
  ];

  res.render('index', { cities, organizations, departments, positions });
});

app.get('/cashierbuhara', (req, res) => {
  res.render('cashierbuhara', { error: null });
});
app.get('/cashierhiva', (req, res) => {
  res.render('cashierhiva', { error: null });
});
app.get('/cashiersamarkand', (req, res) => {
  res.render('cashiersamarkand', { error: null });
});
// Login route
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await UserModel.findOne({ username });
    if (!user) {
      console.log('User not found');
      return res.render('login', { error: 'Неверные учетные данные' });
    }

    if (user.role !== 'admin' && user.role !== 'cashier') {
      console.log('Invalid role:', user.role);
      return res.render('login', { error: 'Неверные учетные данные' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      console.log('Password does not match');
      return res.render('login', { error: 'Неверные учетные данные' });
    }

    req.session.user = {
      username: user.username,
      role: user.role,
      city: user.city
    };

    if (user.role === 'admin') {
      res.redirect('/admin');
    } else if (user.role === 'cashier') {
      const { city } = req.session.user;
      if (city === 'Бухара') {
          res.redirect('/cashierbuhara');
      } else {
          if (city === 'Самарканд') {
              res.redirect('/cashiersamarkand');
          } else {
              if (city === 'Хива') {
                  res.redirect('/cashierhiva');
              } 
              else {
                res.redirect('/');
              }
          }
      }
    }else {
      res.redirect('/');
    }
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).send('Error logging in: ' + error.message);
  }
});

function generateOneTimeCode() {
  // Generate a random code (for example, a 6-digit number)
  const code = Math.floor(100000 + Math.random() * 900000); // Generates a random 6-digit number
  return code.toString(); // Convert to string if necessary
}

// Admin route
app.get('/admin', async (req, res) => {
  const event = {
    name: 'Samarqand',
    location: 'Center of Youth',
    date: '2024-04-23 at 14:00',
    price: 50
  };
  try {
    if (req.session.user && req.session.user.role === 'admin') {
      const cashiers = await Cashier.find({});
      res.render('admin', { user: req.session.user, cashiers,event });
    } else {
      res.redirect('/login');
    }
  } catch (error) {
    console.error('Error fetching cashiers list:', error);
    res.status(500).send('Error fetching cashiers');
  }
});

app.post('/add-cashier', async (req, res) => {
  const { username, password, city } = req.body;

  // Проверка корректности пароля
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invalid password' });
}


  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const newCashier = new Cashier({
      username: username,
      password: hashedPassword,
      city: city
    });

    await newCashier.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при добавлении кассира:', error);
    res.status(400).json({ error: 'Failed to add new cashier' });
  }
});

// Get cashiers route
app.get('/get-cashiers', async (req, res) => {
  try {
    const cashiers = await Cashier.find({});
    res.json({ success: true, cashiers });
  } catch (error) {
    console.error('Error fetching cashiers list:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/cashier', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'cashier') {
    return res.redirect('/login');
  }

  const city = req.query.city;
  console.log(`Cashier access: username=${req.session.user.username}, city=${city}`);

  try {
    const cashiers = await Cashier.find({ city: city });
    console.log(`Cashiers found: ${cashiers.length}`);
    res.render('cashier', { cashiers: cashiers, city: city });
  } catch (error) {
    console.error('Ошибка получения данных кассира:', error);
    res.status(500).send('Ошибка получения данных кассира: ' + error.message);
  }
});

app.post('/save', upload.single('profilePic'), async (req, res) => {
  
  try {
      const { city, organization, department, position, tin, fullname } = req.body;
      const profilePic = req.file ? `/uploads/${req.file.filename}` : '';
      // Create a new instance of Employee model
      const newEmployee = new Employee({
          city,
          organization,
          department,
          position,
          tin,
          fullname,
          profilePic
      });
      // Save to MongoDB
      await newEmployee.save();

      res.status(201).json({ success: true, message: 'Employee data saved successfully.' });
  } catch (error) {
      console.error('Error saving data:', error);
      res.status(500).json({ success: false, error: 'Failed to save data.' });
  }
});

app.put('/api/update-city-price', async (req, res) => {
  const { cityName } = req.body;
  const { ticketPrice } = req.body; 
  try {
    const city = await City.findOneAndUpdate(
      { name: cityName },
      { ticketPrice: ticketPrice },
      { new: true }
    );
    if (city) {
        res.json({ ticketPrice: city.ticketPrice });
    } else {
      res.status(404).json({ error: 'City not found' });
    }
  } catch (error) {
    console.error('Error updating city ticket price:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error ending session:', err);
      return res.status(500).send('Error ending session');
    }
    res.redirect('/login');
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Open the application at: http://localhost:${port}/login`);
});
