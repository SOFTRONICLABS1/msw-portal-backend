const express = require('express');
const authenticateToken = require('../middleware/auth');
const router = express.Router();
const connection = require('../db');
const axios = require('axios');

// Apply authentication middleware to all inventory archive routes
router.use('/inventory_archive', authenticateToken);

// GET /api/inventory_archive/db - Returns data from the database with date range filtering
router.get('/inventory_archive/db', (req, res) => {
  const { startDate, endDate } = req.query;
  
  // Validate that both dates are provided
  if (!startDate || !endDate) {
    return res.status(400).json({ 
      message: 'Both startDate and endDate query parameters are required' 
    });
  }
  
  // Validate date format (basic check)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return res.status(400).json({ 
      message: 'Dates must be in YYYY-MM-DD format' 
    });
  }
  
  // SQL query with date range filteringl
  const query = `
    SELECT DISTINCT * FROM inventory_archive 
    WHERE timestamp >= ? AND timestamp <= ? 
    ORDER BY timestamp DESC
  `;
  
  connection.query(query, [startDate, endDate], (err, results) => {
    if (err) {
      console.error('Error fetching inventory from database:', err);
      res.status(500).json({ message: 'Error fetching inventory data' });
    } else {
      res.json(results);
    }
  });
});

module.exports = router;