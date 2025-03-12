document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('newCustomerForm');
    
    // Add input formatters
    document.getElementById('cardNumber').addEventListener('input', (e) => formatCardNumber(e.target));
    document.getElementById('expiryDate').addEventListener('input', (e) => formatExpiryDate(e.target));
    document.getElementById('phone').addEventListener('input', (e) => formatPhoneNumber(e.target));
    document.getElementById('cvv').addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            // Validate card details
            const cardNumber = document.getElementById('cardNumber').value.replace(/\D/g, '');
            const cvv = document.getElementById('cvv').value;
            const expiryDate = document.getElementById('expiryDate').value;

            if (!validateCardNumber(cardNumber)) {
                showMessage('error', 'Invalid card number', form);
                return;
            }

            if (!validateCVV(cvv)) {
                showMessage('error', 'Invalid CVV', form);
                return;
            }

            if (!validateExpiryDate(expiryDate)) {
                showMessage('error', 'Invalid expiry date', form);
                return;
            }

            // Collect form data
            const formData = {
                business_name: document.getElementById('businessName').value.trim(),
                first_name: document.getElementById('firstName').value.trim(),
                last_name: document.getElementById('lastName').value.trim(),
                customer_name: `${document.getElementById('firstName').value.trim()} ${document.getElementById('lastName').value.trim()}`,
                customer_type: document.getElementById('customerType').value,
                description: document.getElementById('description').value.trim() || 'N/A',
                email: document.getElementById('email').value.trim(),
                phone: document.getElementById('phone').value.replace(/\D/g, ''),
                company: document.getElementById('company').value.trim() || 'N/A',
                address: document.getElementById('address').value.trim(),
                city: document.getElementById('city').value.trim(),
                state: document.getElementById('state').value.trim(),
                zip_code: document.getElementById('zipCode').value.trim(),
                country: document.getElementById('country').value.trim(),
                fax: document.getElementById('fax').value.trim() || 'N/A',
                card_number: cardNumber,
                cvv: cvv,
                expiry_date: expiryDate,
                is_update: false
            };

            console.log('Submitting form data:', {
                ...formData,
                card_number: '****' + formData.card_number.slice(-4),
                cvv: '***'
            });

            const response = await fetch('/api/new-customer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to submit authorization');
            }

            if (data.success) {
                showMessage('success', 'Customer profile created successfully!', form);
                form.reset();
            } else {
                throw new Error(data.message || 'Failed to create customer profile');
            }

        } catch (error) {
            console.error('Submission error:', error);
            showMessage('error', error.message || 'Failed to submit authorization', form);
        }
    });
}); 