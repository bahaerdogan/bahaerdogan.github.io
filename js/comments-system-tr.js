/**
 * Güvenli Yorum Sistemi - Cloudflare Worker Backend
 * EmailJS yerine güvenli bir sistem
 */

(function() {
  'use strict';

  // Worker URL (Cloudflare'den alındı)
  const API_BASE_URL = 'https://comment-handler.baha-erdogann.workers.dev';
  
  // Mevcut blog slug'ını URL'den al
  function getBlogSlug() {
    const pathname = window.location.pathname;
    const filename = pathname.split('/').pop();
    return filename.replace('.html', '').replace('TR', '').replace('DE', '');
  }

  /**
   * Yorum sistemini başlat
   */
  function initCommentsSystem() {
    const commentForm = document.getElementById('comment-form');
    const commentsContainer = document.getElementById('comments-container');

    if (!commentForm || !commentsContainer) {
      console.warn('Yorum sistemi elementleri bu sayfada bulunamadı');
      return;
    }

    // Mevcut yorumları yükle
    loadComments();

    // Form submit handler
    commentForm.addEventListener('submit', handleCommentSubmission);
  }

  /**
   * Cloudflare Worker'dan yorumları yükle
   */
  async function loadComments() {
    const slug = getBlogSlug();
    const container = document.getElementById('comments-container');

    try {
      // Yükleniyor durumu
      container.innerHTML = `
        <div class="text-center py-4">
          <div class="spinner-border text-primary" role="status">
            <span class="sr-only">Yorumlar yükleniyor...</span>
          </div>
        </div>
      `;

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
      console.error('Yorumlar yüklenemedi:', error);
      container.innerHTML = `
        <div class="alert alert-warning">
          <p>Yorumlar şu anda yüklenemiyor. Lütfen sayfayı yenilemeyi deneyin.</p>
        </div>
      `;
    }
  }

  /**
   * Yorumları DOM'da göster
   */
  function displayComments(comments) {
    const container = document.getElementById('comments-container');

    if (!comments || comments.length === 0) {
      const isTurkish = window.location.pathname.includes('TR.html');
      const isDeutsch = window.location.pathname.includes('DE.html');
      
      let noCommentsText = 'Henüz yorum yok. İlk yorumu siz yapın!';
      if (isDeutsch) {
        noCommentsText = 'Noch keine Kommentare. Seien Sie der Erste!';
      } else if (!isTurkish) {
        noCommentsText = 'No comments yet. Be the first to comment!';
      }

      container.innerHTML = `<p class="text-muted">${noCommentsText}</p>`;
      return;
    }

    // Yorumları render et
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
   * Yorum form gönderimini işle
   */
  async function handleCommentSubmission(event) {
    event.preventDefault();

    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const successAlert = document.getElementById('comment-success');
    const errorAlert = document.getElementById('comment-error');
    
    // Form verilerini al
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

    // Önceki mesajları gizle
    hideAlert(successAlert);
    hideAlert(errorAlert);

    // Submit butonunu devre dışı bırak
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="icon icon-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Gönderiliyor...`;

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
        // The Worker's errors are written for visitors and already localised
        // (validation, rate limit, spam check), so they are shown as sent.
        // Only a failure without one falls back to the generic message.
        throw Object.assign(new Error(result.error || `HTTP ${response.status}`), { forVisitor: Boolean(result.error) });
      }

      // Başarılı!
      showAlert(successAlert, result.message || 'Yorumunuz başarıyla gönderildi! Teşekkürler!');
      form.reset();

      // Yeni yorumu hemen ekle
      if (result.comment) {
        addCommentToDisplay(result.comment);
      }

    } catch (error) {
      console.error('Yorum gönderme hatası:', error);
      showAlert(errorAlert, error.forVisitor ? error.message : 'Yorum gönderilemedi. Lütfen tekrar deneyin.');

    } finally {
      // Submit butonunu yeniden etkinleştir
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  }

  /**
   * Client-side form validasyonu
   */
  function validateForm(data, errorAlert) {
    if (data.name.length < 2 || data.name.length > 100) {
      showAlert(errorAlert, 'İsim 2-100 karakter arasında olmalı');
      return false;
    }

    if (!isValidEmail(data.email)) {
      showAlert(errorAlert, 'Lütfen geçerli bir email adresi girin');
      return false;
    }

    if (data.message.length < 10 || data.message.length > 5000) {
      showAlert(errorAlert, 'Mesaj 10-5000 karakter arasında olmalı');
      return false;
    }

    return true;
  }

  /**
   * Email validasyonu
   */
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Yeni yorumu ekrana ekle (optimistic UI)
   */
  function addCommentToDisplay(comment) {
    const container = document.getElementById('comments-container');
    
    // "Henüz yorum yok" mesajı varsa temizle
    if (container.querySelector('p.text-muted')) {
      container.innerHTML = '';
    }

    const commentHtml = `
      <div class="comment mb-4 p-3 border-bottom comment-new-highlight" data-comment-id="${escapeAttr(comment.id)}">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <h5 class="mb-0">
            <i class="fa fa-user-circle text-primary mr-2"></i>
            ${escapeHtml(comment.name)}
            <span class="badge badge-success ml-2">Yeni</span>
          </h5>
          <small class="text-muted">
            <i class="fa fa-clock-o mr-1"></i>
            ${escapeHtml(formatDate(comment.date))}
          </small>
        </div>
        <p class="mb-0 comment-message">${escapeHtml(comment.message).replace(/\n/g, '<br>')}</p>
      </div>
    `;

    // Üste ekle (en yeni ilk sırada)
    container.insertAdjacentHTML('afterbegin', commentHtml);

    // Yeni yoruma kaydır
    const newComment = container.querySelector('.comment-new-highlight');
    if (newComment) {
      newComment.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      
      // 3 saniye sonra highlight'ı kaldır
      setTimeout(() => {
        newComment.classList.remove('comment-new-highlight');
      }, 3000);
    }
  }

  /**
   * XSS önlemek için HTML escape
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
    return d.toLocaleDateString('tr-TR', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  /**
   * Alert mesajı göster
   */
  function showAlert(element, message) {
    if (!element) return;
    element.textContent = message;
    element.classList.remove('d-none');
  }

  /**
   * Alert mesajını gizle
   */
  function hideAlert(element) {
    if (!element) return;
    element.classList.add('d-none');
  }

  // DOM hazır olduğunda başlat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCommentsSystem);
  } else {
    initCommentsSystem();
  }

  // Yeni yorum highlight CSS
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

