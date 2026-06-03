"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMagasinActive = isMagasinActive;
exports.isMagasinInactive = isMagasinInactive;
exports.magasinStatusLabel = magasinStatusLabel;
function isMagasinActive(status) {
    return status === 0;
}
function isMagasinInactive(status) {
    return status === 1;
}
function magasinStatusLabel(status, lang) {
    if (isMagasinActive(status))
        return lang === 'en' ? 'active' : 'actif';
    if (isMagasinInactive(status))
        return lang === 'en' ? 'inactive' : 'inactif';
    return lang === 'en' ? 'unknown' : 'inconnu';
}
//# sourceMappingURL=magasin-status.util.js.map