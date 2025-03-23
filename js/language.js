document.addEventListener('DOMContentLoaded', function() {
  // Get current language from localStorage or default to 'en'
  let currentLang = localStorage.getItem('language') || 'en';
  
  // Initial translation
  translatePage(currentLang);
  
  // Update language display
  updateLanguageDisplay(currentLang);
  
  // Add event listeners to language switchers
  document.querySelectorAll('.lang-switch').forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const newLang = this.getAttribute('data-lang');
      const newUrl = this.getAttribute('data-url');
      
      // Save language preference
      localStorage.setItem('language', newLang);
      
      // If URL is provided and different from current page, navigate
      if (newUrl && window.location.pathname !== newUrl) {
        window.location.href = newUrl;
        return;
      }
      
      // Otherwise translate in place
      translatePage(newLang);
      updateLanguageDisplay(newLang);
    });
  });
  
  function translatePage(lang) {
    // Translate elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      if (translations[lang] && translations[lang][key]) {
        element.textContent = translations[lang][key];
      }
    });
    
    // Translate placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      if (translations[lang] && translations[lang][key]) {
        element.setAttribute('placeholder', translations[lang][key]);
      }
    });
    
    // Update html lang attribute
    document.documentElement.lang = lang;
  }
  
  function updateLanguageDisplay(lang) {
    const currentLangElement = document.querySelector('.current-lang');
    if (currentLangElement) {
      currentLangElement.textContent = lang === 'tr' ? 'Türkçe' : 'English';
    }
  }
}); 