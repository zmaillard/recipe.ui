import { Hono } from "hono/quick";
import type { KVNamespace } from '@cloudflare/workers-types'
import {setCookie, deleteCookie, getCookie} from "hono/cookie"
import {Base, SearchResults, hasFavorite, noFavorite} from "./content";
import { Meilisearch, SearchParams } from "meilisearch";
import { createClient } from "@libsql/client/web";
import {buildSearch, randomString, validateJwt} from "./util";
import {jwtCheckMiddleware, jwtValidateMiddleware} from "./middleware";
import {addFavorite, getUserFavorite, removeFavorite} from "./db";
import { zValidator} from "@hono/zod-validator";
import { z } from "zod";

type Bindings = {
  SEARCHTOKEN: string;
  SEARCHHOST: string;
  SEARCHINDEX: string;
  SQL_URL: string;
  SQL_AUTH_TOKEN: string;
  AUTH0_CLIENTID: string;
  AUTH0_DOMAIN: string;
  AUTH0_CALLBACK: string;
  AUTH0_CLIENT_SECRET: string;
  AUTH0_AUDIENCE: string;
  AUTH_SESSION: KVNamespace;
};

type Variables = {
  auth: boolean
  email: string
}

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

app.get("/",jwtCheckMiddleware, async (c) => {
  // Check if cookies are expired
  // Remove if so
  const isLoggedIn = c.var.auth
  if (!isLoggedIn) {
    deleteCookie(c, 'access_token')
    deleteCookie(c, 'name')
  }

  const search = c.req.query('q')

  if (search) {
    let email = getCookie(c, 'name')
    let searchItem = await buildSearch(isLoggedIn, c.env, c.env, search, undefined, undefined, email )
    return c.html(Base({ search, children: searchItem}));

  }

  return c.html(Base({ search}));
});


app.get('/logout', async(c) => {
  deleteCookie(c, 'access_token')
  deleteCookie(c, 'name')
  return c.redirect('/', 302)
})

app.get('/login', async(c) => {
  deleteCookie(c, 'access_token')
  deleteCookie(c, 'name')

  const state = randomString(32)
  await c.env.AUTH_SESSION.put(state, state, {expirationTtl: 60})
  const url = `https://${c.env.AUTH0_DOMAIN}/authorize?response_type=code&client_id=${c.env.AUTH0_CLIENTID}&redirect_uri=${c.env.AUTH0_CALLBACK}&state=${state}&audience=${c.env.AUTH0_AUDIENCE}`
  return c.redirect(url, 302)
})

app.get('/callback', async(c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  if (!code || !state){
    return c.status(401)
  }

  const session = await c.env.AUTH_SESSION.get(state)
  if (!session){
    return c.status(401)
  }

  if (session !== state) {
    return c.status(401)
  }

  try {
    const resp = await fetch(`https://${c.env.AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST',
      headers: {'content-type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: c.env.AUTH0_CLIENTID,
        client_secret: c.env.AUTH0_CLIENT_SECRET,
        code: code,
        redirect_uri: c.env.AUTH0_CALLBACK,
      })
    })

    const json = await resp.json() as { access_token: string, expires_in: number }
    try {
      const jwtRes = await validateJwt(json.access_token, `https://${c.env.AUTH0_DOMAIN}/.well-known/jwks.json`)
      setCookie(c, 'name', jwtRes.email )
      if (!jwtRes.isValid) {
        return c.status(401)
      }
    } catch (e) {
      return c.status(401)
    }

    setCookie(c, 'access_token', json.access_token)

    return c.redirect('/', 302)
  } catch (err) {
    return c.status(401)
  }
})


app.post("/search",jwtCheckMiddleware, zValidator(
    'form',
    z.object({
        search: z.string(),
        category: z.string().optional(),
        year: z.string().optional(),
    })
), async (c) => {
  const isLoggedIn = c.var.auth
  let email = getCookie(c, 'name')

  let body = c.req.valid('form')
  let searchTerm = body.search;
  let categoryFacet = body.category;
  let yearFacet = body.year;


  let searchItem = await buildSearch(isLoggedIn, c.env, c.env, searchTerm, categoryFacet, yearFacet, email )
  return c.html(searchItem);
});

app.post("/favorite/:recipeId",jwtValidateMiddleware, async (c) => {
  const recipeId = c.req.param('recipeId')

  let recipeIdNum = parseInt(recipeId)
  if (isNaN(recipeIdNum)) {
    return c.status(400)
  }

  const sql = createClient({
    url: c.env.SQL_URL,
    authToken: c.env.SQL_AUTH_TOKEN,
  });

  await addFavorite(sql, recipeIdNum, c.var.email)

  return c.html(hasFavorite({recipeId: recipeIdNum}))
})

app.delete("/favorite/:recipeId",jwtValidateMiddleware, async (c) => {
  const recipeId = c.req.param('recipeId')

  let recipeIdNum = parseInt(recipeId)
  if (isNaN(recipeIdNum)) {
    return c.status(400)
  }

  const sql = createClient({
    url: c.env.SQL_URL,
    authToken: c.env.SQL_AUTH_TOKEN,
  });

  await removeFavorite(sql, recipeIdNum, c.var.email)

  return c.html(noFavorite({recipeId: recipeIdNum}))
})

/*
app.post("/note",jwtValidateMiddleware, async (c) => {

})*/

export default app;
