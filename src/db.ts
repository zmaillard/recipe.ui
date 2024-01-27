/*
GetUserFavorite(phoneNumber string, userName string) ([]int, error)
GetRecipe(recipeId int) (Recipe, error)
GetUser(phoneNumber string, userName string) (User, error)
AddFavorite(recipe Recipe, user User) error
RemoveFavorite(recipe Recipe, user User) error*/

import {Client} from "@libsql/client/web";

export const getUserFavorite = async (db: Client, email:string): Promise<number[]> => {
    const rs = await db.execute({sql: "select recipe_id from favorite inner join user u on u.id = favorite.user_id where u.name = ?", args:[ email]});
    return rs.rows.map((row) => (row[0] as number));
}

export const removeFavorite = async (db: Client, recipeId: number, user:string): Promise<void> => {
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
    await db.execute({sql: "delete from favorite where user_id = ? and  recipe_id = ?", args: [userId, recipeId]})
}

export const addFavorite = async (db: Client, recipeId: number, user:string): Promise<void> => {
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
    await db.execute({sql: "insert into favorite (user_id, recipe_id) values (?, ?)", args: [userId, recipeId]})

}

const getUserIdFromUserName = async (db: Client, userName: string): Promise<number> => {
    const rs = await db.execute({sql: "select id from user where name = ?", args:[ userName]});

    if (rs.rows.length > 0) {
        return rs.rows[0][0] as number
    }

    return -1 // TODO: Throw error
}

/*
const getRecipe = async (recipeId) => {
}

const getUser = async (phoneNumber, userName) => {
}



 */