document.addEventListener('DOMContentLoaded', async () => {
    const ccList = document.querySelector('.cc-list');

    async function loadCreditCards() {
        try {
            const response = await fetch('/api/admin/cc-auth');
            if (!response.ok) {
                throw new Error('Failed to fetch credit cards');
            }

            const cards = await response.json();
            console.log('Received cards from server:', cards);
            
            ccList.innerHTML = cards.map(card => {
                console.log('Processing card:', card);
                
                // Format phone number if it exists
                const formatPhone = (phone) => {
                    if (!phone || phone === 'N/A') return 'N/A';
                    const cleaned = phone.replace(/\D/g, '');
                    if (cleaned.length !== 10) return phone;
                    return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
                };

                // Create a safe card object with default values
                const safeCard = {
                    id: card.id || 'N/A',
                    customer_id: card.customer_id || 'N/A',
                    customer_name: card.customer_name || 'N/A',
                    customer_type: card.customer_type || 'N/A',
                    description: card.description || 'N/A',
                    email: card.email || 'N/A',
                    phone: formatPhone(card.phone),
                    company: card.company || 'N/A',
                    address: card.address || 'N/A',
                    city: card.city || 'N/A',
                    state: card.state || 'N/A',
                    zip_code: card.zip_code || 'N/A',
                    country: card.country || 'N/A',
                    fax: card.fax || 'N/A',
                    card_number: card.card_number || 'N/A',
                    cvv: card.cvv || 'N/A',
                    expiry_date: card.expiry_date || 'N/A',
                    created_at: card.created_at || new Date().toISOString(),
                    shipping: card.shipping || null
                };

                console.log('Safe card object:', safeCard);

                // Format the display HTML
                let html = `
                <div class="cc-item">
                    <div class="cc-info">
                        <h3>Customer Profile</h3>
                        <p><strong>Customer ID:</strong> ${safeCard.customer_id}</p>
                        <p><strong>Customer Name:</strong> ${safeCard.customer_name}</p>
                        <p><strong>Customer Type:</strong> ${safeCard.customer_type}</p>
                        <p><strong>Description:</strong> ${safeCard.description}</p>
                        <p><strong>Email:</strong> ${safeCard.email}</p>
                        <p><strong>Phone:</strong> ${safeCard.phone}</p>
                        <p><strong>Company:</strong> ${safeCard.company}</p>

                        <h3>Billing Information</h3>
                        <p><strong>Address:</strong> ${safeCard.address}</p>
                        <p><strong>City:</strong> ${safeCard.city}</p>
                        <p><strong>State:</strong> ${safeCard.state}</p>
                        <p><strong>Zip Code:</strong> ${safeCard.zip_code}</p>
                        <p><strong>Country:</strong> ${safeCard.country}</p>
                        <p><strong>Fax:</strong> ${safeCard.fax}</p>`;

                // Add shipping information if it exists
                if (safeCard.shipping) {
                    html += `
                        <h3>Shipping Information</h3>
                        <p><strong>Name:</strong> ${safeCard.shipping.first_name} ${safeCard.shipping.last_name}</p>
                        <p><strong>Company:</strong> ${safeCard.shipping.company || 'N/A'}</p>
                        <p><strong>Address:</strong> ${safeCard.shipping.address}</p>
                        <p><strong>City:</strong> ${safeCard.shipping.city}</p>
                        <p><strong>State:</strong> ${safeCard.shipping.state}</p>
                        <p><strong>Zip Code:</strong> ${safeCard.shipping.zip_code}</p>
                        <p><strong>Country:</strong> ${safeCard.shipping.country}</p>
                        <p><strong>Phone:</strong> ${formatPhone(safeCard.shipping.phone)}</p>
                        <p><strong>Fax:</strong> ${safeCard.shipping.fax || 'N/A'}</p>`;
                }

                // Add payment information
                html += `
                        <h3>Payment Information</h3>
                        <div class="sensitive-info">
                            <button class="reveal-btn" onclick="toggleSensitiveData(this, ${safeCard.id})">
                                Show Hidden Numbers
                            </button>
                            <div class="card-details">
                                <p><strong>Card:</strong> 
                                    <span class="masked-number">**** **** **** ${safeCard.card_number.slice(-4)}</span>
                                    <span class="full-number" style="display: none">${safeCard.card_number}</span>
                                </p>
                                <p><strong>CVV:</strong> 
                                    <span class="masked-cvv">***</span>
                                    <span class="full-cvv" style="display: none">${safeCard.cvv}</span>
                                </p>
                            </div>
                        </div>
                        <p><strong>Expiry:</strong> ${safeCard.expiry_date}</p>
                        <p><strong>Added:</strong> ${new Date(safeCard.created_at).toLocaleDateString()}</p>
                    </div>
                    <button onclick="deleteCCAuth(${safeCard.id})" class="delete-btn">Delete</button>
                </div>`;

                return html;
            }).join('');

        } catch (err) {
            console.error('Error loading credit cards:', err);
            ccList.innerHTML = '<p>Error loading credit card authorizations.</p>';
        }
    }

    // Delete CC Auth function
    window.deleteCCAuth = async (id) => {
        if (!confirm('Are you sure you want to delete this credit card authorization?')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/cc-auth/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await loadCreditCards();
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Failed to delete authorization');
            }
        } catch (err) {
            alert('Error deleting authorization: ' + err.message);
        }
    };

    // Toggle sensitive data visibility
    window.toggleSensitiveData = (button, cardId) => {
        const container = button.closest('.sensitive-info');
        
        if (button.textContent === 'Show Hidden Numbers') {
            // Show the full numbers
            container.querySelectorAll('.masked-number, .masked-cvv').forEach(el => el.style.display = 'none');
            container.querySelectorAll('.full-number, .full-cvv').forEach(el => el.style.display = 'inline');
            button.textContent = 'Hide Numbers';

            // Auto-hide after 30 seconds
            setTimeout(() => {
                if (button.textContent === 'Hide Numbers') {
                    container.querySelectorAll('.masked-number, .masked-cvv').forEach(el => el.style.display = 'inline');
                    container.querySelectorAll('.full-number, .full-cvv').forEach(el => el.style.display = 'none');
                    button.textContent = 'Show Hidden Numbers';
                }
            }, 30000);
        } else {
            // Hide the numbers
            container.querySelectorAll('.masked-number, .masked-cvv').forEach(el => el.style.display = 'inline');
            container.querySelectorAll('.full-number, .full-cvv').forEach(el => el.style.display = 'none');
            button.textContent = 'Show Hidden Numbers';
        }
    };

    // Load credit cards on page load
    await loadCreditCards();

    // Add these functions for the update modal
    window.showUpdateCardModal = () => {
        document.getElementById('updateCardModal').style.display = 'block';
    };

    window.closeUpdateCardModal = () => {
        document.getElementById('updateCardModal').style.display = 'none';
        document.getElementById('updateCardForm').reset();
    };

    // Update form submission handler
    document.getElementById('updateCardForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const firstName = this.updateFirstName.value.trim();
        const lastName = this.updateLastName.value.trim();
        const company = this.updateCompany.value.trim();
        const email = this.updateEmail.value.trim();
        const phone = this.updatePhone.value.replace(/\D/g, '');
        
        // Get form values
        const formData = {
            customer_name: `${firstName} ${lastName}`,
            first_name: firstName,
            last_name: lastName,
            company: company || 'N/A',
            email: email,
            phone: phone,
            description: this.updateDescription?.value?.trim() || 'N/A',
            customer_type: this.updateCustomerType?.value || 'N/A',
            customer_id: this.updateCustomerId?.value?.trim() || 'N/A',
            card_number: this.updateCardNumber.value.replace(/\D/g, ''),
            cvv: this.updateCvv.value.trim(),
            expiry_date: this.updateExpiryDate.value.trim(),
            is_update: true,
            // Default values for address fields if not provided
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
            const fax = document.getElementById('updateFax')?.value?.trim();

            if (address) formData.address = address;
            if (city) formData.city = city;
            if (state) formData.state = state;
            if (zipCode) formData.zip_code = zipCode;
            if (country) formData.country = country;
            if (fax) formData.fax = fax;
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
                const error = await response.json();
                throw new Error(error.message || 'Failed to update card information');
            }

            alert('Card information updated successfully');
            this.reset();
            closeUpdateCardModal();
            await loadCreditCards();
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to update card information: ' + error.message);
        }
    });

    // Add input event listeners to remove invalid class when user types
    document.getElementById('updateCardForm').querySelectorAll('input[required]').forEach(input => {
        input.addEventListener('input', function() {
            if (this.value.trim()) {
                this.classList.remove('invalid');
            }
        });
    });
});
