document.addEventListener('DOMContentLoaded', async () => {
    const productForm = document.getElementById('productForm');
    const productsList = document.getElementById('productsList');
    const saveAllButton = document.getElementById('saveAllButton');

    // Load products immediately
    await loadProducts();

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
                        <input type="number" value="${product.available_quantity}" min="0" class="quantity-input" data-original="${product.available_quantity}">
                        <button class="quantity-btn plus">+</button>
                    </div>
                    <button onclick="deleteProduct('${product.product_code}')" class="delete-btn">Delete</button>
                </div>
            `).join('');

            // Add event listeners for quantity controls
            productsList.querySelectorAll('.product-item').forEach(item => {
                const input = item.querySelector('.quantity-input');
                
                item.querySelector('.minus').addEventListener('click', () => {
                    input.value = Math.max(0, parseInt(input.value) - 1);
                    checkForChanges();
                });

                item.querySelector('.plus').addEventListener('click', () => {
                    input.value = parseInt(input.value) + 1;
                    checkForChanges();
                });

                input.addEventListener('change', () => {
                    input.value = Math.max(0, parseInt(input.value) || 0);
                    checkForChanges();
                });
            });

        } catch (err) {
            console.error('Error loading products:', err);
            productsList.innerHTML = '<p>Error loading products. Please try again.</p>';
        }
    }

    function checkForChanges() {
        const items = productsList.querySelectorAll('.product-item');
        let hasChanges = false;
        
        items.forEach(item => {
            const input = item.querySelector('.quantity-input');
            const originalValue = input.getAttribute('data-original');
            if (input.value !== originalValue) {
                hasChanges = true;
            }
        });
        
        saveAllButton.disabled = !hasChanges;
    }

    // Add new product
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const productData = {
            productCode: document.getElementById('productCode').value,
            quantity: parseInt(document.getElementById('quantity').value),
            password: 'gabsgibs'
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
                    password: 'gabsgibs'
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

    // Save all changes
    saveAllButton.addEventListener('click', async () => {
        const updates = [];
        const items = productsList.querySelectorAll('.product-item');
        
        items.forEach(item => {
            const productCode = item.querySelector('span').textContent;
            const newQuantity = parseInt(item.querySelector('.quantity-input').value);
            const originalQuantity = parseInt(item.querySelector('.quantity-input').getAttribute('data-original'));
            
            if (newQuantity !== originalQuantity) {
                updates.push({ productCode, quantity: newQuantity });
            }
        });
        
        try {
            const promises = updates.map(update => 
                fetch('/api/admin/products/quantity', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        productCode: update.productCode,
                        quantity: update.quantity,
                        password: 'gabsgibs'
                    })
                })
            );
            
            const results = await Promise.all(promises);
            const allSuccessful = results.every(response => response.ok);
            
            if (allSuccessful) {
                alert('All quantities updated successfully!');
                loadProducts(); // Refresh the list
            } else {
                alert('Some updates failed. Please try again.');
            }
        } catch (err) {
            console.error('Error updating quantities:', err);
            alert('Error updating quantities: ' + err.message);
        }
    });
}); 