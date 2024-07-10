const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'cashier'], required: true },
  city: { type: String, default: 'unknown' }
});

userSchema.index({ username: 1 }); // Creating an index for the username field
const UserModel = mongoose.model('User', userSchema);

const cashierSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
  city: { type: String, required: true },
  role: { type: String, default: 'cashier' } // Default role
});

// Creating the Cashier model
const Cashier = mongoose.model('Cashier', cashierSchema);

const employeeSchema = new mongoose.Schema({
  city: { type: String, required: true },
  organization: { type: String, required: true },
  department: { type: String, required: true },
  position: { type: String, required: true },
  tin: { type: String, required: true },
  fullname: { type: String, required: true },
  profilePic: { type: String } // Path to profile picture (can be a string)
});

// Creating the Employee model
const Employee = mongoose.model('Employee', employeeSchema);

const TicketPriceSchema = new Schema({
  city: { type: String, required: true, unique: true },
  price: { type: Number, required: true }
});

// Creating the TicketPrice model
const TicketPrice = mongoose.model('TicketPrice', TicketPriceSchema);

const SystemSettingsSchema = new mongoose.Schema({
  paymentSystemEnabled: { type: Boolean, default: true },
  modelEnabled: { type: Boolean, default: true },
  testPeriodEnabled: { type: Boolean, default: true },
});

const SystemSettings = mongoose.model('SystemSettings', SystemSettingsSchema);

module.exports = { UserModel, Cashier, Employee, TicketPrice ,SystemSettings};
