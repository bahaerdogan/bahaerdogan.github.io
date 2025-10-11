// EmailJS Contact Form Script with Rate Limiting
document.addEventListener('DOMContentLoaded', function() {
    // Get the form element
    const form = document.getElementById('contact-form');
    const sendMessageDiv = document.getElementById('sendmessage');
    const errorMessageDiv = document.getElementById('errormessage');
    
    // Rate limiting configuration
    const RATE_LIMIT_KEY = 'contact_form_submissions';
    const MAX_SUBMISSIONS = 3;
    const TIME_WINDOW = 3600000; // 1 hour in milliseconds
    
    // Check rate limit
    function checkRateLimit() {
        try {
            const submissions = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || '[]');
            const now = Date.now();
            
            // Filter out old submissions outside the time window
            const recentSubmissions = submissions.filter(time => now - time < TIME_WINDOW);
            
            if (recentSubmissions.length >= MAX_SUBMISSIONS) {
                const oldestSubmission = Math.min(...recentSubmissions);
                const timeUntilReset = Math.ceil((TIME_WINDOW - (now - oldestSubmission)) / 60000);
                return { allowed: false, minutesLeft: timeUntilReset };
            }
            
            return { allowed: true };
        } catch (e) {
            // If localStorage fails, allow submission
            return { allowed: true };
        }
    }
    
    // Record submission
    function recordSubmission() {
        try {
            const submissions = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || '[]');
            const now = Date.now();
            
            // Add current submission and filter old ones
            const recentSubmissions = submissions.filter(time => now - time < TIME_WINDOW);
            recentSubmissions.push(now);
            
            localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(recentSubmissions));
        } catch (e) {
            // Silently fail if localStorage is not available
        }
    }
    
    if (form) {
        // Add submit event listener to the form
        form.addEventListener('submit', function(event) {
            // Prevent the default form submission
            event.preventDefault();
            
            // Hide any previous messages
            sendMessageDiv.classList.add('d-none');
            errorMessageDiv.classList.add('d-none');
            
            // Check rate limit
            const rateCheck = checkRateLimit();
            if (!rateCheck.allowed) {
                errorMessageDiv.textContent = `Too many submission attempts. Please try again in ${rateCheck.minutesLeft} minute(s).`;
                errorMessageDiv.classList.remove('d-none');
                return;
            }
            
            // Get form data
            const templateParams = {
                from_name: document.getElementById('name').value,
                from_email: document.getElementById('email').value,
                subject: document.getElementById('subject').value,
                message: document.getElementById('message').value
            };
            
            // Basic email validation
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(templateParams.from_email)) {
                errorMessageDiv.textContent = 'Please enter a valid email address.';
                errorMessageDiv.classList.remove('d-none');
                return;
            }
            
            // Disable submit button to prevent double submission
            const submitButton = form.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.textContent = 'Sending...';
            
            // Send the email using EmailJS
            emailjs.send('service_lhjdfqw', 'template_bha2val', templateParams, 'sr9_9CUgd0L641ObN')
                .then(function(response) {
                    console.log('SUCCESS!', response.status, response.text);
                    // Record successful submission for rate limiting
                    recordSubmission();
                    // Show success message
                    sendMessageDiv.classList.remove('d-none');
                    // Reset form
                    form.reset();
                }, function(error) {
                    console.log('FAILED...', error);
                    // Show error message
                    errorMessageDiv.textContent = 'Failed to send message. Please try again later.';
                    errorMessageDiv.classList.remove('d-none');
                })
                .finally(function() {
                    // Re-enable submit button
                    submitButton.disabled = false;
                    submitButton.textContent = originalButtonText;
                });
        });
    }
}); 