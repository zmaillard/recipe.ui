import { html } from "hono/html";
import { FacetDistribution, SearchParams, SearchResponse } from "meilisearch";

export const Base = () => html`
  <!DOCTYPE html>
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
      <script src="https://cdn.auth0.com/js/lock/11.x/lock.min.js"></script>

      <meta content="width=device-width,initial-scale=1" name="viewport" />
      <meta charset="UTF-8" />
      <title>Recipe Search</title>
      <script src="https://cdn.jsdelivr.net/npm/js-cookie@3.0.5/dist/js.cookie.min.js"></script>
      <script src="https://unpkg.com/htmx.org@1.9.10"></script>
    </head>

    <body>
      <nav class="navbar" role="navigation" aria-label="main navigation">
        <div class="navbar-end">
          <div class="navbar-item">
            <div class="buttons">
              <a class="button is-light" href="/login"> Log in </a>
            </div>
          </div>
        </div>
      </nav>
      <div>
        <div class="container has-text-centered">
          <div class="column is-6 is-offset-3">
            <div class="box">
              <form hx-post="/search" hx-target="#search-results">
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
      <script>
      var Auth = (function() {

        var wm = new WeakMap();
        var privateStore = {};
        var lock;
      
        function Auth() {
          this.lock = new Auth0Lock(
            '<{yourClientId}>',
            '<{yourDomain}>'
          );
          wm.set(privateStore, {
            appName: "example"
          });
        }
      
        Auth.prototype.getProfile = function() {
          return wm.get(privateStore).profile;
        };
      
        Auth.prototype.authn = function() {
          // Listening for the authenticated event
          this.lock.on("authenticated", function(authResult) {
            // Use the token in authResult to getUserInfo() and save it if necessary
            this.getUserInfo(authResult.accessToken, function(error, profile) {
              if (error) {
                // Handle error
                return;
              }
      
              //we recommend not storing Access Tokens unless absolutely necessary
              wm.set(privateStore, {
                accessToken: authResult.accessToken
              });
      
              wm.set(privateStore, {
                profile: profile
              });
      
            });
          });
        };
        return Auth;
      }());
      </script>
    </body>
  </html>
`;

export const SearchResults = (searchResults: SearchResponse<Record<string, any>, SearchParams>) => html`<div class="columns">
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
        ${searchResults.hits.map((f)=> {
            return <tr><td>{f.recipeId}</td><td>{f.issue}</td><td>{f.months + " " + f.year }</td><td>{f.mainTitle || f.coverTitle}</td><td>{f.page}</td><td>{f.categories.join(", ")}</td></tr>
        })}
      </table>
    </div>
  </div>
  <div class="column is-3">
    <div>
      <nav class="panel">
        <p class="panel-heading">Filter By Category</p>
        ${searchResults.facetDistribution && Object.keys(searchResults.facetDistribution['categories']).map(yr=> {

            return <label class="panel-block">
                <input value={yr} hx-post="/search" hx-target="#search-results" hx-include="#search-input" name="category" type="checkbox" /><span>{yr + " (" + getValue(searchResults.facetDistribution, 'categories', yr )  + ")"}</span>
            </label>
        })}
      </nav>
      <nav class="panel">
        <p class="panel-heading">Filter By Year</p>
        ${searchResults.facetDistribution && Object.keys(searchResults.facetDistribution['year']).map(yr=> {

            return <label class="panel-block">
                <input value={yr} hx-post="/search" hx-target="#search-results" hx-include="#search-input" name="year" type="checkbox" /><span>{yr + " (" + getValue(searchResults.facetDistribution, 'year', yr )  + ")"}</span>
            </label>
        })}
      </nav>
    </div>
  </div>
</div>`;



const getValue = (facet: FacetDistribution | undefined, facetName: string, key: string) : number | string =>  {
    return facet && facet[facetName] && facet[facetName][key] ? facet[facetName][key] : ""
}