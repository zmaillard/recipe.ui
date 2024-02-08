import * as jose from "jose";
import {jwtCheckMiddleware} from "./middleware";
import { createClient } from "@libsql/client/web";
import {getUserFavorite} from "./db";
import {Meilisearch, SearchParams} from "meilisearch";
import {FavoriteResults, SearchResults} from "./content";
import app from "./index";

export function randomString(length: number): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}

interface JwtUser {
    name: string
    email: string
    phoneNumber: string
    isValid: boolean
}


export async function validateJwt(token: string, jwksUrl: string): Promise<JwtUser> {
    const jwks = jose.createRemoteJWKSet(new URL(jwksUrl))

    try {
        const { payload } = await jose.jwtVerify(token, jwks, {
            algorithms: ["RS256"],
        });

        let name = ""
        let email = ""
        let phoneNumber = ""

        if (Object.hasOwn(payload, 'http://sagebrushgis.com/phone_number' )) {
            phoneNumber = payload['http://sagebrushgis.com/phone_number'] as string
        }

        if (Object.hasOwn(payload, 'http://sagebrushgis.com/name' )) {
            name = payload['http://sagebrushgis.com/name'] as string
        }

        if (Object.hasOwn(payload, 'http://sagebrushgis.com/email' )) {
            email = payload['http://sagebrushgis.com/email'] as string
        }
        return {
            name: name,
            email:  email,
            phoneNumber:  phoneNumber,
            isValid: true,
        }
    } catch {
        return {
            name: "",
            email:  "",
            phoneNumber:  "",
            isValid: false,
        }
    }
}

interface SearchClient  {
    SEARCHTOKEN: string;
    SEARCHHOST: string;
    SEARCHINDEX: string;
}

interface SqlClient {
    SQL_URL: string;
    SQL_AUTH_TOKEN: string;
}

export const buildSearch = async (isLoggedIn: boolean, searchParams: SearchClient, sqlClient: SqlClient, searchTerm: string, categoryFacet?: string, yearFacet?:string,  email?:string) => {
    let favorites:number[] = []
    if (isLoggedIn && email) {
        const sql = createClient({
            url: sqlClient.SQL_URL,
            authToken: sqlClient.SQL_AUTH_TOKEN,
        });

        favorites = await getUserFavorite(sql, email)
    }

    const client = new Meilisearch({
        host: searchParams.SEARCHHOST,
        apiKey: searchParams.SEARCHTOKEN,
    });

    const index = client.index(searchParams.SEARCHINDEX);
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

    const searchRes = await index.search(searchTerm, searchObj);
    return SearchResults(searchRes, isLoggedIn, favorites);
}


export const buildFavorites = async (searchParams: SearchClient, sqlClient: SqlClient, email:string) => {
        const sql = createClient({
            url: sqlClient.SQL_URL,
            authToken: sqlClient.SQL_AUTH_TOKEN,
        });

       const  favorites = await getUserFavorite(sql, email)


    const client = new Meilisearch({
        host: searchParams.SEARCHHOST,
        apiKey: searchParams.SEARCHTOKEN,
    });

    const index = client.index(searchParams.SEARCHINDEX);
    const filter = favorites.map((id) => (`recipeId = ${id}`)).join(" OR ")

    let documents = await index.getDocuments({filter: `(${filter})`});

    return FavoriteResults(documents);
}