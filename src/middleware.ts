import { createMiddleware } from 'hono/factory'
import { getCookie } from "hono/cookie"
import { HTTPException } from 'hono/http-exception'
import {validateJwt} from "./util";

export const jwtCheckMiddleware = createMiddleware(async (c, next) => {
    const token = getCookie(c, "access_token")

    if (token) {
        let payload = await validateJwt(token, `https://${c.env.AUTH0_DOMAIN}/.well-known/jwks.json`)

        c.set('auth', payload.isValid)
        if (payload.isValid) {
            c.set('email', payload.email)
        }
    }

    await next()
})

export const jwtValidateMiddleware = createMiddleware(async (c, next) => {
    const token = getCookie(c, "access_token");
    if (!token) {
        const res = new Response('Unauthorized', {
            status: 401,
        });
        throw new HTTPException(401, { res });
    }


    let payload = await validateJwt(token, `https://${c.env.AUTH0_DOMAIN}/.well-known/jwks.json`)

    if (!payload.isValid) {
        const res = new Response('Unauthorized', {
            status: 401,
        });
        throw new HTTPException(401, { res });
    }

    c.set('auth', payload.isValid)
    c.set('email', payload.email)

    await next();
});