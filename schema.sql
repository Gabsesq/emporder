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