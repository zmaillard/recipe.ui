import { html } from "hono/html";
import { FacetDistribution, SearchParams, SearchResponse } from "meilisearch";

interface Auth0 {
  clientId: string;
  domain: string;
}

export const Base = ({ clientId, domain }: Auth0) => html`
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css"
      />
      <script
        src="https://kit.fontawesome.com/42cfadb274.js"
        crossorigin="anonymous"
      ></script>
      <script src="https://cdn.auth0.com/js/auth0-spa-js/2.0/auth0-spa-js.production.js"></script>
    
      <meta content="width=device-width,initial-scale=1" name="viewport" />
      <meta charset="UTF-8" />
      <title>Recipe Search</title>
      <script src="https://cdn.jsdelivr.net/npm/js-cookie@3.0.5/dist/js.cookie.min.js"></script>
      <script src="https://unpkg.com/htmx.org@1.9.10"></script>
      <script src="//unpkg.com/alpinejs" defer></script>
    </head>

    <body >
        <div x-data="user" >
      <nav class="navbar" role="navigation" aria-label="main navigation">
        <div class="navbar-end">
          <div class="navbar-item">
            <div class="buttons">
              <button class="button is-light" x-on:click="login()">
                Log in
              </button>
            </div>
          </div>
        </div>
      </nav>
      <div>
        <div class="container has-text-centered">
          <div class="column is-6 is-offset-3">
            <div class="box">
              <form hx-post="/search" 
                    hx-target="#search-results"
                    hx-headers='js:{"Authorization": buildA($data)}'
              >
                <div class="field is-grouped">
                  <p class="control is-expanded">
                    <input
                      name="search"
                      type="text"
                      placeholder="Search For Recipes"
                      class="input"
                      id="search-input"
                    />
                  </p>
                  <p class="control">
                    <button class="button is-info" type="submit">Search</button>
                    <button class="button is-text">Reset</button>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
        <div class="container">
          <div class="column is-8 is-offset-2">
            <div class="field is-grouped is-grouped-multiline"></div>
          </div>
        </div>
        <div id="search-results"></div>
      </div>
        </div>
      <script>
          function buildUser() {
              return {
                  client: null,
                  token: "",
                  user: "",
                  async init() {
                      this.client = new auth0.Auth0Client({
                          domain: "${domain}",
                          clientId: "${clientId}",
                      });

                      await this.updateUI()
                        
                      const isAuthenticated = await this.client.isAuthenticated();

                      if (isAuthenticated) {
                          // show the gated content
                          return;
                      }

                      const query = window.location.search;
                      if (query.includes("code=") && query.includes("state=")) {

                          // Process the login state
                          await this.client.handleRedirectCallback();

                          await this.updateUI();

                          // Use replaceState to redirect the user away and remove the querystring parameters
                          window.history.replaceState({}, document.title, "/");
                      }

                  },  async updateUI() {
                      var isAuth = await this.client.isAuthenticated()
                      if (isAuth) {
                          this.token = await this.client.getTokenSilently()
                          this.user = await this.client.getUser()

                          console.log(this.token)
                          console.log(this.user)
                      }

                  }, login() {
                      this.client.loginWithRedirect({
                          authorizationParams: {
                              redirect_uri: window.location.origin,
                          },
                      });
                  }
              }
          }
          
          document.addEventListener('alpine:init', function() {
              Alpine.data('user', buildUser)
          })
      </script>
    </body>
  </html>
`;

export const SearchResults = (
  searchResults: SearchResponse<Record<string, any>, SearchParams>
) => html`<div class="columns">
  <div class="column is-9">
    <div>
      <table class="table is-hoverable is-narrow">
        <thead>
          <tr>
            <th>Id</th>
            <th>Issue</th>
            <th>Date</th>
            <th>Recipe Name</th>
            <th>Page</th>
            <th>Category</th>
          </tr>
        </thead>
        ${searchResults.hits.map((f) => {
          return (
            <tr>
              <td>{f.recipeId}</td>
              <td>{f.issue}</td>
              <td>{f.months + " " + f.year}</td>
              <td>{f.mainTitle || f.coverTitle}</td>
              <td>{f.page}</td>
              <td>{f.categories.join(", ")}</td>
            </tr>
          );
        })}
      </table>
    </div>
  </div>
  <div class="column is-3">
    <div>
      <nav class="panel">
        <p class="panel-heading">Filter By Category</p>
        ${searchResults.facetDistribution &&
        Object.keys(searchResults.facetDistribution["categories"]).map((yr) => {
          return (
            <label class="panel-block">
              <input
                value={yr}
                hx-post="/search"
                hx-target="#search-results"
                hx-include="#search-input"
                name="category"
                type="checkbox"
              />
              <span>
                {yr +
                  " (" +
                  getValue(searchResults.facetDistribution, "categories", yr) +
                  ")"}
              </span>
            </label>
          );
        })}
      </nav>
      <nav class="panel">
        <p class="panel-heading">Filter By Year</p>
        ${searchResults.facetDistribution &&
        Object.keys(searchResults.facetDistribution["year"]).map((yr) => {
          return (
            <label class="panel-block">
              <input
                value={yr}
                hx-post="/search"
                hx-target="#search-results"
                hx-include="#search-input"
                name="year"
                type="checkbox"
              />
              <span>
                {yr +
                  " (" +
                  getValue(searchResults.facetDistribution, "year", yr) +
                  ")"}
              </span>
            </label>
          );
        })}
      </nav>
    </div>
  </div>
</div>`;

const getValue = (
  facet: FacetDistribution | undefined,
  facetName: string,
  key: string
): number | string => {
  return facet && facet[facetName] && facet[facetName][key]
    ? facet[facetName][key]
    : "";
};
