document.addEventListener('DOMContentLoaded', async () => {
    const productsList = document.getElementById('productsList');
    const form = document.getElementById('orderForm');
    const selectedCountSpan = document.getElementById('selectedCount');

    // Load products
    try {
        const response = await fetch('/api/available-products');
        const products = await response.json();
        
        // Render products
        products.forEach(product => {
            const div = document.createElement('div');
            div.className = 'product-item';
            div.innerHTML = `
                <span>${product.product_code} (<span class="availability">${product.available_quantity} available</span>)</span>
                <div class="quantity-controls">
                    <button type="button" class="minus">-</button>
                    <input type="number" value="0" min="0" max="${product.available_quantity}">
                    <button type="button" class="plus">+</button>
                </div>
            `;
            productsList.appendChild(div);
        });

        // Update selected count when quantities change
        productsList.addEventListener('change', updateSelectedCount);
        productsList.addEventListener('click', handleQuantityButtons);
        
        // Handle form submission
        form.addEventListener('submit', handleSubmit);
    } catch (err) {
        console.error('Error loading products:', err);
        productsList.innerHTML = '<p>Error loading products. Please try again later.</p>';
    }

    function updateSelectedCount() {
        const totalQuantity = Array.from(productsList.querySelectorAll('input[type="number"]'))
            .reduce((sum, input) => sum + parseInt(input.value), 0);
        selectedCountSpan.textContent = totalQuantity;
        return totalQuantity;
    }

    function handleQuantityButtons(e) {
        if (!e.target.matches('button')) return;
        
        const input = e.target.parentElement.querySelector('input');
        const currentValue = parseInt(input.value);
        const max = parseInt(input.max);
        
        if (e.target.classList.contains('plus')) {
            const totalQuantity = updateSelectedCount();
            
            if (totalQuantity >= 3) {
                alert('You can only select up to 3 items');
                return;
            }
            input.value = Math.min(currentValue + 1, max);
        } else {
            input.value = Math.max(currentValue - 1, 0);
        }
        
        updateSelectedCount();
    }

    async function handleSubmit(e) {
        e.preventDefault();
        
        const totalQuantity = updateSelectedCount();
        if (totalQuantity > 3) {
            alert('You can only order up to 3 items total');
            return;
        }

        const selectedProducts = Array.from(productsList.querySelectorAll('.product-item'))
            .map(item => ({
                code: item.querySelector('span').textContent.split(' ')[0],
                quantity: parseInt(item.querySelector('input').value)
            }))
            .filter(product => product.quantity > 0);

        console.log('Submitting order with products:', selectedProducts);

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
                // Show success modal
                const modal = document.getElementById('successModal');
                const closeBtn = document.getElementById('closeModal');
                modal.style.display = 'block';
                
                // Close modal when clicking the close button
                closeBtn.onclick = () => {
                    modal.style.display = 'none';
                };
                
                // Close modal when clicking outside
                window.onclick = (event) => {
                    if (event.target === modal) {
                        modal.style.display = 'none';
                    }
                };
                
                form.reset();
                productsList.querySelectorAll('input').forEach(input => input.value = 0);
                updateSelectedCount();
            } else {
                alert('Error submitting order: ' + result.error);
            }
        } catch (err) {
            alert('Error submitting order: ' + err.message);
        }
    }
}); 