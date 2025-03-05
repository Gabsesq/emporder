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
            const firstName = document.getElementById('firstName').value.trim();
            const lastName = document.getElementById('lastName').value.trim();
            const email = document.getElementById('email').value.trim();
            const phone = document.getElementById('phone').value.replace(/\D/g, '');
            const company = document.getElementById('company').value.trim();
            const customerId = document.getElementById('customerId').value.trim();
            const customerType = document.getElementById('customerType').value;
            const description = document.getElementById('description').value.trim();

            const formData = {
                customer_id: customerId || 'N/A',
                customer_name: `${firstName} ${lastName}`,
                customer_type: customerType || 'N/A',
                description: description || 'N/A',
                email: email,
                phone: phone,
                company: company || 'N/A',
                // Billing address
                address: document.getElementById('address').value.trim() || 'N/A',
                city: document.getElementById('city').value.trim() || 'N/A',
                state: document.getElementById('state').value.trim() || 'N/A',
                zip_code: document.getElementById('zipCode').value.trim() || 'N/A',
                country: document.getElementById('country').value.trim() || 'N/A',
                fax: document.getElementById('fax').value.trim() || 'N/A',
                // Payment info
                card_number: cardNumber,
                cvv: cvv,
                expiry_date: document.getElementById('expiryDate').value.trim(),
                // Additional fields
                first_name: firstName,
                last_name: lastName,
                is_update: false
            };

            // Add shipping information if different from billing
            if (!document.getElementById('sameAsBilling').checked) {
                formData.shipping = {
                    first_name: document.getElementById('shippingFirstName').value.trim(),
                    last_name: document.getElementById('shippingLastName').value.trim(),
                    company: document.getElementById('shippingCompany').value.trim(),
                    address: document.getElementById('shippingAddress').value.trim(),
                    city: document.getElementById('shippingCity').value.trim(),
                    state: document.getElementById('shippingState').value.trim(),
                    zip_code: document.getElementById('shippingZipCode').value.trim(),
                    country: document.getElementById('shippingCountry').value.trim(),
                    phone: document.getElementById('shippingPhone').value.replace(/\D/g, ''),
                    fax: document.getElementById('shippingFax').value.trim()
                };
            }

            // Add shipping profile flag
            formData.create_shipping_profile = document.getElementById('createShippingProfile').checked;

            console.log('Form data prepared:', {
                ...formData,
                card_number: '***hidden***',
                cvv: '***hidden***'
            });

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
            
            console.log('Form submission started');
            
            const businessName = document.getElementById('updateBusinessName').value.trim();
            const cardNumber = updateCardNumber.value.replace(/\D/g, '');
            const cvv = updateCvv.value;
            const expiryDate = updateExpiryDate.value;
            const email = document.getElementById('updateEmail').value.trim();
            const phone = document.getElementById('updatePhone').value.replace(/\D/g, '');

            // Validate required fields
            if (!businessName || !cardNumber || !cvv || !expiryDate) {
                console.error('Missing required fields:', {
                    businessName: !!businessName,
                    cardNumber: !!cardNumber,
                    cvv: !!cvv,
                    expiryDate: !!expiryDate
                });
                alert('Please fill in all required fields (Business Name and Card Information).');
                return;
            }

            // Match the format expected by the server (similar to new customer form)
            const formData = {
                customer_name: businessName,
                company: businessName,
                card_number: cardNumber,
                cvv: cvv,
                expiry_date: expiryDate,
                email: email || businessName.toLowerCase().replace(/\s+/g, '') + '@company.com',  // Use business email if not provided
                phone: phone || 'N/A',           // Use N/A if not provided
                is_update: true,
                // Default values for optional fields
                customer_id: 'N/A',
                customer_type: 'N/A',
                description: 'N/A',
                address: 'N/A',
                city: 'N/A',
                state: 'N/A',
                zip_code: 'N/A',
                country: 'N/A',
                fax: 'N/A'
            };

            // Add billing address if provided
            if (document.getElementById('newBillingSection').style.display !== 'none') {
                const address = document.getElementById('updateAddress').value.trim();
                const city = document.getElementById('updateCity').value.trim();
                const state = document.getElementById('updateState').value.trim();
                const zipCode = document.getElementById('updateZipCode').value.trim();
                const country = document.getElementById('updateCountry').value.trim();

                // Only add billing address if all fields are filled
                if (address && city && state && zipCode && country) {
                    formData.address = address;
                    formData.city = city;
                    formData.state = state;
                    formData.zip_code = zipCode;
                    formData.country = country;
                }
            }

            console.log('Submitting form data:', { 
                ...formData, 
                card_number: '***hidden***', 
                cvv: '***hidden***'
            });

            try {
                const response = await fetch('/api/cc-auth', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to update card information');
                }

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
            } catch (err) {
                console.error('Submission error:', err);
                alert('Error updating card information: ' + err.message);
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