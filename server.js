require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const twilio = require('twilio');
const speakeasy = require('speakeasy');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // your gmail address
        pass: process.env.EMAIL_APP_PASSWORD // your gmail app password
    }
});

// Verify email connection on startup
transporter.verify(function(error, success) {
    if (error) {
        console.error('Email verification error:', error);
    } else {
        console.log('Email server is ready to take our messages');
    }
});

// Encryption key management
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-encryption-key-here'; // 32 bytes
const IV_LENGTH = 16;

function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

// Initialize database tables
async function initializeDatabase() {
    try {
        // Create audit logs table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                event_type VARCHAR(50) NOT NULL,
                user_id VARCHAR(100) NOT NULL,
                details TEXT,
                ip_address VARCHAR(45),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
        `);

        // Create admin authentication table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_auth (
                id SERIAL PRIMARY KEY,
                email VARCHAR(100) NOT NULL UNIQUE,
                verification_code VARCHAR(6),
                code_expiry TIMESTAMP,
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')
            );
            CREATE INDEX IF NOT EXISTS idx_admin_auth_email ON admin_auth(email);
        `);

        // Create verification codes table with proper constraints
        await pool.query(`
            DROP TABLE IF EXISTS verification_codes;
            CREATE TABLE verification_codes (
                id SERIAL PRIMARY KEY,
                code VARCHAR(64) NOT NULL,  -- Increased from 6 to 64 to store Speakeasy secret
                card_id INTEGER NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                used BOOLEAN DEFAULT FALSE,
                CONSTRAINT fk_card
                    FOREIGN KEY(card_id)
                    REFERENCES credit_cards(id)
                    ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_verification_codes_card_id ON verification_codes(card_id);
            CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at ON verification_codes(expires_at);
        `);

        // Drop and recreate credit_cards table with improved structure
        await pool.query(`
            DROP TABLE IF EXISTS credit_cards CASCADE;
            CREATE TABLE credit_cards (
                id SERIAL PRIMARY KEY,
                customer_id VARCHAR(50),
                customer_name VARCHAR(100) NOT NULL,
                first_name VARCHAR(50),
                last_name VARCHAR(50),
                customer_type VARCHAR(50) CHECK (customer_type IN ('individual', 'business')),
                description TEXT,
                email VARCHAR(100) NOT NULL,
                phone VARCHAR(20),
                company VARCHAR(255),
                address VARCHAR(255) NOT NULL,
                city VARCHAR(100) NOT NULL,
                state VARCHAR(50) NOT NULL,
                zip_code VARCHAR(20) NOT NULL,
                country VARCHAR(100) NOT NULL,
                fax VARCHAR(20),
                card_number_encrypted TEXT NOT NULL,
                cvv_encrypted TEXT NOT NULL,
                expiry_date VARCHAR(5) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_update BOOLEAN DEFAULT false,
                active BOOLEAN DEFAULT true,
                last_verified TIMESTAMP,
                CONSTRAINT valid_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'),
                CONSTRAINT valid_expiry_date CHECK (expiry_date ~ '^(0[1-9]|1[0-2])/[0-9]{2}$')
            );

            CREATE INDEX IF NOT EXISTS idx_credit_cards_customer_name ON credit_cards(customer_name);
            CREATE INDEX IF NOT EXISTS idx_credit_cards_email ON credit_cards(email);
            CREATE INDEX IF NOT EXISTS idx_credit_cards_company ON credit_cards(company);
            CREATE INDEX IF NOT EXISTS idx_credit_cards_customer_type ON credit_cards(customer_type);
            CREATE INDEX IF NOT EXISTS idx_credit_cards_created_at ON credit_cards(created_at);
        `);

        // Add trigger to update updated_at timestamp
        await pool.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';

            DROP TRIGGER IF EXISTS update_credit_cards_updated_at ON credit_cards;
            CREATE TRIGGER update_credit_cards_updated_at
                BEFORE UPDATE ON credit_cards
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        `);

        // Check if admin record exists
        const adminCheck = await pool.query(
            'SELECT * FROM admin_auth WHERE email = $1',
            ['gabbyesquibel1999@gmail.com']
        );

        if (adminCheck.rows.length === 0) {
            await pool.query(
                'INSERT INTO admin_auth (email) VALUES ($1)',
                ['gabbyesquibel1999@gmail.com']
            );
        }

        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Database initialization error:', err);
        throw err;
    }
}

// Add this after your initializeDatabase function
async function addTestData() {
    try {
        // Add some test credit card data
        await pool.query(`
            INSERT INTO credit_cards (
                customer_name,
                card_number_encrypted,
                cvv_encrypted,
                expiry_date,
                email,
                phone
            ) VALUES 
                ($1, $2, $3, $4, $5, $6),
                ($7, $8, $9, $10, $11, $12),
                ($13, $14, $15, $16, $17, $18)
        `, [
            'John Smith',
            encrypt('4532123456788901'),
            encrypt('123'),
            '05/25',
            'john.smith@example.com',
            '555-0123',
            
            'Jane Doe',
            encrypt('5412345678901234'),
            encrypt('456'),
            '08/24',
            'jane.doe@example.com',
            '555-0124',
            
            'Bob Wilson',
            encrypt('371234567890123'),
            encrypt('789'),
            '12/23',
            'bob.wilson@example.com',
            '555-0125'
        ]);

        console.log('Test data added successfully');
    } catch (err) {
        console.error('Error adding test data:', err);
    }
}

// Call it after database initialization
initializeDatabase().then(() => {
    addTestData();
});

// Authentication routes
app.post('/api/admin/login', async (req, res) => {
    const { password } = req.body;
    
    console.log('Received password:', password);
    console.log('Expected password:', process.env.ADMIN_PASSWORD);
    
    if (password === process.env.ADMIN_PASSWORD) {
        try {
            await pool.query(
                'UPDATE admin_auth SET last_login = NOW() WHERE email = $1',
                ['gabbyesquibel1999@gmail.com']
            );
            res.json({ success: true });
        } catch (err) {
            console.error('Login error:', err);
            res.status(500).json({ message: 'Login failed' });
        }
    } else {
        res.status(401).json({ message: 'Invalid password' });
    }
});

// Check auth status
app.get('/api/admin/check-auth', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM admin_auth WHERE email = $1 AND last_login > NOW() - INTERVAL \'1 hour\'',
            ['gabbyesquibel1999@gmail.com']
        );
        
        if (result.rows.length > 0) {
            res.json({ success: true });
        } else {
            res.status(401).json({ message: 'Not authenticated' });
        }
    } catch (err) {
        console.error('Auth check error:', err);
        res.status(500).json({ message: 'Authentication check failed' });
    }
});

// Logout endpoint
app.post('/api/admin/logout', async (req, res) => {
    try {
        await pool.query(
            'UPDATE admin_auth SET last_login = NULL WHERE email = $1',
            ['gabbyesquibel1999@gmail.com']
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ message: 'Logout failed' });
    }
});

// Protected route middleware
const checkAdminAuth = async (req, res, next) => {
    try {
        const result = await pool.query(
            'SELECT * FROM admin_auth WHERE email = $1 AND last_login > NOW() - INTERVAL \'1 hour\'',
            ['gabbyesquibel1999@gmail.com']
        );
        
        if (result.rows.length > 0) {
            next();
        } else {
            res.status(401).json({ message: 'Not authenticated' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Authentication check failed' });
    }
};

// Protect admin pages - This must come before serving static files
app.get(['/admin-dashboard.html', '/product-management.html', '/creditcustomer.html'], async (req, res, next) => {
    try {
        const result = await pool.query(
            'SELECT * FROM admin_auth WHERE email = $1 AND last_login > NOW() - INTERVAL \'1 hour\'',
            ['gabbyesquibel1999@gmail.com']
        );
        
        if (result.rows.length === 0) {
            res.redirect('/admin.html');
        } else {
            next();
        }
    } catch (err) {
        console.error('Auth check error:', err);
        res.redirect('/admin.html');
    }
});

// Get all products (for admin)
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get only available products (for order form)
app.get('/api/available-products', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM products WHERE available_quantity > 0'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching available products:', err);
        res.status(500).json({ error: err.message });
    }
});

// Submit order
app.post('/api/orders', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { firstName, lastName, shippingAddress, notes, products } = req.body;
        
        // Validate product count
        if (products.length > 6) {
            throw new Error('Maximum 6 products allowed');
        }

        // Verify product availability and update quantities
        for (let product of products) {
            console.log(`Processing order for product ${product.code}, quantity: ${product.quantity}`);
            
            // Check current availability
            const availabilityResult = await client.query(
                'SELECT available_quantity FROM products WHERE product_code = $1',
                [product.code]
            );
            
            console.log('Current availability:', availabilityResult.rows[0]);
            
            if (availabilityResult.rows.length === 0) {
                throw new Error(`Product ${product.code} not found`);
            }
            
            const currentQuantity = availabilityResult.rows[0].available_quantity;
            if (currentQuantity < product.quantity) {
                throw new Error(`Insufficient quantity available for ${product.code}`);
            }
            
            // Update product quantity
            console.log(`Updating quantity for ${product.code}: ${currentQuantity} - ${product.quantity}`);
            await client.query(
                'UPDATE products SET available_quantity = available_quantity - $1 WHERE product_code = $2',
                [product.quantity, product.code]
            );
            
            // Verify the update
            const verifyUpdate = await client.query(
                'SELECT available_quantity FROM products WHERE product_code = $1',
                [product.code]
            );
            console.log(`New quantity for ${product.code}:`, verifyUpdate.rows[0]);
        }

        // Insert order
        const orderResult = await client.query(
            'INSERT INTO orders ("first_name", "last_name", "shipping_address", "notes") VALUES ($1, $2, $3, $4) RETURNING id',
            [firstName, lastName, shippingAddress, notes]
        );
        
        const orderId = orderResult.rows[0].id;

        // Insert order items
        for (let product of products) {
            await client.query(
                'INSERT INTO order_items ("order_id", "product_code", "quantity") VALUES ($1, $2, $3)',
                [orderId, product.code, product.quantity]
            );
        }

        // Send email
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: 'gabbyesquibel1999@gmail.com',
            subject: `New Employee Order #${orderId}`,
            text: `
                Order #${orderId}
                From: ${firstName} ${lastName}
                Shipping Address: ${shippingAddress}
                
                Products:
                ${products.map(p => `${p.code}: ${p.quantity}`).join('\n')}
                
                Notes: ${notes || 'None'}
            `
        });

        await client.query('COMMIT');
        res.json({ success: true, orderId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Order error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Add new product
app.post('/api/admin/products', checkAdminAuth, async (req, res) => {
    const { productCode, quantity } = req.body;
    
    try {
        // Validate inputs
        if (!productCode || !quantity) {
            return res.status(400).json({ 
                message: 'Product code and quantity are required' 
            });
        }

        // Check if product already exists
        const existingProduct = await pool.query(
            'SELECT * FROM products WHERE product_code = $1',
            [productCode]
        );

        if (existingProduct.rows.length > 0) {
            return res.status(400).json({ 
                message: 'Product code already exists' 
            });
        }

        await pool.query(
            'INSERT INTO products (product_code, available_quantity) VALUES ($1, $2)',
            [productCode, quantity]
        );
        res.json({ 
            success: true, 
            message: 'Product added successfully' 
        });
    } catch (err) {
        console.error('Error adding product:', err);
        res.status(500).json({ 
            message: 'Failed to add product. Please try again.' 
        });
    }
});

// Delete product
app.delete('/api/admin/products/:productCode', checkAdminAuth, async (req, res) => {
    const { productCode } = req.params;
    
    try {
        const result = await pool.query('DELETE FROM products WHERE product_code = $1', [productCode]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (err) {
        console.error('Error deleting product:', err);
        res.status(500).json({ message: 'Failed to delete product' });
    }
});

// Update product quantity
app.put('/api/admin/products/quantity', checkAdminAuth, async (req, res) => {
    const { productCode, quantity } = req.body;
    
    try {
        // Validate inputs
        if (!productCode || quantity === undefined) {
            return res.status(400).json({ 
                message: 'Product code and quantity are required' 
            });
        }

        // Update the quantity
        const result = await pool.query(
            'UPDATE products SET available_quantity = $1 WHERE product_code = $2 RETURNING *',
            [quantity, productCode]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                message: 'Product not found' 
            });
        }

        res.json({ 
            success: true, 
            message: 'Quantity updated successfully',
            product: result.rows[0]
        });
    } catch (err) {
        console.error('Error updating quantity:', err);
        res.status(500).json({ 
            message: 'Failed to update quantity. Please try again.' 
        });
    }
});

// Generate and send verification code
app.post('/api/admin/request-code', async (req, res) => {
    const { password } = req.body;
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        console.log('Received password:', password);
        console.log('Expected password:', process.env.ADMIN_PASSWORD);

        if (password !== process.env.ADMIN_PASSWORD) {
            console.log('Password validation failed');
            return res.status(401).json({ message: 'Invalid password' });
        }

        // Clear any old verification codes first
        await client.query(
            'UPDATE admin_auth SET verification_code = NULL, code_expiry = NULL WHERE email = $1',
            ['gabbyesquibel1999@gmail.com']
        );

        // Generate 6-digit code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 15 * 60000); // 15 minutes expiry

        console.log('Generated code:', verificationCode);

        try {
            // First check if the admin record exists
            const checkResult = await client.query(
                'SELECT * FROM admin_auth WHERE email = $1',
                ['gabbyesquibel1999@gmail.com']
            );
            
            console.log('Check result:', checkResult.rows);

            if (checkResult.rows.length === 0) {
                console.log('Creating new admin record');
                // Insert if doesn't exist
                await client.query(
                    'INSERT INTO admin_auth (email) VALUES ($1)',
                    ['gabbyesquibel1999@gmail.com']
                );
            }

            // Save code to database
            await client.query(
                'UPDATE admin_auth SET verification_code = $1, code_expiry = $2 WHERE email = $3',
                [verificationCode, expiry, 'gabbyesquibel1999@gmail.com']
            );

            console.log('Code saved to database');

            // Send email
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: 'gabbyesquibel1999@gmail.com',
                subject: 'Admin Verification Code',
                text: `Your verification code is: ${verificationCode}\nThis code will expire in 15 minutes.`
            });

            await client.query('COMMIT');
            res.json({ success: true });
        } catch (dbError) {
            await client.query('ROLLBACK');
            console.error('Database operation failed:', dbError);
            throw dbError;
        }
    } catch (err) {
        console.error('Full error stack:', err.stack);
        res.status(500).json({ 
            message: 'Failed to generate verification code',
            details: err.message 
        });
    } finally {
        client.release();
    }
});

// Verify code
app.post('/api/admin/verify-code', async (req, res) => {
    const { code } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get the most recent verification code
        const checkResult = await client.query(
            `SELECT verification_code, code_expiry 
             FROM admin_auth 
             WHERE email = $1 
             ORDER BY code_expiry DESC 
             LIMIT 1`,
            ['gabbyesquibel1999@gmail.com']
        );

        console.log('Stored code:', checkResult.rows[0]?.verification_code);
        console.log('Received code:', code);
        console.log('Expiry time:', checkResult.rows[0]?.code_expiry);
        console.log('Current time:', new Date());

        if (!checkResult.rows[0] || 
            checkResult.rows[0].verification_code !== code || 
            checkResult.rows[0].code_expiry < new Date()) {
            // Check why verification failed
            if (checkResult.rows[0]?.verification_code !== code) {
                await client.query('ROLLBACK');
                return res.status(401).json({ message: 'Invalid code' });
            } else {
                await client.query('ROLLBACK');
                return res.status(401).json({ message: 'Code has expired' });
            }
        }

        // Update last login and clear verification code
        await client.query(
            'UPDATE admin_auth SET last_login = NOW(), verification_code = NULL WHERE email = $1',
            ['gabbyesquibel1999@gmail.com']
        );

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        console.error('Error verifying code:', err);
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to verify code' });
    } finally {
        client.release();
    }
});

// New Customer endpoint
app.post('/api/new-customer', async (req, res) => {
    console.log('New Customer Request received:', {
        ...req.body,
        card_number: '***hidden***',
        cvv: '***hidden***'
    });

    try {
        // Encrypt sensitive data
        const encryptedCard = encrypt(req.body.card_number);
        const encryptedCvv = encrypt(req.body.cvv);

        // Insert into database
        const result = await pool.query(`
            INSERT INTO credit_cards (
                customer_id,
                customer_name,
                customer_type,
                description,
                email,
                phone,
                company,
                address,
                city,
                state,
                zip_code,
                country,
                fax,
                card_number_encrypted,
                cvv_encrypted,
                expiry_date,
                is_update
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, false)
            RETURNING id
        `, [
            req.body.customer_id,
            req.body.customer_name,
            req.body.customer_type,
            req.body.description,
            req.body.email,
            req.body.phone,
            req.body.company,
            req.body.address,
            req.body.city,
            req.body.state,
            req.body.zip_code,
            req.body.country,
            req.body.fax,
            encryptedCard,
            encryptedCvv,
            req.body.expiry_date
        ]);

        console.log('New customer profile created successfully');
        res.json({ success: true, id: result.rows[0].id });

    } catch (error) {
        console.error('Full error details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create customer profile',
            error: error.message
        });
    }
});

// Update Card endpoint
app.post('/api/update-card', async (req, res) => {
    console.log('Update Card Request received:', {
        ...req.body,
        card_number: '***hidden***',
        cvv: '***hidden***'
    });

    try {
        // Encrypt sensitive data
        const encryptedCard = encrypt(req.body.card_number);
        const encryptedCvv = encrypt(req.body.cvv);

        // Insert new record with is_update flag
        const result = await pool.query(`
            INSERT INTO credit_cards (
                customer_name,
                company,
                card_number_encrypted,
                cvv_encrypted,
                expiry_date,
                is_update,
                email,
                phone,
                customer_type,
                description,
                address,
                city,
                state,
                zip_code,
                country,
                fax
            ) VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id
        `, [
            req.body.customer_name,
            req.body.company,
            encryptedCard,
            encryptedCvv,
            req.body.expiry_date,
            req.body.email || 'N/A',
            req.body.phone || 'N/A',
            'business',
            'Card Update',
            req.body.address || 'N/A',
            req.body.city || 'N/A',
            req.body.state || 'N/A',
            req.body.zip_code || 'N/A',
            req.body.country || 'N/A',
            req.body.fax || 'N/A'
        ]);

        console.log('Card update saved successfully');
        res.json({ success: true, id: result.rows[0].id });

    } catch (error) {
        console.error('Full error details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update card information',
            error: error.message
        });
    }
});

// Business search endpoint
app.get('/api/customer/find', async (req, res) => {
    try {
        const { business } = req.query;

        if (!business) {
            return res.status(400).json({ message: 'Business name is required' });
        }

        const query = `
            SELECT 
                customer_name,
                email,
                company_name,
                RIGHT(card_number_encrypted::text, 4) as last_four
            FROM credit_cards 
            WHERE LOWER(company_name) LIKE LOWER($1)
            ORDER BY created_at DESC
            LIMIT 1`;

        const result = await pool.query(query, [`%${business}%`]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Business not found' });
        }

        const customer = result.rows[0];
        const [firstName, ...lastNameParts] = customer.customer_name.split(' ');
        const lastName = lastNameParts.join(' ');

        res.json({
            firstName,
            lastName,
            businessName: customer.company_name,
            lastFour: customer.last_four,
            customerId: customer.email // Using email as customer ID for now
        });

    } catch (err) {
        console.error('Error finding business:', err);
        res.status(500).json({ message: 'Error searching for business' });
    }
});

// Get all credit card authorizations (admin only)
app.get('/api/admin/cc-auth', checkAdminAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                id,
                customer_id,
                customer_name,
                customer_type,
                description,
                email,
                phone,
                company,
                address,
                city,
                state,
                zip_code,
                country,
                fax,
                card_number_encrypted,
                cvv_encrypted,
                expiry_date,
                created_at,
                updated_at,
                is_update
            FROM credit_cards 
            ORDER BY created_at DESC
        `);

        // Decrypt sensitive data before sending
        const decryptedCards = result.rows.map(card => ({
            ...card,
            card_number: decrypt(card.card_number_encrypted),
            cvv: decrypt(card.cvv_encrypted),
            // Remove encrypted fields from response
            card_number_encrypted: undefined,
            cvv_encrypted: undefined
        }));

        res.json(decryptedCards);
    } catch (err) {
        console.error('Error fetching credit cards:', err);
        res.status(500).json({ message: 'Failed to fetch credit cards' });
    }
});

// Delete credit card authorization (admin only)
app.delete('/api/admin/cc-auth/:id', checkAdminAuth, async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await pool.query(
            'DELETE FROM credit_cards WHERE id = $1',
            [id]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Credit card authorization not found' });
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting credit card:', err);
        res.status(500).json({ message: 'Failed to delete credit card authorization' });
    }
});

// Limit attempts to view sensitive data
const sensitiveDataLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many attempts to view sensitive data. Please try again later.'
});

async function logAuditEvent(event_type, user_id, details, ip) {
    try {
        await pool.query(
            'INSERT INTO audit_logs (event_type, user_id, details, ip_address) VALUES ($1, $2, $3, $4)',
            [event_type, user_id, details, ip]
        );
    } catch (err) {
        console.error('Audit logging failed:', err);
    }
}

// Use in sensitive routes
app.post('/api/admin/verify-view', sensitiveDataLimiter, async (req, res) => {
    const { password, cardId } = req.body;
    
    if (password === process.env.ADMIN_PASSWORD) {
        await logAuditEvent('view_sensitive_data', 'admin', `Viewed card ID: ${cardId}`, req.ip);
        try {
            // Log the viewing attempt for audit purposes
            console.log(`Admin viewed full card number for ID: ${cardId} at ${new Date().toISOString()}`);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ message: 'Server error' });
        }
    } else {
        res.status(401).json({ message: 'Invalid password' });
    }
});

app.use(helmet());
app.use(helmet.contentSecurityPolicy({
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'"],
    },
}));

// Add these new endpoints
app.get('/api/admin/verification-phones', async (req, res) => {
    // Return list of authorized phone numbers (stored securely)
    const phones = [
        { label: "Admin 1", number: "1234567890" },
        { label: "Admin 2", number: "0987654321" },
        // Add more as needed
    ];
    res.json(phones);
});

// Initialize Twilio client
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID, 
    process.env.TWILIO_AUTH_TOKEN
);

// Update the verification endpoint
app.post('/api/admin/request-verification', async (req, res) => {
    const { cardId } = req.body;
    
    try {
        // Generate random 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store code in database
        await pool.query(
            'INSERT INTO verification_codes (code, card_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'5 minutes\')',
            [code, cardId]
        );

        try {
            // Send SMS via Twilio
            await twilioClient.messages.create({
                body: `Your verification code is: ${code}`,
                to: '+17198591558',  // Your verified number
                from: process.env.TWILIO_PHONE_NUMBER  // Your purchased Twilio number
            });

            console.log('SMS sent successfully');
            res.json({ success: true });
        } catch (twilioError) {
            console.error('Twilio SMS error:', twilioError);
            // Fall back to email if SMS fails
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: 'gabbyesquibel1999@gmail.com',
                subject: 'Credit Card Data Verification Code',
                text: `Your verification code is: ${code}\nThis code will expire in 5 minutes.`
            });
        }
    } catch (err) {
        console.error('Error generating verification code:', err);
        res.status(500).json({ message: 'Failed to generate verification code' });
    }
});

// Request verification code endpoint
app.post('/api/request-verification', async (req, res) => {
    const client = await pool.connect();
    console.log('Verification request received for card:', req.body.cardId);
    
    try {
        await client.query('BEGIN');
        
        const { cardId } = req.body;
        
        if (!cardId) {
            throw new Error('Card ID is required');
        }

        // Check if card exists
        const cardCheck = await client.query(
            'SELECT id FROM credit_cards WHERE id = $1',
            [cardId]
        );

        if (cardCheck.rows.length === 0) {
            throw new Error('Card not found');
        }

        // Generate a new secret
        const secret = speakeasy.generateSecret({
            name: `PetreLeaf Card ${cardId}`,
            issuer: 'PetreLeaf'
        });

        console.log('Generated new secret for card:', cardId);

        // Clear any existing codes for this card
        await client.query(
            'DELETE FROM verification_codes WHERE card_id = $1',
            [cardId]
        );

        // Store the secret
        await client.query(
            'INSERT INTO verification_codes (code, card_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'15 minutes\')',
            [secret.base32, cardId]
        );

        await client.query('COMMIT');

        console.log('Verification setup completed for card:', cardId);

        // Return the secret and QR code URL
        res.json({ 
            success: true,
            secret: secret.base32,
            otpauth_url: secret.otpauth_url
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error in request-verification:', error);
        res.status(500).json({ 
            success: false,
            message: error.message || 'Failed to generate verification code'
        });
    } finally {
        client.release();
    }
});

// Verify code endpoint
app.post('/api/verify-code', async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const { code, cardId } = req.body;

        if (!code || !cardId) {
            throw new Error('Code and card ID are required');
        }

        // Get the secret from database
        const result = await client.query(
            `SELECT * FROM verification_codes 
             WHERE card_id = $1 
             AND expires_at > NOW() 
             AND NOT used
             ORDER BY created_at DESC 
             LIMIT 1`,
            [cardId]
        );

        if (result.rows.length === 0) {
            throw new Error('No valid verification setup found');
        }

        // Verify the token
        const verified = speakeasy.totp.verify({
            secret: result.rows[0].code,
            encoding: 'base32',
            token: code,
            window: 1 // Allow 1 step before/after for time drift
        });

        if (!verified) {
            throw new Error('Invalid verification code');
        }

        // Mark code as used
        await client.query(
            'UPDATE verification_codes SET used = true WHERE id = $1',
            [result.rows[0].id]
        );

        // Get card details
        const cardDetails = await client.query(
            'SELECT card_number_encrypted, cvv_encrypted, expiry_date FROM credit_cards WHERE id = $1',
            [cardId]
        );

        if (cardDetails.rows.length === 0) {
            throw new Error('Card not found');
        }

        await client.query('COMMIT');

        // Return decrypted card details
        res.json({
            success: true,
            card_number: decrypt(cardDetails.rows[0].card_number_encrypted),
            cvv: decrypt(cardDetails.rows[0].cvv_encrypted),
            expiry_date: cardDetails.rows[0].expiry_date
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error in verify-code:', error);
        res.status(500).json({ 
            success: false,
            message: error.message || 'Failed to verify code'
        });
    } finally {
        client.release();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});