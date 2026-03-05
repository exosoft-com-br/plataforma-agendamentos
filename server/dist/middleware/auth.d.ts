import { Request, Response, NextFunction } from "express";
export interface AuthPayload {
    userId: string;
    email: string;
    role: "admin" | "usuario";
    ownerId: string;
}
declare global {
    namespace Express {
        interface Request {
            auth?: AuthPayload;
        }
    }
}
/**
 * Gera um JWT com payload do usuário.
 */
export declare function gerarToken(payload: AuthPayload): string;
/**
 * Middleware: exige autenticação (qualquer role).
 */
export declare function autenticar(req: Request, res: Response, next: NextFunction): void;
/**
 * Middleware: exige role admin.
 */
export declare function apenasAdmin(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map