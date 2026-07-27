/**
 * Secure Comments System - Client-Side
 * Replaces EmailJS with Cloudflare Worker backend
 */

(function() {
  'use strict';

  // Worker URL (Cloudflare'den alındı)
  const API_BASE_URL = 'https://comment-handler.baha-erdogann.workers.dev';

  // Get current blog slug from URL
  function getBlogSlug() {
    const pathname = window.location.pathname;
    const filename = pathname.split('/').pop();
    return filename.replace('.html', '');
  }

  /**
   * Initialize comments system
   */
  function initCommentsSystem() {
    const commentForm = document.getElementById('comment-form');
    const commentsContainer = document.getElementById('comments-container');

    if (!commentForm || !commentsContainer) {
      console.warn('Comments system elements not found on this page');
      return;
    }

    // Load existing comments
    loadComments();

    // Set up form submission handler
    commentForm.addEventListener('submit', handleCommentSubmission);
  }

  /**
   * Load comments from Cloudflare Worker
   */
  async function loadComments() {
    const slug = getBlogSlug();
    const container = document.getElementById('comments-container');

    try {
      // Show loading state
      container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary" role="status"><span class="sr-only">Loading comments...</span></div></div>';

      const response = await fetch(`${API_BASE_URL}/comments/${slug}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      displayComments(data.comments || []);

    } catch (error) {
      console.error('Failed to load comments:', error);
      container.innerHTML = `
        <div class="alert alert-warning">
          <p>Comments could not be loaded at this time. Please try refreshing the page.</p>
        </div>
      `;
    }
  }

  /**
   * Display comments in the DOM
   */
  function displayComments(comments) {
    const container = document.getElementById('comments-container');

    if (!comments || comments.length === 0) {
      // Detect language from page
      const isEnglish = !window.location.pathname.includes('TR.html') && !window.location.pathname.includes('DE.html');
      const isDeutsch = window.location.pathname.includes('DE.html');
      
      let noCommentsText = 'No comments yet. Be the first to comment!';
      if (isDeutsch) {
        noCommentsText = 'Noch keine Kommentare. Seien Sie der Erste, der kommentiert!';
      } else if (!isEnglish) {
        noCommentsText = 'Henüz yorum yok. İlk yorumu siz yazın!';
      }

      container.innerHTML = `<p class="text-muted">${noCommentsText}</p>`;
      return;
    }

    // Render comments
    const commentsHtml = comments.map(comment => `
      <div class="comment mb-4 p-3 border-bottom" data-comment-id="${escapeAttr(comment.id)}">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <h5 class="mb-0">
            <i class="fa fa-user-circle text-primary mr-2"></i>
            ${escapeHtml(comment.name)}
          </h5>
          <small class="text-muted">
            <i class="fa fa-clock-o mr-1"></i>
            ${escapeHtml(formatDate(comment.date))}
          </small>
        </div>
        <p class="mb-0 comment-message">${escapeHtml(comment.message).replace(/\n/g, '<br>')}</p>
      </div>
    `).join('');

    container.innerHTML = commentsHtml;
  }

  /**
   * Handle comment form submission
   */
  async function handleCommentSubmission(event) {
    event.preventDefault();

    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const successAlert = document.getElementById('comment-success');
    const errorAlert = document.getElementById('comment-error');
    
    // Get form data
    const formData = {
      name: document.getElementById('comment-name').value.trim(),
      email: document.getElementById('comment-email').value.trim(),
      message: document.getElementById('comment-text').value.trim(),
      slug: getBlogSlug(),
    };

    // Client-side validation
    if (!validateForm(formData, errorAlert)) {
      return;
    }

    // Hide previous messages
    hideAlert(successAlert);
    hideAlert(errorAlert);

    // Disable submit button
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="icon icon-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Submitting...`;

    try {
      const response = await fetch(`${API_BASE_URL}/comments`, {
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
      showAlert(successAlert, result.message || 'Comment submitted successfully! Thank you!');
      form.reset();

      // Add the new comment to the display immediately
      if (result.comment) {
        addCommentToDisplay(result.comment);
      }

    } catch (error) {
      console.error('Comment submission error:', error);
      let errorMessage = 'Failed to submit comment. Please try again.';
      
      // Handle specific error messages
      if (error.message.includes('Rate limit')) {
        errorMessage = error.message;
      } else if (error.message.includes('spam')) {
        errorMessage = 'Your comment was flagged as spam. Please revise and try again.';
      }

      showAlert(errorAlert, errorMessage);

    } finally {
      // Re-enable submit button
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  }

  /**
   * Client-side form validation
   */
  function validateForm(data, errorAlert) {
    if (data.name.length < 2 || data.name.length > 100) {
      showAlert(errorAlert, 'Name must be between 2 and 100 characters');
      return false;
    }

    if (!isValidEmail(data.email)) {
      showAlert(errorAlert, 'Please enter a valid email address');
      return false;
    }

    if (data.message.length < 10 || data.message.length > 5000) {
      showAlert(errorAlert, 'Message must be between 10 and 5000 characters');
      return false;
    }

    return true;
  }

  /**
   * Email validation
   */
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Add a new comment to the display (optimistic UI)
   */
  function addCommentToDisplay(comment) {
    const container = document.getElementById('comments-container');
    
    // Check if "no comments" message exists
    if (container.querySelector('p.text-muted')) {
      container.innerHTML = '';
    }

    const commentHtml = `
      <div class="comment mb-4 p-3 border-bottom comment-new-highlight" data-comment-id="${escapeAttr(comment.id)}">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <h5 class="mb-0">
            <i class="fa fa-user-circle text-primary mr-2"></i>
            ${escapeHtml(comment.name)}
            <span class="badge badge-success ml-2">New</span>
          </h5>
          <small class="text-muted">
            <i class="fa fa-clock-o mr-1"></i>
            ${escapeHtml(formatDate(comment.date))}
          </small>
        </div>
        <p class="mb-0 comment-message">${escapeHtml(comment.message).replace(/\n/g, '<br>')}</p>
      </div>
    `;

    // Prepend to top (newest first)
    container.insertAdjacentHTML('afterbegin', commentHtml);

    // Scroll to the new comment
    const newComment = container.querySelector('.comment-new-highlight');
    if (newComment) {
      newComment.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      
      // Remove highlight after 3 seconds
      setTimeout(() => {
        newComment.classList.remove('comment-new-highlight');
      }, 3000);
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  /**
   * escapeHtml() is a text-node escaper and leaves quotes intact, so it must not
   * be used inside an attribute. This one is safe there.
   */
  function escapeAttr(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** The Worker returns ISO 8601; formatting belongs on the client. */
  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return iso || '';
    return d.toLocaleDateString('en-GB', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  /**
   * Show alert message
   */
  function showAlert(element, message) {
    if (!element) return;
    element.textContent = message;
    element.classList.remove('d-none');
  }

  /**
   * Hide alert message
   */
  function hideAlert(element) {
    if (!element) return;
    element.classList.add('d-none');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCommentsSystem);
  } else {
    initCommentsSystem();
  }

  // Add CSS for new comment highlight
  const style = document.createElement('style');
  style.textContent = `
    .comment-new-highlight {
      animation: highlight-fade 3s ease;
      background: linear-gradient(to right, rgba(0, 120, 255, 0.1), transparent);
      border-left: 3px solid #0078ff !important;
    }

    @keyframes highlight-fade {
      0% { background: rgba(0, 120, 255, 0.2); }
      100% { background: transparent; }
    }

    .comment {
      transition: all 0.3s ease;
    }

    .comment:hover {
      background: rgba(0, 0, 0, 0.02);
      transform: translateX(3px);
    }

    .comment-message {
      line-height: 1.6;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .spinner-border {
      width: 2rem;
      height: 2rem;
      border-width: 0.25rem;
    }
  `;
  document.head.appendChild(style);

})();

