/*
GetUserFavorite(phoneNumber string, userName string) ([]int, error)
GetRecipe(recipeId int) (Recipe, error)
GetUser(phoneNumber string, userName string) (User, error)
AddFavorite(recipe Recipe, user User) error
RemoveFavorite(recipe Recipe, user User) error*/

const getUserFavorite = async (db, userName) => {
    const rs = await db.execute("SELECT * FROM users");
    console.log(rs);
}

const getRecipe = async (recipeId) => {
}

const getUser = async (phoneNumber, userName) => {
}

const addFavorite = async (recipe, user) => {
}

const removeFavorite = async (recipe, user) => {
}