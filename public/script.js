document.addEventListener('DOMContentLoaded', async () => {
    const productsList = document.getElementById('productsList');
    const selectedCountSpan = document.getElementById('selectedCount');
    const form = document.getElementById('orderForm');

    // Fetch products from server
    const response = await fetch('/api/products');
    const products = await response.json();

    // Render products
    products.forEach(product => {
        const div = document.createElement('div');
        div.className = 'product-item';
        div.innerHTML = `
            <span>${product.product_code} (${product.available_quantity} available)</span>
            <div class="quantity-controls">
                <button type="button" class="minus">-</button>
                <input type="number" value="0" min="0" max="${product.available_quantity}">
                <button type="button" class="plus">+</button>
            </div>
        `;
        productsList.appendChild(div);
    });

    // Handle quantity changes
    productsList.addEventListener('click', (e) => {
        if (!e.target.matches('button')) return;
        
        const input = e.target.parentElement.querySelector('input');
        const currentValue = parseInt(input.value);
        
        if (e.target.classList.contains('plus')) {
            if (getSelectedCount() >= 3) return;
            input.value = Math.min(currentValue + 1, parseInt(input.max));
        } else {
            input.value = Math.max(currentValue - 1, 0);
        }
        
        updateSelectedCount();
    });

    function getSelectedCount() {
        return Array.from(productsList.querySelectorAll('input'))
            .filter(input => parseInt(input.value) > 0).length;
    }

    function updateSelectedCount() {
        selectedCountSpan.textContent = getSelectedCount();
    }

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const selectedProducts = Array.from(productsList.querySelectorAll('.product-item'))
            .map(item => ({
                code: item.querySelector('span').textContent.split(' ')[0],
                quantity: parseInt(item.querySelector('input').value)
            }))
            .filter(product => product.quantity > 0);

        if (selectedProducts.length > 3) {
            alert('Please select a maximum of 3 products');
            return;
        }

        const orderData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            shippingAddress: document.getElementById('shippingAddress').value,
            notes: document.getElementById('notes').value,
            products: selectedProducts
        };

        try {
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderData)
            });

            const result = await response.json();
            
            if (result.success) {
                alert('Order submitted successfully!');
                form.reset();
                productsList.querySelectorAll('input').forEach(input => input.value = 0);
                updateSelectedCount();
            } else {
                alert('Error submitting order: ' + result.error);
            }
        } catch (err) {
            alert('Error submitting order: ' + err.message);
        }
    });
}); 