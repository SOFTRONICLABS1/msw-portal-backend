// migration-script.js
// This script will migrate existing plaintext passwords to bcrypt hashed passwords
// Run this script once after deploying the bcrypt changes

const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

const saltRounds = 10;

async function migratePasswords() {
  console.log('Starting password migration...');

  // Create database connection
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'softtronics',
    password: 'Msw!$#@Lr12',
    database: 'mswsuppliers'
  });

  try {
    // Get all users
    console.log('Fetching users...');
    const [users] = await connection.query('SELECT id, username, password FROM users');
    console.log(`Found ${users.length} users to migrate`);

    // Update each user's password with a bcrypt hash
    for (const user of users) {
      // Skip if the password already looks like a bcrypt hash
      if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$') || user.password.startsWith('$2y$')) {
        console.log(`User ${user.username} already has hashed password, skipping...`);
        continue;
      }

      console.log(`Migrating password for user: ${user.username}`);

      // Hash the plaintext password
      const hashedPassword = await bcrypt.hash(user.password, saltRounds);

      // Update the user's password in the database
      await connection.query(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, user.id]
      );

      console.log(`Password migrated for user: ${user.username}`);
    }

    console.log('Password migration completed successfully');
  } catch (error) {
    console.error('Error during password migration:', error);
  } finally {
    // Close the database connection
    await connection.end();
    console.log('Database connection closed');
  }
}

// Run the migration
migratePasswords().catch(console.error);