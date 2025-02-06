document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('ccAuthForm');
    const cardNumber = document.getElementById('cardNumber');
    const expiryDate = document.getElementById('expiryDate');
    const cvv = document.getElementById('cvv');
    const phone = document.getElementById('phone');

    // Format card number as user types
    cardNumber.addEventListener('input', (e) => {
        // Remove non-digits and spaces
        let value = e.target.value.replace(/\D/g, '');
        
        // Add spaces every 4 digits
        let formatted = '';
        for (let i = 0; i < value.length; i++) {
            if (i > 0 && i % 4 === 0) {
                formatted += ' ';
            }
            formatted += value[i];
        }
        
        e.target.value = formatted.slice(0, 19); // 16 digits + 3 spaces
    });

    // Format expiry date as MM/YY
    expiryDate.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 2) {
            value = value.slice(0, 2) + '/' + value.slice(2);
        }
        e.target.value = value.slice(0, 5);
    });

    // Only allow numbers in CVV
    cvv.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
    });

    // Format phone number
    phone.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
    });

    function validateCardNumber(number) {
        // Remove spaces and non-digits
        number = number.replace(/[\s\-]/g, '');
        
        // Test card number format (starts with valid prefix and has correct length)
        const cardPatterns = {
            visa: /^4[0-9]{12}(?:[0-9]{3})?$/,
            mastercard: /^5[1-5][0-9]{14}$/,
            amex: /^3[47][0-9]{13}$/,
            discover: /^6(?:011|5[0-9]{2})[0-9]{12}$/
        };

        const isValidFormat = Object.values(cardPatterns).some(pattern => pattern.test(number));
        if (!isValidFormat) {
            alert('Please enter a valid Visa, Mastercard, Amex, or Discover card number');
            return false;
        }

        // Luhn algorithm implementation
        function luhnCheck(val) {
            let sum = 0;
            let isEven = false;
            
            // Loop through values starting from the rightmost side
            for (let i = val.length - 1; i >= 0; i--) {
                let digit = parseInt(val[i], 10);

                if (isEven) {
                    digit *= 2;
                    if (digit > 9) {
                        digit -= 9;
                    }
                }

                sum += digit;
                isEven = !isEven;
            }
            
            return (sum % 10) === 0;
        }

        return luhnCheck(number);
    }

    function validateCVV(cvv) {
        return /^[0-9]{3,4}$/.test(cvv);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cardNumber = document.getElementById('cardNumber').value.replace(/\D/g, '');
        const cvv = document.getElementById('cvv').value;

        if (!validateCardNumber(cardNumber)) {
            return;
        }
        if (!validateCVV(cvv)) {
            alert('Invalid CVV');
            return;
        }

        const formData = {
            customerName: document.getElementById('customerName').value,
            cardNumber: cardNumber,
            expiryDate: expiryDate.value,
            cvv: cvv,
            email: document.getElementById('email').value,
            phone: phone.value
        };

        try {
            const response = await fetch('/api/cc-auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                alert('Credit card authorization submitted successfully!');
                form.reset();
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Failed to submit authorization');
            }
        } catch (err) {
            alert('Error submitting authorization: ' + err.message);
        }
    });
}); 