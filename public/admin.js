document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('login-section');
    const adminSection = document.getElementById('admin-section');
    const loginForm = document.getElementById('loginForm');
    const productForm = document.getElementById('productForm');
    const productsList = document.getElementById('productsList');

    // Handle login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });

            if (response.ok) {
                loginSection.style.display = 'none';
                adminSection.style.display = 'block';
                loadProducts();
            } else {
                alert('Invalid password');
            }
        } catch (err) {
            alert('Error logging in: ' + err.message);
        }
    });

    // Load products
    async function loadProducts() {
        try {
            const response = await fetch('/api/products');
            if (!response.ok) {
                throw new Error('Failed to fetch products');
            }
            const products = await response.json();
            
            if (!Array.isArray(products)) {
                throw new Error('Invalid products data received');
            }
            
            productsList.innerHTML = products.map(product => `
                <div class="product-item">
                    <span>${product.product_code}</span>
                    <div class="quantity-controls">
                        <button class="quantity-btn minus">-</button>
                        <input type="number" value="${product.available_quantity}" min="0" class="quantity-input">
                        <button class="quantity-btn plus">+</button>
                        <button class="save-btn">Save</button>
                    </div>
                    <button onclick="deleteProduct('${product.product_code}')" class="delete-btn">Delete</button>
                </div>
            `).join('');

            // Add event listeners for quantity controls
            productsList.querySelectorAll('.product-item').forEach(item => {
                const input = item.querySelector('.quantity-input');
                const saveBtn = item.querySelector('.save-btn');
                const originalValue = input.value;

                // Handle plus/minus buttons
                item.querySelector('.minus').addEventListener('click', () => {
                    input.value = Math.max(0, parseInt(input.value) - 1);
                    saveBtn.disabled = input.value === originalValue;
                });

                item.querySelector('.plus').addEventListener('click', () => {
                    input.value = parseInt(input.value) + 1;
                    saveBtn.disabled = input.value === originalValue;
                });

                // Handle manual input
                input.addEventListener('change', () => {
                    input.value = Math.max(0, parseInt(input.value) || 0);
                    saveBtn.disabled = input.value === originalValue;
                });

                // Handle save button
                saveBtn.addEventListener('click', async () => {
                    const productCode = item.querySelector('span').textContent;
                    const newQuantity = parseInt(input.value);
                    
                    try {
                        const response = await fetch('/api/admin/products/quantity', {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                productCode,
                                quantity: newQuantity,
                                password: document.getElementById('password').value
                            })
                        });

                        if (response.ok) {
                            alert('Quantity updated successfully!');
                            saveBtn.disabled = true;
                        } else {
                            const error = await response.json();
                            alert('Error: ' + error.message);
                        }
                    } catch (err) {
                        console.error('Error updating quantity:', err);
                        alert('Error updating quantity: ' + err.message);
                    }
                });
            });
        } catch (err) {
            console.error('Error loading products:', err);
            alert('Error loading products: ' + err.message);
            productsList.innerHTML = '<p>Error loading products. Please try again.</p>';
        }
    }

    // Add new product
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const productData = {
            productCode: document.getElementById('productCode').value,
            quantity: parseInt(document.getElementById('quantity').value),
            password: document.getElementById('password').value
        };

        try {
            const response = await fetch('/api/admin/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productData)
            });

            const result = await response.json();
            
            if (response.ok) {
                productForm.reset();
                loadProducts();
                alert('Product added successfully!');
            } else {
                alert('Error: ' + (result.message || 'Failed to add product'));
            }
        } catch (err) {
            console.error('Error adding product:', err);
            alert('Error adding product: ' + err.message);
        }
    });

    // Delete product function
    window.deleteProduct = async (productCode) => {
        if (!confirm(`Are you sure you want to delete ${productCode}?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/products/${productCode}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    password: document.getElementById('password').value
                })
            });

            if (response.ok) {
                loadProducts();
                alert('Product deleted successfully!');
            } else {
                const error = await response.json();
                alert('Error deleting product: ' + error.message);
            }
        } catch (err) {
            console.error('Error deleting product:', err);
            alert('Error deleting product: ' + err.message);
        }
    };
}); 