document.addEventListener('DOMContentLoaded', async () => {
    const ccList = document.querySelector('.cc-list');

    async function loadCreditCards() {
        try {
            const response = await fetch('/api/admin/cc-auth');
            if (!response.ok) {
                throw new Error('Failed to fetch credit cards');
            }

            const cards = await response.json();
            
            ccList.innerHTML = cards.map(card => `
                <div class="cc-item">
                    <div class="cc-info">
                        <h3>${card.customer_name}</h3>
                        <div class="sensitive-info">
                            <button class="reveal-btn" onclick="toggleSensitiveData(this, ${card.id})">
                                Show Hidden Numbers
                            </button>
                            <div class="card-details">
                                <p>Card: 
                                    <span class="masked-number">**** **** **** ${card.card_number.slice(-4)}</span>
                                    <span class="full-number" style="display: none">${card.card_number}</span>
                                </p>
                                <p>CVV: 
                                    <span class="masked-cvv">***</span>
                                    <span class="full-cvv" style="display: none">${card.cvv}</span>
                                </p>
                            </div>
                        </div>
                        <p>Expiry: ${card.expiry_date}</p>
                        <p>Email: ${card.email}</p>
                        <p>Phone: ${card.phone}</p>
                        <p>Added: ${new Date(card.created_at).toLocaleDateString()}</p>
                    </div>
                    <button onclick="deleteCCAuth(${card.id})" class="delete-btn">Delete</button>
                </div>
            `).join('');

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
                loadCreditCards();
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Failed to delete authorization');
            }
        } catch (err) {
            alert('Error deleting authorization: ' + err.message);
        }
    };

    // Update the toggle function
    window.toggleSensitiveData = async (button, cardId) => {
        try {
            if (button.textContent === 'Show Hidden Numbers') {
                // Create and show phone verification modal
                const modalHtml = `
                    <div id="verificationModal" class="modal">
                        <div class="modal-content">
                            <h3>Phone Verification Required</h3>
                            <p>A verification code will be sent to your registered phone number.</p>
                            <button id="sendCode" class="verify-btn">Send Verification Code</button>
                        </div>
                    </div>
                `;
                
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                const modal = document.getElementById('verificationModal');
                
                // Handle send code button
                document.getElementById('sendCode').addEventListener('click', async () => {
                    try {
                        const verifyResponse = await fetch('/api/admin/request-verification', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ 
                                cardId,
                                phoneToken: true // Signal that we want to use phone verification
                            })
                        });

                        if (!verifyResponse.ok) {
                            throw new Error('Failed to send verification code');
                        }

                        // Update modal for code entry
                        modal.querySelector('.modal-content').innerHTML = `
                            <h3>Enter Verification Code</h3>
                            <p>A code has been sent to your phone</p>
                            <input type="text" id="verificationCode" placeholder="Enter code" maxlength="6">
                            <button id="submitCode" class="verify-btn">Verify</button>
                        `;

                        // Handle verification code submission
                        document.getElementById('submitCode').addEventListener('click', async () => {
                            const code = document.getElementById('verificationCode').value;
                            const verifyCodeResponse = await fetch('/api/admin/verify-code', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ 
                                    code,
                                    cardId
                                })
                            });

                            if (verifyCodeResponse.ok) {
                                modal.remove();
                                const container = button.closest('.sensitive-info');
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
                                alert('Invalid verification code');
                            }
                        });
                    } catch (err) {
                        alert(err.message);
                    }
                });
            } else {
                const container = button.closest('.sensitive-info');
                container.querySelectorAll('.masked-number, .masked-cvv').forEach(el => el.style.display = 'inline');
                container.querySelectorAll('.full-number, .full-cvv').forEach(el => el.style.display = 'none');
                button.textContent = 'Show Hidden Numbers';
            }
        } catch (err) {
            alert(err.message);
        }
    };

    // Load credit cards on page load
    await loadCreditCards();
});
