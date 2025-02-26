require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const twilio = require('twilio');

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
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
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
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_auth (
                id SERIAL PRIMARY KEY,
                email VARCHAR(100) NOT NULL,
                verification_code VARCHAR(6),
                code_expiry TIMESTAMP,
                last_login TIMESTAMP
            )
        `);

        // Ensure credit_cards table exists with correct structure
        await pool.query(`
            DROP TABLE IF EXISTS credit_cards;
            CREATE TABLE credit_cards (
                id SERIAL PRIMARY KEY,
                customer_name VARCHAR(100) NOT NULL,
                card_number_encrypted TEXT NOT NULL,
                cvv_encrypted TEXT NOT NULL,
                expiry_date VARCHAR(5) NOT NULL,
                email VARCHAR(100) NOT NULL,
                phone VARCHAR(20),
                company_name VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
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
        } else {
            // Ensure logged out state on server start
            await pool.query(
                'UPDATE admin_auth SET last_login = NULL WHERE email = $1',
                ['gabbyesquibel1999@gmail.com']
            );
        }

        // Add verification_codes table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS verification_codes (
                id SERIAL PRIMARY KEY,
                code VARCHAR(6) NOT NULL,
                card_id INTEGER NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Database initialization error:', err);
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
        if (products.length > 3) {
            throw new Error('Maximum 3 products allowed');
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

// Credit Card Authorization endpoint
app.post('/api/cc-auth', async (req, res) => {
    try {
        // Log the incoming request
        console.log('CC Auth Request received:', {
            ...req.body,
            card_number: '***hidden***',
            cvv: '***hidden***'
        });

        const {
            customer_name,
            card_number,
            cvv,
            expiry_date,
            email,
            phone,
            company
        } = req.body;

        // Log the extracted values
        console.log('Extracted values:', {
            customer_name,
            expiry_date,
            email,
            phone,
            company,
            hasCardNumber: !!card_number,
            hasCvv: !!cvv
        });

        // Validate required fields
        if (!customer_name || !card_number || !cvv || !expiry_date || !email) {
            console.log('Missing required fields:', {
                hasCustomerName: !!customer_name,
                hasCardNumber: !!card_number,
                hasCvv: !!cvv,
                hasExpiryDate: !!expiry_date,
                hasEmail: !!email
            });
            return res.status(400).json({ message: 'Missing required fields' });
        }

        try {
            // Log pre-encryption
            console.log('About to encrypt card data');
            
            // Encrypt sensitive data
            const cardNumberEncrypted = encrypt(card_number.toString());
            const cvvEncrypted = encrypt(cvv.toString());
            
            console.log('Encryption successful');

            const query = `
                INSERT INTO credit_cards (
                    customer_name,
                    card_number_encrypted,
                    cvv_encrypted,
                    expiry_date,
                    email,
                    phone,
                    company_name
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
            `;

            const values = [
                customer_name,
                cardNumberEncrypted,
                cvvEncrypted,
                expiry_date,
                email,
                phone || null,
                company || null
            ];

            console.log('Executing query with values:', {
                customer_name,
                email,
                phone,
                company,
                expiry_date
            });

            const result = await pool.query(query, values);
            console.log('Query executed successfully. Result:', result.rows[0]);

            res.json({
                success: true,
                message: 'Credit card authorization saved successfully',
                id: result.rows[0].id
            });

        } catch (encryptError) {
            console.error('Encryption or database error:', encryptError);
            throw encryptError;
        }

    } catch (err) {
        console.error('Full error details:', {
            name: err.name,
            message: err.message,
            stack: err.stack,
            code: err.code,
            detail: err.detail
        });
        res.status(500).json({
            message: 'Failed to process credit card authorization',
            error: err.message
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
        const result = await pool.query(
            'SELECT id, customer_name, card_number_encrypted, cvv_encrypted, expiry_date, email, phone, created_at FROM credit_cards ORDER BY created_at DESC'
        );

        // Decrypt sensitive data before sending
        const decryptedCards = result.rows.map(card => ({
            id: card.id,
            customer_name: card.customer_name,
            card_number: decrypt(card.card_number_encrypted),
            expiry_date: card.expiry_date,
            cvv: decrypt(card.cvv_encrypted),
            email: card.email,
            phone: card.phone,
            created_at: card.created_at
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});