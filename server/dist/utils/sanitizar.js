"use strict";
/**
 * Utilitário de sanitização de input contra XSS e injection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizar = sanitizar;
exports.sanitizarId = sanitizarId;
exports.validarTelefone = validarTelefone;
exports.validarDataHora = validarDataHora;
/**
 * Remove caracteres perigosos de strings de input.
 * Previne XSS e NoSQL injection.
 */
function sanitizar(input) {
    if (typeof input !== "string")
        return "";
    return input
        .trim()
        .replace(/[<>]/g, "") // Remove tags HTML
        .replace(/javascript:/gi, "") // Remove javascript: URIs
        .replace(/on\w+=/gi, "") // Remove event handlers (onclick=, etc)
        .substring(0, 500); // Limita tamanho máximo
}
/**
 * Valida e sanitiza um ID (slug).
 * IDs devem conter apenas letras, números, hífens e underscores.
 */
function sanitizarId(input) {
    if (typeof input !== "string")
        return null;
    const limpo = input.trim().substring(0, 100);
    if (!/^[a-zA-Z0-9_-]+$/.test(limpo))
        return null;
    return limpo;
}
/**
 * Valida formato de telefone brasileiro (DDI + DDD + número).
 */
function validarTelefone(telefone) {
    return /^\d{12,13}$/.test(telefone);
}
/**
 * Valida formato ISO 8601 de data/hora.
 */
function validarDataHora(dataHora) {
    const obj = new Date(dataHora);
    if (isNaN(obj.getTime()))
        return null;
    return obj;
}
//# sourceMappingURL=sanitizar.js.map