// Contact Form Handler - Using Cloudflare Workers Backend
document.addEventListener('DOMContentLoaded', function() {
    // Worker URL (same as comments system)
    const API_BASE_URL = 'https://comment-handler.baha-erdogann.workers.dev';
    
    // Get the form element
    const form = document.getElementById('contact-form');
    const sendMessageDiv = document.getElementById('sendmessage');
    const errorMessageDiv = document.getElementById('errormessage');
    
    if (form) {
        // Add submit event listener to the form
        form.addEventListener('submit', async function(event) {
            // Prevent the default form submission
            event.preventDefault();
            
            // Hide any previous messages
            sendMessageDiv.classList.add('d-none');
            errorMessageDiv.classList.add('d-none');
            
            // Get form data
            const formData = {
                name: document.getElementById('name').value.trim(),
                email: document.getElementById('email').value.trim(),
                subject: document.getElementById('subject').value.trim(),
                message: document.getElementById('message').value.trim()
            };
            
            // Client-side validation
            if (formData.name.length < 2 || formData.name.length > 100) {
                errorMessageDiv.textContent = 'Name must be between 2-100 characters.';
                errorMessageDiv.classList.remove('d-none');
                return;
            }
            
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(formData.email)) {
                errorMessageDiv.textContent = 'Please enter a valid email address.';
                errorMessageDiv.classList.remove('d-none');
                return;
            }
            
            if (formData.subject.length < 2 || formData.subject.length > 200) {
                errorMessageDiv.textContent = 'Subject must be between 2-200 characters.';
                errorMessageDiv.classList.remove('d-none');
                return;
            }
            
            if (formData.message.length < 10 || formData.message.length > 5000) {
                errorMessageDiv.textContent = 'Message must be between 10-5000 characters.';
                errorMessageDiv.classList.remove('d-none');
                return;
            }
            
            // Disable submit button to prevent double submission
            const submitButton = form.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Sending...';
            
            try {
                const response = await fetch(`${API_BASE_URL}/contact`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData),
                });
                
                const result = await response.json();
                
                if (!response.ok) {
                    throw new Error(result.error || `HTTP ${response.status}`);
                }
                
                // Success!
                sendMessageDiv.textContent = result.message || 'Your message has been sent successfully!';
                sendMessageDiv.classList.remove('d-none');
                form.reset();
                
                // Scroll to success message
                sendMessageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                
            } catch (error) {
                console.error('Contact form error:', error);
                let errorMessage = 'Failed to send message. Please try again later.';
                
                // Handle specific error messages
                if (error.message.includes('Rate limit')) {
                    errorMessage = error.message;
                } else if (error.message.includes('characters')) {
                    errorMessage = error.message;
                }
                
                errorMessageDiv.textContent = errorMessage;
                errorMessageDiv.classList.remove('d-none');
                
            } finally {
                // Re-enable submit button
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        });
    }
}); 