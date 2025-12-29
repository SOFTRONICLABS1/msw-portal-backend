const express = require('express');
const authenticateToken = require('../middleware/auth');
const router = express.Router();
const connection = require('../db');
const axios = require('axios');

// Apply authentication middleware to all transaction routes
router.use('/transaction', authenticateToken);

// GET /api/transaction - Returns data from external API
router.get('/transaction', async (req, res) => {
  try {
    // Fetch data from external API with authentication
    const response = await axios.get('https://msw-vkap24.whse.com/kineticlive/api/v1/BaqSvc/MSW-OMPTransaction1?comp=MSW', {
                auth: {
                  username: 'softtronics',
                  password: 'NinjaOne@1234'
                }
    });
    
    res.json(response.data.value); // Return the 'value' array from the response
  } catch (error) {
    console.error('Error fetching transaction from external API:', error);
    res.status(500).json({ message: 'Failed to fetch transaction from external API' });
  }
});

// GET /api/transaction/db - Returns data from the database
router.get('/transaction/db', (req, res) => {
  connection.query('SELECT DISTINCT * FROM transaction', (err, results) => {
    if (err) {
      console.error('Error fetching transaction from database:', err);
      res.status(500).json({ message: 'Error fetching transaction data' });
    } else {
      res.json(results);
    }
  });
});

// POST /api/transaction/reset - Resets the database with data from external API
router.post('/transaction/reset', async (req, res) => {
  try {
    // Step 1: Fetch data from external API
    const response = await axios.get('https://msw-vkap24.whse.com/kineticlive/api/v1/BaqSvc/MSW-OMPTransaction1?comp=MSW', {
                auth: {
                  username: 'softtronics',
                  password: 'NinjaOne@1234'
                }
    });
    const externalInventory = response.data.value; // Access the 'value' array
    
    // Step 2: Truncate the table
    connection.query('TRUNCATE TABLE transaction', (err) => {
      if (err) {
        console.error('Error clearing transaction table:', err);
        return res.status(500).json({ message: 'Error clearing transaction table' });
      }
      
      // Step 3: Insert new data from external source
      const insertQuery = 'INSERT INTO transaction (PartTran_PartNum, Part_PartDescription, PartTran_WareHouseCode, PartTran_TranType, PartTran_PONum, PartTran_PackNum, PartTran_TranDate, PartTran_LotNum, Calculated_QUANTITY) VALUES ?';
      const values = externalInventory.map(item => [
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
      
      connection.query(insertQuery, [values], (err) => {
        if (err) {
          console.error('Error populating transaction table:', err);
          return res.status(500).json({ message: 'Error populating transaction table' });
        }
        res.json({ message: 'transaction reset successfully using external API' });
      });
    });
  } catch (error) {
    console.error('Error fetching transaction from external API:', error);
    res.status(500).json({ message: 'Failed to fetch transaction from external API' });
  }
});

module.exports = router;