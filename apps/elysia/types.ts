import { t } from "elysia";


export const NotFoundResponseSchema = t.Object({
    error: t.String(),
    message: t.String(),
});