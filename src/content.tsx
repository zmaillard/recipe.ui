import {html} from "hono/html";
import {FacetDistribution, Hit, ResourceResults, SearchParams, SearchResponse} from "meilisearch";


export const Base = (props: { search?: string; children?: any }) => html`
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
        <script src="https://unpkg.com/htmx.org@1.9.10"></script>
        <script src="https://unpkg.com/htmx.org/dist/ext/loading-states.js"></script>
        <script src="//unpkg.com/alpinejs" defer></script>
        <meta content="width=device-width,initial-scale=1" name="viewport"/>
        <meta charset="UTF-8"/>
        <title>Recipe Search</title>
    </head>

    <body hx-ext="loading-states">
        <nav class="navbar" role="navigation" aria-label="main navigation">
            <div class="navbar-end">
                <div class="navbar-item"  x-data="user">
                    <template x-if="loggedIn">
                        <div class="buttons">
                            <a href="/favorite" class="button is-light">
                                Favorites
                            </a>
                            <a href="/logout" class="button is-light">
                                Log Out
                            </a>
                        </div>
                    </template>
                    <template x-if="!loggedIn">
                        <div class="buttons">
                            <a href="/login" class="button is-light">
                                Log in
                            </a>
                        </div>
                    </template>
                </div>
            </div>
        </nav>
        <section class="section">
            <div class="container has-text-centered">
                <div class="column is-6 is-offset-3">
                    <div class="box">
                        <form hx-post="/search"
                              hx-target="#search-results"
                              data-loading-target="#search-button"
                        >
                            <div class="field is-grouped">
                                <p class="control is-expanded">
                                    <input
                                            name="search"
                                            type="text"
                                            placeholder="Search For Recipes"
                                            class="input"
                                            id="search-input"
                                            value="${props.search ?? props.search}"
                                    />
                                </p>
                                <p class="control">
                                    <button data-loading-class="is-loading" id="search-button" class="button is-info"  type="submit">Search</button>
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
            <div id="search-results">
                ${props.children}
            </div>
        </section>
    <script>
        document.addEventListener('alpine:init', () => {
            Alpine.data('user', () => ({
                loggedIn: false,
                name: "",
               init() {
                   if (document.cookie.indexOf('access_token=') === -1 /*|| document.cookie.indexOf('name=') === -1*/) {
                       this.loggedIn = false
                       this.name = ''
                   } else {
                       this.loggedIn = true
                       this.name = "Placeholder"  //document.cookie.split('; ').find(row => row.startsWith('name')).split('=')[1]
                   }
               } 
            }))
        })
    </script>
    </body>
    </html>
`;

export const SearchResults = (
    searchResults: SearchResponse<Record<string, any>, SearchParams>,
    isLoggedIn: boolean,
    favorites: number[]
) => (
    <div class="columns">
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
                        {isLoggedIn && <th>Favorite</th> }
                    </tr>
                    </thead>
                    {searchResults.hits.map((f) => {
                        return (
                                <tr>
                                    <td>{f.recipeId}</td>
                                    <td>{f.issue}</td>
                                    <td>{f.months + " " + f.year}</td>
                                    <td>{f.mainTitle || f.coverTitle}</td>
                                    <td>{f.page}</td>
                                    <td>{f.categories.join(", ")}</td>
                                    {isLoggedIn && buildFavorite ({f: f, favorites: favorites})}
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
                    {searchResults.facetDistribution &&
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
                {`${yr} (${getValue(searchResults.facetDistribution, "categories", yr)})`}
              </span>
                                </label>
                        );
                    })}
                </nav>
                <nav class="panel">
                    <p class="panel-heading">Filter By Year</p>
                    {searchResults.facetDistribution &&
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
                {`${yr} (${getValue(searchResults.facetDistribution, "year", yr)})`}

              </span>
                                </label>
                        );
                    })}
                </nav>
            </div>
        </div>
    </div> )


export const FavoriteResults = (
    searchResults: ResourceResults<Record<string, any>[]>
) => (
    <div class="columns">
        <div class="column is-12">
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
                    {searchResults.results.map((f) => {
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
    </div> )


export const hasFavorite = (props: { recipeId: number }) =>
    <td>
        <div hx-delete={`/favorite/${props.recipeId}`}>
            <i class="fas fa-star"></i>
        </div>
    </td>


export const noFavorite = (props: { recipeId: number }) =>
    <td>
        <div hx-post={`/favorite/${props.recipeId}`}>
            <i class="fa-regular fa-star"></i>
        </div>
    </td>



const getValue = (
    facet: FacetDistribution | undefined,
    facetName: string,
    key: string
): number | string => {
    return facet && facet[facetName] && facet[facetName][key]
        ? facet[facetName][key]
        : "";
};

function buildFavorite(props:{ f: Hit<Record<string, any>>, favorites: number[]}) {
    const hasFavorite = props.favorites.indexOf(parseInt(props.f.recipeId)) >= 0
    if (hasFavorite) {
        return (
            <td>
                <div hx-delete={`/favorite/${props.f.recipeId}`} hx-target="closest td" hx-swap="outerHTML">
                    <i class="fas fa-star"></i>
                </div>
            </td>
        )
    } else {
        return (
            <td>
                <div hx-post={`/favorite/${props.f.recipeId}`}  hx-target="closest td" hx-swap="outerHTML">
                    <i class="fa-regular fa-star"></i>
                </div>
            </td>
        )
    }
}