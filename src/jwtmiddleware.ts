import { createMiddleware } from 'hono/factory'
import { getCookie } from "hono/cookie"
import { HTTPException } from 'hono/http-exception'
import jwt from '@tsndr/cloudflare-worker-jwt'

export const jwtCheckMiddleware = createMiddleware(async (c, next) => {
    const token = getCookie(c, "access_token")

    if (token) {
        try{
             await jwt.verify(token, c.env.AUTH0_CLIENT_SECRET)
            c.set("auth", true)
        } catch { }
    }

    await next()
})

export const jwtValidateMiddleware = createMiddleware(async (c, next) => {
  const token = getCookie(c, "access_token")
  if (!token) {
      const res = new Response('Unauthorized', {
          status: 401,
      })
      throw new HTTPException(401, { res })
  }

  const decoded = await jwt.verify(token, c.env.AUTH0_CLIENT_SECRET)
  if (!decoded) {
      const res = new Response('Unauthorized', {
          status: 401,
      })
      throw new HTTPException(401, { res })
  }

  await next()
})