const express = require('express');
const authenticateToken = require('../middleware/auth');
const router = express.Router();
const connection = require('../db');

// Apply authentication middleware to all vendor routes
router.use('/vendors', authenticateToken);

// Get all vendors
router.get('/vendors', (req, res) => {
  const query = 'SELECT vendor_name FROM vendor_list';
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching vendors:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json(results);
  });
});

// Add a new vendor
router.post('/vendors', (req, res) => {
  const { vendor_name } = req.body;
  const query = 'INSERT INTO vendor_list (vendor_name) VALUES (?)';
  
  connection.query(query, [vendor_name], (err, result) => {
    if (err) {
      console.error('Error adding vendor:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.status(201).json({ message: 'Vendor added successfully' });
  });
});

// Delete a vendor
router.delete('/vendors/:vendor_name', (req, res) => {
  const { vendor_name } = req.params;
  
  // First check if vendor is being used by any users
  connection.query('SELECT id FROM users WHERE vendor = ?', [vendor_name], (err, results) => {
    if (err) {
      console.error('Error checking vendor usage:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    
    // If vendor is in use, return error
    if (results.length > 0) {
      return res.status(400).json({ message: 'Vendor is currently assigned to users and cannot be deleted' });
    }
    
    // If vendor is not in use, proceed with deletion
    const query = 'DELETE FROM vendor_list WHERE vendor_name = ?';
    connection.query(query, [vendor_name], (err) => {
      if (err) {
        console.error('Error deleting vendor:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      res.json({ message: 'Vendor deleted successfully' });
    });
  });
});

module.exports = router; 

// Edit a vendor
router.put('/vendors/:old_vendor_name', (req, res) => {
  const { old_vendor_name } = req.params;
  const { new_vendor_name } = req.body;
  
  const query = 'UPDATE vendor_list SET vendor_name = ? WHERE vendor_name = ?';
  connection.query(query, [new_vendor_name, old_vendor_name], (err) => {
    if (err) {
      console.error('Error updating vendor:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json({ message: 'Vendor updated successfully' });
  });
});