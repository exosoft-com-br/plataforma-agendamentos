"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gerarProtocolo = gerarProtocolo;
/**
 * Gera um protocolo único para identificação do agendamento.
 * Formato: AGD-{ANO}-{HASH_4_CHARS}
 */
function gerarProtocolo() {
    const ano = new Date().getFullYear();
    const hash = Math.random().toString(16).substring(2, 6).toUpperCase();
    return `AGD-${ano}-${hash}`;
}
//# sourceMappingURL=gerarProtocolo.js.map