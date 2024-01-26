import {html} from "hono/html";
import {FacetDistribution, Hit, SearchParams, SearchResponse} from "meilisearch";

export const Base = () => html`
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

        <meta content="width=device-width,initial-scale=1" name="viewport"/>
        <meta charset="UTF-8"/>
        <title>Recipe Search</title>
        <script src="https://unpkg.com/htmx.org@1.9.10"></script>
    </head>

    <body>
    <div x-data="user">
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
    </body>
    </html>
`;

export const SearchResults = (
    searchResults: SearchResponse<Record<string, any>, SearchParams>,
    isLoggedIn: boolean,
    favorites: string[]
) => html`
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
                        ${isLoggedIn && <th>Favorite</th> }
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
                                    {isLoggedIn && buildFavorite(f, favorites)}
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

function buildFavorite(f: Hit<Record<string, any>>, favorites: string[]) {
    const hasFavorite = favorites.indexOf(f.recipeId) >= 0
    if (hasFavorite) {
        return html`
            <td>
                <div hx-delete=${`/favorite/${f.recipeId}`}>
                    <i class="fas fa-star"></i>
                </div>
            </td>
        `
    } else {
        return html`
            <td>
                <div hx-post=${`/favorite/${f.recipeId}`}>
                    <i class="fa-regular fa-star"></i>
                </div>
            </td>
        `
    }

}