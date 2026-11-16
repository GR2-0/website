
/* ==========================================
   GR 2.0 — SECTION LIFT REVEAL
   Повторяется при каждой прокрутке
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
    const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
    );

    // Hero оставляем без изменений.
    // Анимируем каждую следующую секцию целиком.
    const sections = Array.from(
        document.querySelectorAll('section:not(.hero)')
    ).filter(section => {
        // Не трогаем вложенные секции.
        return !section.parentElement.closest('section');
    });

    if (!sections.length) return;

    // Убираем старые классы reveal,
    // чтобы не конфликтовали два эффекта.
    document.querySelectorAll('.reveal').forEach(el => {
        el.classList.remove('reveal', 'is-visible');
        el.style.removeProperty('--reveal-delay');
    });

    sections.forEach(section => {
        section.classList.add('section-lift');
    });

    if (
        reducedMotion.matches ||
        !('IntersectionObserver' in window)
    ) {
        sections.forEach(section => {
            section.classList.add('is-visible');
        });
        return;
    }

    document.documentElement.classList.add(
        'section-lift-ready'
    );

    const observer = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                } else {
                    entry.target.classList.remove('is-visible');
                }
            });
        },
        {
            // Секция начинает появляться,
            // когда заходит в область просмотра.
            threshold: 0.08,
            rootMargin: '0px 0px -55px 0px'
        }
    );

    sections.forEach(section => {
        observer.observe(section);
    });

    console.info('[GR 2.0] Section lift reveal ready');
});
