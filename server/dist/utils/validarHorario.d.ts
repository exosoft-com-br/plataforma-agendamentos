/**
 * Interface do Prestador usada pelos utilitários de horário.
 */
export interface PrestadorHorario {
    id: string;
    horarioAtendimento: {
        inicio: string;
        fim: string;
        diasSemana: number[];
    };
}
/**
 * Representa um slot de horário.
 */
export interface Slot {
    inicio: string;
    fim: string;
    disponivel: boolean;
}
/**
 * Valida se uma data/hora está dentro do horário de atendimento.
 */
export declare function validarHorario(dataHora: string, prestador: PrestadorHorario): boolean;
/**
 * Gera todos os slots possíveis para um dia.
 */
export declare function gerarSlotsDoDia(data: string, prestador: PrestadorHorario, duracaoMinutos: number): Slot[];
//# sourceMappingURL=validarHorario.d.ts.map