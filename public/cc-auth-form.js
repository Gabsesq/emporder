document.addEventListener('DOMContentLoaded', () => {
    // Tab switching functionality
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent form submission
            
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(`${tabId}CustomerForm`).classList.add('active');
        });
    });

    // New Customer Form Handling
    const newCustomerForm = document.getElementById('ccAuthForm');
    if (newCustomerForm) {
    const cardNumber = document.getElementById('cardNumber');
    const expiryDate = document.getElementById('expiryDate');
    const cvv = document.getElementById('cvv');
    const phone = document.getElementById('phone');
        const sameAsBillingCheckbox = document.getElementById('sameAsBilling');
        const shippingSection = document.getElementById('shippingSection');

    // Format card number as user types
        if (cardNumber) {
    cardNumber.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        let formatted = '';
        for (let i = 0; i < value.length; i++) {
            if (i > 0 && i % 4 === 0) {
                formatted += ' ';
            }
            formatted += value[i];
        }
                e.target.value = formatted.slice(0, 19);
    });
        }

        // Format expiry date
        if (expiryDate) {
    expiryDate.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 2) {
            value = value.slice(0, 2) + '/' + value.slice(2);
        }
        e.target.value = value.slice(0, 5);
    });
        }

    // Only allow numbers in CVV
        if (cvv) {
    cvv.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
    });
        }

    // Format phone number
        if (phone) {
    phone.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
    });
        }

        sameAsBillingCheckbox.addEventListener('change', (e) => {
            shippingSection.style.display = e.target.checked ? 'none' : 'block';
            
            // Toggle required attributes on shipping fields
            const shippingFields = shippingSection.querySelectorAll('input');
            shippingFields.forEach(field => {
                if (field.id !== 'shippingFax') { // Fax is optional
                    field.required = !e.target.checked;
                }
            });

            if (e.target.checked) {
                // Clear shipping fields when using billing address
                shippingFields.forEach(field => field.value = '');
            }
        });

        function validateCardNumber(number) {
            // Remove spaces and non-digits
            number = number.replace(/[\s\-]/g, '');
            
            // Simplified validation - just check length and prefix
            if (number.length < 13 || number.length > 16) {
                alert('Card number must be between 13 and 16 digits');
                return false;
            }

            // Basic prefix check
            const firstDigit = number.charAt(0);
            if (!['3', '4', '5', '6'].includes(firstDigit)) {
                alert('Invalid card number prefix');
                return false;
            }

            // For testing purposes, accept any card number with valid length and prefix
            return true;
        }

        function validateCVV(cvv) {
            return /^[0-9]{3,4}$/.test(cvv);
        }

        newCustomerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Form submission started');
            
            const cardNumber = document.getElementById('cardNumber').value.replace(/\D/g, '');
            const cvv = document.getElementById('cvv').value;

            console.log('Card values:', { cardNumber, cvv });

            const formData = {
                customer_name: `${document.getElementById('firstName').value} ${document.getElementById('lastName').value}`,
                card_number: cardNumber,
                cvv: cvv,
                expiry_date: document.getElementById('expiryDate').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                company: document.getElementById('company').value
            };

            console.log('Form data prepared:', formData);

            try {
                const response = await fetch('/api/cc-auth', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();
                console.log('Server response:', result);

                if (response.ok) {
                    const successDiv = document.createElement('div');
                    successDiv.className = 'success-message';
                    successDiv.innerHTML = `
                        <h3>Thank you!</h3>
                        <p>Your credit card authorization has been submitted successfully.</p>
                    `;
                    
                    newCustomerForm.insertBefore(successDiv, newCustomerForm.firstChild);
                    newCustomerForm.reset();
                    
                    setTimeout(() => {
                        successDiv.remove();
                    }, 5000);
                } else {
                    throw new Error(result.message || 'Failed to submit authorization');
                }
            } catch (err) {
                console.error('Submission error:', err);
                alert('Error submitting authorization: ' + err.message);
            }
        });
    }

    // Update Card Form Handling
    const updateForm = document.getElementById('ccUpdateForm');
    const findCustomerBtn = document.getElementById('findCustomer');
    
    if (findCustomerBtn) {
        findCustomerBtn.addEventListener('click', async () => {
            const businessName = document.getElementById('existingBusiness').value;
            try {
                const response = await fetch(`/api/customer/find?business=${encodeURIComponent(businessName)}`);
                if (response.ok) {
                    const customer = await response.json();
                    
                    // Update the display fields
                    document.getElementById('customerName').textContent = 
                        `${customer.firstName} ${customer.lastName}`;
                    document.getElementById('displayCustomerId').textContent = 
                        customer.customerId;
                    document.getElementById('businessName').textContent = 
                        customer.businessName;
                    document.getElementById('currentCard').textContent += 
                        customer.lastFour;
                    
                    // Pre-fill business name if it exists
                    document.getElementById('updateBusinessName').value = 
                        customer.businessName;
                    
                    // Show the update form
                    document.getElementById('customerDetails').style.display = 'block';
                } else {
                    alert('Business not found');
                }
            } catch (err) {
                console.error('Error finding business:', err);
                alert('Error searching for business');
            }
        });
    }

    if (updateForm) {
        const updateCardNumber = document.getElementById('updateCardNumber');
        const updateExpiryDate = document.getElementById('updateExpiryDate');
        const updateCvv = document.getElementById('updateCvv');
        const sameBillingCheckbox = document.getElementById('sameBilling');
        const newBillingSection = document.getElementById('newBillingSection');

        // Format new card number
        if (updateCardNumber) {
            updateCardNumber.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                let formatted = '';
                for (let i = 0; i < value.length; i++) {
                    if (i > 0 && i % 4 === 0) {
                        formatted += ' ';
                    }
                    formatted += value[i];
                }
                e.target.value = formatted.slice(0, 19);
            });
        }

        // Format new expiry date
        if (updateExpiryDate) {
            updateExpiryDate.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length >= 2) {
                    value = value.slice(0, 2) + '/' + value.slice(2);
                }
                e.target.value = value.slice(0, 5);
            });
        }

        // Format CVV
        if (updateCvv) {
            updateCvv.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
            });
        }

        sameBillingCheckbox.addEventListener('change', (e) => {
            newBillingSection.style.display = e.target.checked ? 'none' : 'block';
            
            // Toggle required attributes on billing fields
            const billingFields = newBillingSection.querySelectorAll('input[required]');
            billingFields.forEach(field => {
                field.required = !e.target.checked;
            });
        });

        // Handle update form submission
        updateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const cardNumber = updateCardNumber.value.replace(/\D/g, '');
            const cvv = updateCvv.value;

            if (!validateCardNumber(cardNumber)) {
                return;
            }
            if (!validateCVV(cvv)) {
                alert('Invalid CVV');
                return;
            }

            const formData = {
                customer_name: document.getElementById('customerName').textContent,
                card_number: cardNumber,
                cvv: cvv,
                expiry_date: updateExpiryDate.value,
                email: document.getElementById('existingBusiness').value,
                phone: '',
                company: document.getElementById('businessName').textContent
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
                    // Show success message
                    const successDiv = document.createElement('div');
                    successDiv.className = 'success-message';
                    successDiv.innerHTML = `
                        <h3>Thank you!</h3>
                        <p>Your card information has been updated successfully.</p>
                    `;
                    
                    // Insert message at the top of the form
                    updateForm.insertBefore(successDiv, updateForm.firstChild);
                    
                    // Clear only the card fields
                    updateCardNumber.value = '';
                    updateExpiryDate.value = '';
                    updateCvv.value = '';
                    
                    // Remove success message after 5 seconds
                    setTimeout(() => {
                        successDiv.remove();
                    }, 5000);
                } else {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to submit card information');
                }
            } catch (err) {
                alert('Error submitting card information: ' + err.message);
            }
        });
    }

    // Card validation functions (used by both forms)
    function validateCardNumber(number) {
        // Remove spaces and non-digits
        number = number.replace(/[\s\-]/g, '');
        
        // Simplified validation - just check length and prefix
        if (number.length < 13 || number.length > 16) {
            alert('Card number must be between 13 and 16 digits');
            return false;
        }

        // Basic prefix check
        const firstDigit = number.charAt(0);
        if (!['3', '4', '5', '6'].includes(firstDigit)) {
            alert('Invalid card number prefix');
            return false;
        }

        // For testing purposes, accept any card number with valid length and prefix
        return true;
    }

    function validateCVV(cvv) {
        return /^[0-9]{3,4}$/.test(cvv);
    }

        function luhnCheck(val) {
            let sum = 0;
            let isEven = false;
            
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
}); 