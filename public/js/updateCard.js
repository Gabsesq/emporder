document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('updateCardForm');
    const cardNumberInput = document.getElementById('cardNumber');
    const expiryDateInput = document.getElementById('expiryDate');
    const cvvInput = document.getElementById('cvv');
    const phoneInput = document.getElementById('phone');

    // Add input formatters
    cardNumberInput.addEventListener('input', function() {
        formatCardNumber(this);
    });

    expiryDateInput.addEventListener('input', function() {
        formatExpiryDate(this);
    });

    cvvInput.addEventListener('input', function() {
        this.value = this.value.replace(/\D/g, '').slice(0, 4);
    });

    // Add phone formatter if it exists in your common.js
    if (phoneInput) {
        phoneInput.addEventListener('input', function() {
            formatPhoneNumber(this);
        });
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Get form values
        const businessName = document.getElementById('businessName').value.trim();
        const cardNumber = cardNumberInput.value.replace(/\s/g, '');
        const expiryDate = expiryDateInput.value;
        const cvv = cvvInput.value;

        // Get billing information
        const address = document.getElementById('address').value.trim();
        const city = document.getElementById('city').value.trim();
        const state = document.getElementById('state').value.trim();
        const zipCode = document.getElementById('zipCode').value.trim();
        const country = document.getElementById('country').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const email = document.getElementById('email').value.trim();

        // Validate required fields
        if (!businessName || !address || !city || !state || !zipCode || !country || !phone || !email) {
            showMessage('error', 'Please fill in all required fields', form);
            return;
        }

        // Existing validations
        if (!validateCardNumber(cardNumber)) {
            showMessage('error', 'Please enter a valid card number', form);
            return;
        }

        if (!validateExpiryDate(expiryDate)) {
            showMessage('error', 'Please enter a valid expiration date (MM/YY)', form);
            return;
        }

        if (!validateCVV(cvv)) {
            showMessage('error', 'Please enter a valid CVV', form);
            return;
        }

        try {
            // Format data to match server expectations
            const formData = {
                customer_name: businessName,
                company: businessName,
                card_number: cardNumber,
                cvv: cvv,
                expiry_date: expiryDate,
                is_update: true,
                // Add billing information
                address: address,
                city: city,
                state: state,
                zip_code: zipCode,
                country: country,
                phone: phone,
                email: email,
                // Other fields
                customer_type: 'business',
                description: 'Card Update'
            };

            // Log masked data for debugging
            console.log('Submitting form data:', {
                ...formData,
                card_number: '****' + formData.card_number.slice(-4),
                cvv: '***'
            });

            const response = await fetch('/api/update-card', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Failed to update card information');
            }

            showMessage('success', 'Card updated successfully!', form);
            form.reset();

            // Redirect to dashboard after success
            setTimeout(() => {
                window.location.href = '/creditcustomer.html';
            }, 2000);

        } catch (error) {
            console.error('Submission error:', error);
            showMessage('error', error.message || 'Failed to update card. Please try again.', form);
        }
    });
}); 