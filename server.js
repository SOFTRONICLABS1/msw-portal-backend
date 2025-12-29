const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const mysql = require('mysql2');
const connection = require('./db');
const cors = require('cors');
require('dotenv').config();
const helmet = require('helmet');
const axios = require('axios');
const bcrypt = require('bcrypt');
const cron = require('node-cron');
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const { deleteExpiredToken } = require('./routes/auth');

const app = express();
const port = 3000;
const otpStore = {}; // Temporary in-memory store: username → OTP
const ServerUrl  = process.env.REACT_APP_BACKEND_URL;

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const vendorRoutes = require('./routes/vendors');
const inventoryRoutes = require('./routes/inventory');
const inventoryArchiveRoutes = require('./routes/inventory_archive');
const transactionRoutes = require('./routes/transaction');
const transactionArchiveRoutes = require('./routes/transaction_archive');

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));
app.use(express.json());
app.use(helmet());
app.use(cookieParser());
app.use(bodyParser.json());

app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', vendorRoutes);
app.use('/api', inventoryRoutes);
app.use('/api', inventoryArchiveRoutes);
app.use('/api', transactionRoutes);
app.use('/api', transactionArchiveRoutes);

// Database connection
connection.connect((err) => {
  if (err) {
    console.error('DB connection failed:', err);
  } else {
    console.log('Connected to MySQL');

    // Create users table if it doesn't exist
    const createUsersTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        vendor VARCHAR(255)
      )
    `;

    // Create refresh_tokens table if it doesn't exist
    const createRefreshTokensTableQuery = `
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    // Create vendor_list table if it doesn't exist
    const createVendorListTableQuery = `
      CREATE TABLE IF NOT EXISTS vendor_list (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vendor_name VARCHAR(255) NOT NULL UNIQUE
      )
    `;

    // Create inventory table if it doesn't exist with new structure
    const createInventoryTableQuery = `
      CREATE TABLE IF NOT EXISTS inventory (
        PartWhse_PartNum VARCHAR(255),
        Part_PartDescription VARCHAR(255),
        PartWhse_WarehouseCode VARCHAR(255),
        PartBin_LotNum VARCHAR(255),
        PartBin_OnhandQty VARCHAR(255)
      )
    `;
    const createTransactionTableQuery = `
      CREATE TABLE IF NOT EXISTS transaction (
        PartTran_PartNum VARCHAR(255),
        Part_PartDescription VARCHAR(255),
        PartTran_WareHouseCode VARCHAR(255),
        PartTran_TranType VARCHAR(255),
        PartTran_PONum VARCHAR(255),
        PartTran_PackNum VARCHAR(255),
        PartTran_TranDate VARCHAR(255),
        PartTran_LotNum VARCHAR(255),
        Calculated_QUANTITY VARCHAR(255)
      )
    `;

    // Create inventory_archive table if it doesn't exist with new structure
    const createInventoryArchiveTableQuery = `
      CREATE TABLE IF NOT EXISTS inventory_archive (
        PartWhse_PartNum VARCHAR(255),
        Part_PartDescription VARCHAR(255),
        PartWhse_WarehouseCode VARCHAR(255),
        PartBin_LotNum VARCHAR(255),
        PartBin_OnhandQty VARCHAR(255),
        timestamp DATE NOT NULL,
        archive_id INT AUTO_INCREMENT PRIMARY KEY
      )
    `;
    const createTransactionArchiveTableQuery = `
      CREATE TABLE IF NOT EXISTS transaction_archive (
        PartTran_PartNum VARCHAR(255),
        Part_PartDescription VARCHAR(255),
        PartTran_WareHouseCode VARCHAR(255),
        PartTran_TranType VARCHAR(255),
        PartTran_PONum VARCHAR(255),
        PartTran_PackNum VARCHAR(255),
        PartTran_TranDate VARCHAR(255),
        PartTran_LotNum VARCHAR(255),
        Calculated_QUANTITY VARCHAR(255),
        timestamp DATE NOT NULL,
        archive_id INT AUTO_INCREMENT PRIMARY KEY
      )
    `;

    connection.query(createUsersTableQuery, (err) => {
      if (err) {
        console.error('Error creating users table:', err);
      } else {
        console.log('Users table ready');
      }
    });

    connection.query(createRefreshTokensTableQuery, (err) => {
      if (err) {
        console.error('Error creating refresh_tokens table:', err);
      } else {
        console.log('Refresh tokens table ready');
      }
    });

    connection.query(createVendorListTableQuery, (err) => {
      if (err) {
        console.error('Error creating vendor_list table:', err);
      } else {
        console.log('Vendor list table ready');
      }
    });

    connection.query(createInventoryTableQuery, (err) => {
      if (err) {
        console.error('Error creating inventory table:', err);
      } else {
        console.log('Inventory table ready');

        // Truncate and populate with data from external API
        connection.query('TRUNCATE TABLE inventory', (err) => {
          if (err) {
            console.error('Error clearing inventory table:', err);
            return;
          }

          // Fetch inventory data from external API
          axios.get('https://msw-vkap24.whse.com/kineticlive/api/v1/BaqSvc/MSW-OMPSTOCK?comp=MSW', {
            auth: {
              username: 'softtronics',
              password: 'NinjaOne@1234'
            }
          })
            .then(response => {
              const inventoryData = response.data.value; // Access the 'value' array

              // Prepare the insert query
              const insertQuery = 'INSERT INTO inventory (PartWhse_PartNum, Part_PartDescription, PartWhse_WarehouseCode, PartBin_LotNum, PartBin_OnhandQty) VALUES ?';
              const values = inventoryData.map(item => [
                item.PartWhse_PartNum,
                item.Part_PartDescription,
                item.PartWhse_WarehouseCode,
                item.PartBin_LotNum,
                item.PartBin_OnhandQty
              ]);

              // Insert into database
              connection.query(insertQuery, [values], (err) => {
                if (err) {
                  console.error('Error populating inventory table:', err);
                } else {
                  console.log('Inventory table populated with data from external API');
                }
              });
            })
            .catch(error => {
              console.error('Failed to fetch inventory data:', error.message);
            });
        });
      }
    });
    connection.query(createTransactionTableQuery, (err) => {
      if (err) {
        console.error('Error creating transaction table:', err);
      } else {
        console.log('transaction table ready');

        // Truncate and populate with data from external API
        connection.query('TRUNCATE TABLE transaction', (err) => {
          if (err) {
            console.error('Error clearing inventory table:', err);
            return;
          }

          // Fetch inventory data from external API
          axios.get('https://msw-vkap24.whse.com/kineticlive/api/v1/BaqSvc/MSW-OMPTransaction1?comp=MSW', {
            auth: {
              username: 'softtronics',
              password: 'NinjaOne@1234'
            }
          })
            .then(response => {
              const transactionData = response.data.value; // Access the 'value' array

              // Prepare the insert query
              const insertQuery = 'INSERT INTO transaction (PartTran_PartNum , Part_PartDescription , PartTran_WareHouseCode , PartTran_TranType , PartTran_PONum ,PartTran_PackNum ,PartTran_TranDate ,PartTran_LotNum ,Calculated_QUANTITY ) VALUES ?';
              const values = transactionData.map(item => [
                item.PartTran_PartNum,
                item.Part_PartDescription,
                item.PartTran_WareHouseCode,
                item.PartTran_TranType,
                item.PartTran_PONum,
                item.PartTran_PackNum,
                item.PartTran_TranDate,
                item.PartTran_LotNum,
                item.Calculated_QUANTITY
              ]);

              // Insert into database
              connection.query(insertQuery, [values], (err) => {
                if (err) {
                  console.error('Error populating transaction table:', err);
                } else {
                  console.log('transaction table populated with data from external API');
                }
              });
            })
            .catch(error => {
              console.error('Failed to fetch transaction data:', error.message);
            });
        });
      }
    });

    connection.query(createInventoryArchiveTableQuery, (err) => {
      if (err) {
        console.error('Error creating inventory_archive table:', err);
      } else {
        console.log('Inventory archive table ready');
      }
    });
    connection.query(createTransactionArchiveTableQuery, (err) => {
      if (err) {
        console.error('Error creating transaction archive table:', err);
      } else {
        console.log('transaction archive table ready');
      }
    });
  }
});

// Login route
app.post('/api/login', (req, res) => {
  const { username, otp } = req.body;
  console.log('Login attempt:', username);

  const query = 'SELECT * FROM users WHERE username = ?';
  console.log(query)
  connection.query(query, [username], async (err, results) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ message: 'Server error' });
    }

    console.log('Query result found user:', results.length > 0);
    if (results.length > 0) {
      const user = results[0];

      // OTP check
      if (!otpStore[username] || otpStore[username].toString() !== otp) {
        return res.status(401).json({ success: false, message: 'Invalid or missing OTP' });
      }

      delete otpStore[username]; // Invalidate OTP after successful use

      const isAdmin = user.username === 'mswadmin';

      // Generate access token (short-lived - 1 minutes for testing)
      const accessToken = jwt.sign(
        {
          id: user.id,
          username: user.username,
          name: user.name,
          vendor: user.vendor,
          isAdmin: isAdmin
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      // Generate refresh token (4 minutes for testing)
      const refreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      );

      // Hash the refresh token before storing
      const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
      
      // Store hashed refresh token in database
      const storeTokenQuery = `
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))
      `;
      
      connection.query(storeTokenQuery, [user.id, refreshTokenHash], (tokenErr) => {
        if (tokenErr) {
          console.error('Error storing refresh token:', tokenErr);
          return res.status(500).json({ message: 'Error creating session' });
        }

        // Set only refresh token in cookie
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: true, // Set to false in dev if not using HTTPS
          sameSite: 'Strict',
          maxAge: 30 * 60 * 1000 // 4 minutes for testing
        });

        // Send access token in response body only
        res.json({
          success: true,
          isAdmin,
          name: user.name,
          vendor: user.vendor,
          accessToken,  // Only send access token in response
          message: 'Login successful'
        });
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  });
});

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_ID,
    pass: process.env.EMAIL_PASS
  }
});

app.post("/api/send-otp", (req, res) => {
  const { username } = req.body;

  const query = "SELECT email, name FROM users WHERE username = ?";
  connection.query(query, [username], async (err, results) => {
    if (err || results.length === 0) {
      return res.json({ success: false, message: "User not found" });
    }

    const email = results[0].email;
    const name = results[0].name;
    const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
    otpStore[username] = otp;

    const htmlContent = `
    <html>
      <body>
        <p>Dear ${name},</p>
        <p>Here is the OTP code for MSW Web Portal: <strong>${otp}</strong></p>
        <p>Have a Good day!</p>
        <br>
        <p>Best regards,<br>MSW Team</p>
        <p style="color: red; font-weight: bold;">
          ***This is system generated mail - do not reply to this mail***
        </p>
      </body>
    </html>
    `;

    const mailOptions = {
      from: {
        name: "MSW Auto Mailer",
        address: "mswautoemail@whse.com"
      },
      to: {
        name: "MSW User",
        address: email
      },
      subject: "Your OTP Code for MSW Web Portal",
      html: htmlContent
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      if (info.response.includes('250')) {
        console.log('OTP email sent successfully.');
        res.json({ success: true, message: "OTP sent to your email" });
      } else {
        console.error('Failed to send OTP email. Status:', info.response);
        res.status(500).json({ success: false, message: "Failed to send OTP" });
      }
    } catch (err) {
      console.error('Error sending email:', err);
      res.status(500).json({ success: false, message: "Failed to send OTP" });
    }
  });
});

app.post("/api/verify-credentials", (req, res) => {
  const { username, password } = req.body;
  console.log('Verifying credentials for:', username);

  const query = 'SELECT * FROM users WHERE username = ?';
  console.log(query)
  connection.query(query, [username], async (err, results) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    if (results.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = results[0];
    try {
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      res.json({ 
        success: true, 
        message: 'Credentials verified' 
      });
    } catch (compareError) {
      console.error('Password comparison error:', compareError);
      res.status(500).json({ success: false, message: 'Authentication error' });
    }
  });
});

// Logout route
app.post('/api/logout', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  
  // If there's a refresh token, remove it from database
  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
      const userId = decoded.id;
      
      // First delete any expired tokens
      await deleteExpiredToken(userId);
      
      // Then delete the current refresh token
      const query = 'DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at > NOW()';
      connection.query(query, [userId], (err) => {
        if (err) {
          console.error('Error removing refresh token:', err);
          return res.status(500).json({ success: false, message: 'Error during logout' });
        }
        
        // Clear the refresh token cookie
        res.clearCookie('refreshToken', {
          httpOnly: true,
          secure: true, // Set to false in dev if not using HTTPS
          sameSite: 'Strict'
        });
        
        res.json({ success: true, message: 'Logged out successfully' });
      });
    } catch (err) {
      console.error('Error during logout:', err);
      // Even if there's an error, try to clear the cookie
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: true, // Set to false in dev if not using HTTPS
        sameSite: 'Strict'
      });
      res.status(500).json({ success: false, message: 'Error during logout' });
    }
  } else {
    // No refresh token in cookie, just return success
    res.json({ success: true, message: 'Logged out successfully' });
  }
});

// Server start
app.listen(port, () => {
  console.log(`Server running at ${ServerUrl}`);
});

// Auto-refresh inventory daily at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    const response = await fetch(`${ServerUrl}/api/inventory/reset`, {
      method: 'POST',
    });
    if (response.ok) {
      console.log('Scheduled inventory refresh completed successfully');
    } else {
      console.error('Scheduled refresh failed with status:', response.status);
    }
  } catch (error) {
    console.error('Scheduled refresh error:', error.message);
  }
});
cron.schedule('0 0 * * *', async () => {
  try {
    const response = await fetch(`${ServerUrl}/api/transaction/reset`, {
      method: 'POST',
    });
    if (response.ok) {
      console.log('Scheduled transaction refresh completed successfully');
    } else {
      console.error('Scheduled refresh failed with status:', response.status);
    }
  } catch (error) {
    console.error('Scheduled refresh error:', error.message);
  }
});
// Cron job for inventory archiving
cron.schedule('15 11 * * *', () => {
  const insertInventoryArchiveQuery = `
    INSERT INTO inventory_archive (PartWhse_PartNum, Part_PartDescription, PartWhse_WarehouseCode, PartBin_LotNum, PartBin_OnhandQty, timestamp)
    SELECT PartWhse_PartNum, Part_PartDescription, PartWhse_WarehouseCode, PartBin_LotNum, PartBin_OnhandQty, CURDATE()
    FROM inventory
  `;

  connection.query(insertInventoryArchiveQuery, (err) => {
    if (err) {
      console.error('Error archiving inventory:', err);
    } else {
      console.log('Inventory archived at 12:02 AM');
    }
  });
});
cron.schedule('15 11 * * *', () => {
  const insertTransactionArchiveQuery = `
    INSERT INTO transaction_archive (PartTran_PartNum, Part_PartDescription, PartTran_WareHouseCode, PartTran_TranType, PartTran_PONum, PartTran_PackNum, PartTran_TranDate, PartTran_LotNum, Calculated_QUANTITY, timestamp)
    SELECT PartTran_PartNum, Part_PartDescription, PartTran_WareHouseCode, PartTran_TranType, PartTran_PONum,PartTran_PackNum, PartTran_TranDate, PartTran_LotNum, Calculated_QUANTITY, CURDATE()
    FROM transaction
  `;

  connection.query(insertTransactionArchiveQuery, (err) => {
    if (err) {
      console.error('Error archiving transaction:', err);
    } else {
      console.log('transaction archived at 12:02 AM');
    }
  });
});