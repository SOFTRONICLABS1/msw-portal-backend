const express = require('express');
const authenticateToken = require('../middleware/auth');
const router = express.Router();
const connection = require('../db');
const axios = require('axios');

// Apply authentication middleware to all inventory routes
router.use('/inventory', authenticateToken);

// GET /api/inventory - Returns data from external API
router.get('/inventory', async (req, res) => {
  try {
    // Fetch data from external API with authentication
    const response = await axios.get('https://msw-vkap24.whse.com/kineticlive/api/v1/BaqSvc/MSW-OMPSTOCK?comp=MSW', {
                auth: {
                  username: 'softtronics',
                  password: 'NinjaOne@1234'
                }
    });
    
    res.json(response.data.value); // Return the 'value' array from the response
  } catch (error) {
    console.error('Error fetching inventory from external API:', error);
    res.status(500).json({ message: 'Failed to fetch inventory from external API' });
  }
});

// GET /api/inventory/db - Returns data from the database
router.get('/inventory/db', (req, res) => {
  connection.query('SELECT DISTINCT * FROM inventory', (err, results) => {
    if (err) {
      console.error('Error fetching inventory from database:', err);
      res.status(500).json({ message: 'Error fetching inventory data' });
    } else {
      res.json(results);
    }
  });
});

// POST /api/inventory/reset - Resets the database with data from external API
router.post('/inventory/reset', async (req, res) => {
  try {
    // Step 1: Fetch data from external API
    const response = await axios.get('https://msw-vkap24.whse.com/kineticlive/api/v1/BaqSvc/MSW-OMPSTOCK?comp=MSW', {
                auth: {
                  username: 'softtronics',
                  password: 'NinjaOne@1234'
                }
    });
    const externalInventory = response.data.value; // Access the 'value' array
    
    // Step 2: Truncate the table
    connection.query('TRUNCATE TABLE inventory', (err) => {
      if (err) {
        console.error('Error clearing inventory table:', err);
        return res.status(500).json({ message: 'Error clearing inventory table' });
      }
      
      // Step 3: Insert new data from external source
      const insertQuery = 'INSERT INTO inventory (PartWhse_PartNum, Part_PartDescription, PartWhse_WarehouseCode, PartBin_LotNum, PartBin_OnhandQty) VALUES ?';
      const values = externalInventory.map(item => [
        item.PartWhse_PartNum,
        item.Part_PartDescription,
        item.PartWhse_WarehouseCode,
        item.PartBin_LotNum,
        item.PartBin_OnhandQty
      ]);
      
      connection.query(insertQuery, [values], (err) => {
        if (err) {
          console.error('Error populating inventory table:', err);
          return res.status(500).json({ message: 'Error populating inventory table' });
        }
        res.json({ message: 'Inventory reset successfully using external API' });
      });
    });
  } catch (error) {
    console.error('Error fetching inventory from external API:', error);
    res.status(500).json({ message: 'Failed to fetch inventory from external API' });
  }
});

module.exports = router;