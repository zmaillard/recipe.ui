import { D1Database } from "@cloudflare/workers-types";

export interface Recipe {
  front?: string | null;
  back?: string | null;
  page: number;
  category: string;
}

export interface Issue {
  startMonth: string;
  endMonth: string;
  year: number;
  number: number;
}

const getIssueNumber = async (
  db: D1Database,
  issue: Issue,
): Promise<number> => {
  let issueId = await db
    .prepare("SELECT id FROM issue WHERE number = ?")
    .bind(issue.number)
    .first<number>("id");

  if (issueId != null) {
    return issueId;
  }

  issueId = await db
    .prepare(
      "INSERT INTO issue (number, startMonth, endMonth, year) VALUES (?,?,?,?) RETURNING id",
    )
    .bind(issue.number, issue.startMonth, issue.endMonth, issue.year)
    .first<number>("id");

  if (issueId == null) {
    throw new Error("Failed to insert issue");
  }

  return issueId;
};

export const importIssue = async (
  db: D1Database,
  issue: Issue,
  recipes: Recipe[],
): Promise<void> => {
  const issueId = await getIssueNumber(db, issue);
  console.log(issueId);

  for (const recipe of recipes) {
    const categoryId = await getCategory(db, recipe.category);
    console.log(categoryId);
    console.log(recipe.front);
    console.log(recipe.back);
    console.log(recipe.page);
    await db
      .prepare(
        "INSERT INTO recipe (titleFrontCover, titleBackCover, page, categoryId, issueId) VALUES (?,?,?,?,?)",
      )
      .bind(recipe.front, recipe.back, recipe.page, categoryId, issueId)
      .run();
  }
};

const getCategory = async (
  db: D1Database,
  category: string,
): Promise<number> => {
  let categoryId = await db
    .prepare("SELECT id FROM category WHERE lower(name) = ?")
    .bind(category)
    .first<number>("id");

  if (categoryId != null) {
    return categoryId;
  }

  categoryId = await db
    .prepare("INSERT INTO category ('name') VALUES (?) RETURNING id")
    .bind(category)
    .first<number>("id");

  if (categoryId == null) {
    throw new Error("Failed to insert category");
  }

  return categoryId;
};

export const getUserFavorite = async (
  db: D1Database,
  email: string,
): Promise<number[]> => {
  type FavoriteRow = {
    recipe_id: number;
  };

  const { results } = await db
    .prepare(
      "select recipe_id from favorite inner join user u on u.id = favorite.user_id where u.name = ?",
    )
    .bind(email)
    .all<FavoriteRow>();
  return results.map((row) => row.recipe_id as number);
};

export const removeFavorite = async (
  db: D1Database,
  recipeId: number,
  user: string,
): Promise<void> => {
  const getFavorites = await getUserFavorite(db, user);

  // If not a favorite, then ignore
  if (getFavorites.indexOf(recipeId) < 0) {
    return;
  }

  const userId = await getUserIdFromUserName(db, user);
  if (userId < 0) {
    return; // TODO: Throw error
  }
  // Update
  await db
    .prepare("delete from favorite where user_id = ? and  recipe_id = ?")
    .bind(userId, recipeId)
    .run();
};

export const addFavorite = async (
  db: D1Database,
  recipeId: number,
  user: string,
): Promise<void> => {
  const getFavorites = await getUserFavorite(db, user);
  // If already exists, then ignore
  if (getFavorites.indexOf(recipeId) >= 0) {
    return;
  }

  const userId = await getUserIdFromUserName(db, user);
  if (userId < 0) {
    return; // TODO: Throw error
  }
  // Update
  await db
    .prepare("insert into favorite (user_id, recipe_id) values (?, ?)")
    .bind(userId, recipeId)
    .run();
};

const getUserIdFromUserName = async (
  db: D1Database,
  userName: string,
): Promise<number> => {
  type UserRow = {
    id: number;
  };

  const user = await db
    .prepare("select id from user where name = ?")
    .bind(userName)
    .first<UserRow>();

  if (user != null) {
    return user.id;
  }

  return -1; // TODO: Throw error
};
