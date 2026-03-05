/**
 * Gera um evento iCal (RFC 5545) para um agendamento.
 * Pode ser usado como anexo .ics em emails ou para sincronizar calendários.
 */
export declare function gerarEventoICal(params: {
    protocolo: string;
    servicoNome: string;
    prestadorNome: string;
    negocioNome: string;
    clienteNome: string;
    clienteTelefone: string;
    dataHoraInicio: Date;
    duracaoMinutos: number;
    endereco?: string;
}): string;
/**
 * Gera evento iCal de cancelamento.
 */
export declare function gerarCancelamentoICal(params: {
    protocolo: string;
    servicoNome: string;
    clienteNome: string;
    dataHoraInicio: Date;
    duracaoMinutos: number;
}): string;
/**
 * Busca integrações de email ativas para um prestador e envia notificação.
 * Na versão atual, gera o .ics — o envio real depende de um provedor SMTP configurado.
 */
export declare function sincronizarCalendario(params: {
    prestadorId: string;
    protocolo: string;
    servicoNome: string;
    prestadorNome: string;
    negocioNome: string;
    clienteNome: string;
    clienteTelefone: string;
    dataHoraInicio: Date;
    duracaoMinutos: number;
    endereco?: string;
    tipo: "confirmacao" | "cancelamento";
}): Promise<void>;
//# sourceMappingURL=calendario.d.ts.map