CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    product_code VARCHAR(50) NOT NULL,
    available_quantity INTEGER NOT NULL
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    shipping_address TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    product_code VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL
);

CREATE TABLE admin_auth (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    verification_code VARCHAR(6),
    code_expiry TIMESTAMP,
    last_login TIMESTAMP
);

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
);

CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO admin_auth (email) VALUES ('gabbyesquibel1999@gmail.com');

-- Customer Profile table
CREATE TABLE customer_profiles (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255),
    description TEXT,
    customer_type VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Billing Information table
CREATE TABLE billing_info (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) REFERENCES customer_profiles(customer_id),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company_name VARCHAR(255),
    address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(100),
    phone VARCHAR(20),
    fax VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shipping Information table
CREATE TABLE shipping_info (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) REFERENCES customer_profiles(customer_id),
    same_as_billing BOOLEAN DEFAULT true,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company_name VARCHAR(255),
    address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(100),
    phone VARCHAR(20),
    fax VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment Information table (with encryption for sensitive data)
CREATE TABLE payment_info (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) REFERENCES customer_profiles(customer_id),
    card_number_encrypted BYTEA,
    card_last_four VARCHAR(4),
    expiry_date_encrypted BYTEA,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for common queries
CREATE INDEX idx_customer_profiles_email ON customer_profiles(email);
CREATE INDEX idx_customer_profiles_customer_id ON customer_profiles(customer_id);
CREATE INDEX idx_billing_company ON billing_info(company_name);

ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS company_name VARCHAR(255); 