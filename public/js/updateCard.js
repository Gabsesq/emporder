document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('updateCardForm');
    const cardNumberInput = document.getElementById('cardNumber');
    const expiryDateInput = document.getElementById('expiryDate');
    const cvvInput = document.getElementById('cvv');

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

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Get form values
        const businessName = document.getElementById('businessName').value.trim();
        const cardNumber = cardNumberInput.value.replace(/\s/g, '');
        const expiryDate = expiryDateInput.value;
        const cvv = cvvInput.value;

        // Validate business name
        if (!businessName) {
            showMessage('error', 'Please enter your business name', form);
            return;
        }

        // Validate card number
        if (!validateCardNumber(cardNumber)) {
            showMessage('error', 'Please enter a valid card number', form);
            return;
        }

        // Validate expiry date
        if (!validateExpiryDate(expiryDate)) {
            showMessage('error', 'Please enter a valid expiration date (MM/YY)', form);
            return;
        }

        // Validate CVV
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
                // Default values required by the server
                customer_id: 'N/A',
                customer_type: 'business',
                description: 'Card Update',
                email: `${businessName.toLowerCase().replace(/\s+/g, '')}@company.com`,
                phone: 'N/A',
                address: 'N/A',
                city: 'N/A',
                state: 'N/A',
                zip_code: 'N/A',
                country: 'N/A',
                fax: 'N/A'
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