import { Hono } from "hono/quick";
import { Base, SearchResults } from "./content";
import { Meilisearch, SearchParams } from "meilisearch";
import { Client as LibsqlClient, createClient } from "@libsql/client/web";

type Bindings = {
  SEARCHTOKEN: string;
  SEARCHHOST: string;
  SEARCHINDEX: string;
  SQL_URL: string;
  SQL_AUTH_TOKEN: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_DOMAIN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
  const sql = createClient({
    url: c.env.SQL_URL,
    authToken: c.env.SQL_AUTH_TOKEN,
  });

  return c.html(Base());
});

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
