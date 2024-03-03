import {D1Database} from "@cloudflare/workers-types";

export const getUserFavorite = async (db: D1Database, email:string): Promise<number[]> => {
    type FavoriteRow = {
        recipe_id: number;
    }

    const { results } = await db.prepare("select recipe_id from favorite inner join user u on u.id = favorite.user_id where u.name = ?").bind(email).all<FavoriteRow>();
    return results.map((row) => (row.recipe_id as number));
}

export const removeFavorite = async (db: D1Database, recipeId: number, user:string): Promise<void> => {
    const getFavorites = await getUserFavorite(db, user)

    // If not a favorite, then ignore
    if (getFavorites.indexOf(recipeId) < 0) {
        return
    }

    const userId = await getUserIdFromUserName(db, user)
    if (userId < 0) {
        return // TODO: Throw error
    }
    // Update
    await db.prepare( "delete from favorite where user_id = ? and  recipe_id = ?").bind(userId, recipeId).run()
}

export const addFavorite = async (db: D1Database, recipeId: number, user:string): Promise<void> => {
    const getFavorites = await getUserFavorite(db, user)
    // If already exists, then ignore
    if (getFavorites.indexOf(recipeId) >= 0) {
        return
    }

    const userId = await getUserIdFromUserName(db, user)
    if (userId < 0) {
        return // TODO: Throw error
    }
    // Update
    await db.prepare("insert into favorite (user_id, recipe_id) values (?, ?)").bind(userId, recipeId).run()

}

const getUserIdFromUserName = async (db: D1Database, userName: string): Promise<number> => {
    type UserRow = {
        id: number;
    }

    const user = await db.prepare("select id from user where name = ?").bind(userName).first<UserRow>();


    if (user != null) {
        return user.id
    }

    return -1 // TODO: Throw error
}