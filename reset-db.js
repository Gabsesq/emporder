require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function resetDatabase() {
    try {
        // Read and execute schema.sql
        const fs = require('fs');
        const schema = fs.readFileSync('schema.sql', 'utf8');
        
        await pool.query(schema);
        console.log('Database reset successful!');
    } catch (err) {
        console.error('Error resetting database:', err);
    } finally {
        await pool.end();
    }
}

resetDatabase(); 