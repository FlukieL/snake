// Power-up info modal: explains what each power-up does. Populated once from
// constants.POWERUP_TYPES so descriptions stay in sync with actual behavior.

import { dom } from './dom.js';
import { constants } from './state.js';

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
    if (dom.powerupInfoModal) dom.powerupInfoModal.style.display = 'flex';
}

function closeModal() {
    if (dom.powerupInfoModal) dom.powerupInfoModal.style.display = 'none';
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
