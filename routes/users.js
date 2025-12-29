const express = require('express');
const authenticateToken = require('../middleware/auth');
const router = express.Router();
const connection = require('../db');

// Apply authentication middleware to all user routes
router.use('/users', authenticateToken);

// Get all users (excluding password)
router.get('/users', (req, res) => {
  const query = 'SELECT id, username, name, email, vendor FROM users';
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching users:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json(results);
  });
});

// Delete a user by ID
router.delete('/users/:id', (req, res) => {
  const userId = req.params.id;
  
  // First check if user is admin
  connection.query('SELECT username FROM users WHERE id = ?', [userId], (err, results) => {
    if (err) {
      console.error('Error checking user:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    
    // If user is admin, prevent deletion
    if (results.length > 0 && results[0].username === 'mswadmin') {
      return res.status(403).json({ message: 'Cannot delete admin user' });
    }
    
    // Otherwise proceed with deletion
    const query = 'DELETE FROM users WHERE id = ?';
    connection.query(query, [userId], (err, result) => {
      if (err) {
        console.error('Error deleting user:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      res.json({ message: 'User deleted successfully' });
    });
  });
});

// Update a user
router.put('/users/:id', (req, res) => {
  const userId = req.params.id;
  const { name, email, vendor } = req.body;

  // First check if user is admin
  connection.query('SELECT username FROM users WHERE id = ?', [userId], (err, results) => {
    if (err) {
      console.error('Error checking user:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    
    // If user is admin, only allow email update
    if (results.length > 0 && results[0].username === 'mswadmin') {
      const query = 'UPDATE users SET email = ? WHERE id = ?';
      connection.query(query, [email, userId], (err, result) => {
        if (err) {
          console.error('Error updating admin:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        res.json({ message: 'Admin updated successfully' });
      });
      return;
    }
    
    // For non-admin users, allow updating all fields
    const query = 'UPDATE users SET name = ?, email = ?, vendor = ? WHERE id = ?';
    connection.query(query, [name, email, vendor, userId], (err, result) => {
      if (err) {
        console.error('Error updating user:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      res.json({ message: 'User updated successfully' });
    });
  });
});

module.exports = router;