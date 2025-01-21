require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

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
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Get available products
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching products:', err);
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

        // Insert order
        const orderResult = await client.query(
            'INSERT INTO orders (first_name, last_name, shipping_address, notes) VALUES ($1, $2, $3, $4) RETURNING id',
            [firstName, lastName, shippingAddress, notes]
        );
        
        const orderId = orderResult.rows[0].id;

        // Insert order items
        for (let product of products) {
            await client.query(
                'INSERT INTO order_items (order_id, product_code, quantity) VALUES ($1, $2, $3)',
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
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Admin middleware to check password
const checkAdminAuth = (req, res, next) => {
    const password = req.body?.password;
    if (password === process.env.ADMIN_PASSWORD) {
        next();
    } else {
        res.status(401).json({ message: 'Invalid admin password' });
    }
};

// Admin login
app.post('/api/admin/login', (req, res) => {
    const password = req.body.password;
    if (password === process.env.ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid password' });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 