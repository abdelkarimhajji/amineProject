/**
 * Silent Lease — Scroll-triggered animations
 * Fade In Up for cards and elements as they enter the viewport
 */
(function() {
  function initScrollAnimations() {
    var elements = document.querySelectorAll('.animate-fade-in-up');
    if (!elements.length || !('IntersectionObserver' in window)) return;

    var observer = new IntersectionObserver(
      function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      {
        root: null,
        rootMargin: '0px 0px -40px 0px',
        threshold: 0.1
      }
    );

    elements.forEach(function(el) {
      observer.observe(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollAnimations);
  } else {
    initScrollAnimations();
  }
})();
