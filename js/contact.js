// EmailJS Contact Form Script
document.addEventListener('DOMContentLoaded', function() {
    // Get the form element
    const form = document.getElementById('contact-form');
    const sendMessageDiv = document.getElementById('sendmessage');
    const errorMessageDiv = document.getElementById('errormessage');
    
    if (form) {
        // Add submit event listener to the form
        form.addEventListener('submit', function(event) {
            // Prevent the default form submission
            event.preventDefault();
            
            // Hide any previous messages
            sendMessageDiv.classList.add('d-none');
            errorMessageDiv.classList.add('d-none');
            
            // Get form data
            const templateParams = {
                from_name: document.getElementById('name').value,
                from_email: document.getElementById('email').value,
                subject: document.getElementById('subject').value,
                message: document.getElementById('message').value
            };
            
            // Send the email using EmailJS
            emailjs.send('service_lhjdfqw', 'template_bha2val', templateParams, 'sr9_9CUgd0L641ObN')
                .then(function(response) {
                    console.log('SUCCESS!', response.status, response.text);
                    // Show success message
                    sendMessageDiv.classList.remove('d-none');
                    // Reset form
                    form.reset();
                }, function(error) {
                    console.log('FAILED...', error);
                    // Show error message
                    errorMessageDiv.textContent = 'Failed to send message. Please try again later.';
                    errorMessageDiv.classList.remove('d-none');
                });
        });
    }
}); 