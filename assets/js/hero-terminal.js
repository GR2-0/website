
/* ==========================================
   GR 2.0 — TERMINAL TYPEWRITER
   Один запуск при каждой загрузке
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
    const terminal = document.querySelector(
        '.hero-terminal'
    );

    if (!terminal) return;

    const textElement = terminal.querySelector(
        '.hero-terminal-text'
    );

    if (!textElement) return;

    const fullText =
        textElement.dataset.text ||
        'TECHNOLOGY // PEOPLE // IDEAS';

    const reduceMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
    ).matches;

    if (reduceMotion) {
        textElement.textContent = fullText;
        terminal.classList.add('is-complete');
        return;
    }

    // Настройки эффекта
    const START_DELAY = 650;
    const TYPE_SPEED = 65;
   /* const CURSOR_HOLD = 1200;*/

    let index = 0;

    // Начинаем с пустой строки
    textElement.textContent = '';
    terminal.classList.remove('is-complete');

    function typeNextCharacter() {
        if (index < fullText.length) {
            textElement.textContent += fullText[index];
            index++;

            setTimeout(
                typeNextCharacter,
                TYPE_SPEED
            );
        } else {
            // Текст набран.
            // Курсор немного мигает и исчезает.
            setTimeout(() => {
               terminal.classList.add('is-complete');
            }, CURSOR_HOLD);
        }
    }

    setTimeout(
        typeNextCharacter,
        START_DELAY
    );
});
