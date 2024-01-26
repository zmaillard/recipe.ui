import { Hono } from "hono/quick";
import { setCookie, deleteCookie } from "hono/cookie"
import { Base, SearchResults } from "./content";
import { Meilisearch, SearchParams } from "meilisearch";
import { Client as LibsqlClient, createClient } from "@libsql/client/web";
import jwt from '@tsndr/cloudflare-worker-jwt'

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
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
  const sql = createClient({
    url: c.env.SQL_URL,
    authToken: c.env.SQL_AUTH_TOKEN,
  });

  return c.html(Base({clientId: c.env.AUTH0_CLIENTID, domain: c.env.AUTH0_DOMAIN}));
});

app.get('/login', async(c) => {
  deleteCookie(c, 'id_token')
  deleteCookie(c, 'access_token')

  const state = "abc"
  const url = `https://${c.env.AUTH0_DOMAIN}/authorize?response_type=code&client_id=${c.env.AUTH0_CLIENTID}&redirect_uri=${c.env.AUTH0_CALLBACK}&state=${state}&audience=${c.env.AUTH0_AUDIENCE}`
  return c.redirect(url, 302)
})

app.get('/callback', async(c) => {
  const code = c.req.query('code')
  if (!code) {
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
      console.log(json)
      const isValid= jwt.verify(json.access_token,c.env.AUTH0_CLIENT_SECRET)
    } catch (e) {
      console.log(e)

      return c.status(401)
    }

    //setCookie(c, 'id_token', json.id_token)
    setCookie(c, 'access_token', json.access_token)

    return c.redirect('/', 302)
  } catch (err) {
    return c.status(401)
  }
})


app.post("/search", async (c) => {
  const client = new Meilisearch({
    host: c.env.SEARCHHOST,
    apiKey: c.env.SEARCHTOKEN,
  });

  const index = client.index(c.env.SEARCHINDEX);
  let body = await c.req.parseBody();
  console.log(body);
  let searchTerm = body["search"].toString();
  let categoryFacet = body["category"];
  let yearFacet = body["year"];
  let filters: string[] = [];

  if (yearFacet) {
    filters = ["year = " + yearFacet];
  }
  if (categoryFacet) {
    filters = ["categories = '" + categoryFacet + "'"];
  }

  let searchObj: SearchParams = { facets: ["categories", "year"] };

  if (filters.length > 0) {
    searchObj.filter = filters;
  }
  const search = await index.search(searchTerm, searchObj);

  return c.html(SearchResults(search));
});

export default app;
