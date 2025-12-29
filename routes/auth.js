const express = require('express');
const authenticateToken = require('../middleware/auth');
const router = express.Router();
const connection = require('../db');
const bcrypt = require('bcrypt');
const saltRounds = 10; // Standard recommendation for bcrypt
const jwt = require('jsonwebtoken');

// Helper function to delete expired refresh tokens
const deleteExpiredToken = async (userId) => {
  const deleteQuery = 'DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at <= NOW()';
  return new Promise((resolve, reject) => {
    connection.query(deleteQuery, [userId], (err) => {
      if (err) {
        console.error('Error deleting expired token:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

// Signup Route
router.post('/signup', authenticateToken, async (req, res) => {
  const { username, password, name, email, vendor } = req.body;
  console.log('Signup request:', { username, name, email, vendor });

  try {
    // Check if user already exists
    const checkQuery = 'SELECT * FROM users WHERE username = ? OR email = ?';
    connection.query(checkQuery, [username, email], async (err, results) => {
      if (err) {
        console.error('DB check error:', err);
        return res.status(500).json({ message: 'Server error (check)' });
      }

      if (results.length > 0) {
        const existingUser = results[0];
        if (existingUser.username === username) {
          return res.status(409).json({ message: 'Username already exists' });
        }
        if (existingUser.email === email) {
          return res.status(409).json({ message: 'Email already exists' });
        }
      }

      try {
        // Hash the password before storing
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        const insertQuery = 'INSERT INTO users (username, password, name, email, vendor) VALUES (?, ?, ?, ?, ?)';
        connection.query(insertQuery, [username, hashedPassword, name, email, vendor], (err) => {
          if (err) {
            console.error('DB insert error:', err);
            return res.status(500).json({ message: 'Server error (insert)' });
          }

          console.log('User created successfully');
          res.status(201).json({ message: 'User created successfully' });
        });
      } catch (hashError) {
        console.error('Password hashing error:', hashError);
        return res.status(500).json({ message: 'Error processing password' });
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Refresh token endpoint
router.post('/auth/refresh', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(403).json({ message: 'Refresh token not found' });
  }

  try {
    // First verify the refresh token format is valid
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const userId = decoded.id;

    // Get the stored refresh token from database
    const query = `
      SELECT rt.*, u.username, u.name, u.vendor 
      FROM refresh_tokens rt
      JOIN users u ON rt.user_id = u.id
      WHERE rt.user_id = ? 
      ORDER BY rt.created_at DESC
      LIMIT 1
    `;

    connection.query(query, [userId], async (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }

      if (results.length === 0) {
        return res.status(403).json({ message: 'Refresh token not found' });
      }

      const storedToken = results[0];
      
      // Check if token is expired
      if (new Date(storedToken.expires_at) <= new Date()) {
        try {
          // Delete all tokens for this user, not just expired ones
          const deleteQuery = 'DELETE FROM refresh_tokens WHERE user_id = ?';
          await new Promise((resolve, reject) => {
            connection.query(deleteQuery, [userId], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });

          // Clear the refresh token cookie
          res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: true, // Set to false in dev if not using HTTPS
            sameSite: 'Strict'
          });
          return res.status(403).json({ message: 'Session expired' });
        } catch (error) {
          console.error('Error handling expired token:', error);
          return res.status(500).json({ message: 'Internal server error' });
        }
      }

      const user = {
        id: userId,
        username: results[0].username,
        name: results[0].name,
        vendor: results[0].vendor
      };

      // Compare the received refresh token with stored hash
      const isValidToken = await bcrypt.compare(refreshToken, storedToken.token_hash);

      if (!isValidToken) {
        return res.status(403).json({ message: 'Invalid refresh token' });
      }

      // Generate new access token
      const isAdmin = user.username === 'mswadmin';
      const accessToken = jwt.sign(
        {
          id: user.id,
          username: user.username,
          name: user.name,
          vendor: user.vendor,
          isAdmin: isAdmin
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }  // 1 minute for testing
      );

      // Send new access token
      res.json({
        success: true,
        accessToken,
        message: 'Token refreshed successfully'
      });
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(403).json({ message: 'Invalid refresh token format' });
    }
    console.error('Token refresh error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Export the router
module.exports = router;
module.exports.deleteExpiredToken = deleteExpiredToken;