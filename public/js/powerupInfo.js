// Power-up info modal: explains what each power-up does. Populated once from
// constants.POWERUP_TYPES so descriptions stay in sync with actual behavior.

import { dom } from './dom.js';
import { constants } from './state.js';
import { focusFirstMenuItem } from './input.js';

function populatePowerupInfoList() {
    if (!dom.powerupInfoList) return;
    dom.powerupInfoList.innerHTML = '';
    Object.values(constants.POWERUP_TYPES).forEach(def => {
        const li = document.createElement('li');
        li.className = 'powerup-info-item';

        const icon = document.createElement('span');
        icon.className = 'powerup-info-icon';
        icon.style.backgroundColor = def.color;
        icon.textContent = def.symbol;

        const textWrap = document.createElement('div');
        textWrap.className = 'powerup-info-text';

        const title = document.createElement('strong');
        title.textContent = def.label;

        const desc = document.createElement('p');
        desc.textContent = def.description;

        textWrap.appendChild(title);
        textWrap.appendChild(desc);

        li.appendChild(icon);
        li.appendChild(textWrap);
        dom.powerupInfoList.appendChild(li);
    });
}

function openModal() {
    if (!dom.powerupInfoModal) return;
    dom.powerupInfoModal.style.display = 'flex';
    // Move keyboard/gamepad focus into the modal (its "Got it" button) so
    // navigation continues working immediately rather than staying on the
    // now-covered "What do power-ups do?" button underneath.
    requestAnimationFrame(focusFirstMenuItem);
}

function closeModal() {
    if (!dom.powerupInfoModal) return;
    dom.powerupInfoModal.style.display = 'none';
    // Return keyboard/gamepad focus to the main menu now that the modal
    // (which previously took navigation priority) is gone - without this,
    // getActiveMenuScreen() would keep resolving to the main menu
    // correctly, but focus itself would still be sitting on the modal's
    // now-hidden "Got it" button, breaking the very next navigation input.
    requestAnimationFrame(focusFirstMenuItem);
}

export function initPowerupInfo() {
    populatePowerupInfoList();
    if (dom.powerupInfoButton) dom.powerupInfoButton.addEventListener('click', openModal);
    if (dom.powerupInfoCloseButton) dom.powerupInfoCloseButton.addEventListener('click', closeModal);
    if (dom.powerupInfoModal) {
        dom.powerupInfoModal.addEventListener('click', (e) => {
            if (e.target === dom.powerupInfoModal) closeModal();
        });
    }
}
