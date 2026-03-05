/**
 * Utilitário de sanitização de input contra XSS e injection.
 */
/**
 * Remove caracteres perigosos de strings de input.
 * Previne XSS e NoSQL injection.
 */
export declare function sanitizar(input: string): string;
/**
 * Valida e sanitiza um ID (slug).
 * IDs devem conter apenas letras, números, hífens e underscores.
 */
export declare function sanitizarId(input: string): string | null;
/**
 * Valida formato de telefone brasileiro (DDI + DDD + número).
 */
export declare function validarTelefone(telefone: string): boolean;
/**
 * Valida formato ISO 8601 de data/hora.
 */
export declare function validarDataHora(dataHora: string): Date | null;
//# sourceMappingURL=sanitizar.d.ts.map