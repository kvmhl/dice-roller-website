// public/theme.js
(function() {
    'use strict';

    const themeCheckbox = document.getElementById('theme-checkbox');
    const currentTheme = localStorage.getItem('theme');

    /**
     * Applies the given theme to the page and updates the dice colors.
     * @param {string} theme - The theme to apply ('dark' or 'light').
     */
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            if (themeCheckbox) themeCheckbox.checked = true;
        } else {
            document.body.classList.remove('dark-mode');
            if (themeCheckbox) themeCheckbox.checked = false;
        }

        // Check if the dice library and roller have loaded and are ready
        if (window.DICE && window.roller && window.roller.box) {
            // 1. Tell the dice library to switch its internal color palette.
            // THIS IS THE FIX: We pass the roller.box instance so it can update the background.
            DICE.updateTheme(theme, roller.box);

            // 2. Get the current dice notation from the page
            const notationElement = document.getElementById('textInput');
            const currentNotation = notationElement.value || notationElement.textContent;

            // 3. Tell the roller to clear and redraw the dice with the new colors
            roller.box.setDice(currentNotation);
        }
    }

    // Apply the saved theme as soon as the page loads
    applyTheme(currentTheme);

    // Add a listener to the theme toggle switch if it exists
    if (themeCheckbox) {
        themeCheckbox.addEventListener('change', () => {
            const newTheme = themeCheckbox.checked ? 'dark' : 'light';
            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
        });
    }
})();