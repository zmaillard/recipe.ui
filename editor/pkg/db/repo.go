package db

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"recipe.editor/pkg/config"
	"strconv"
	"strings"
)

type Recipe struct {
	Issue
	RecipeId        int
	FrontCoverTitle *string
	BackCoverTitle  *string
	Category        string
	Page            int
	Notes           *string
}

type Issue struct {
	IssueNumber int
	StartMonth  string
	EndMonth    string
	Year        int
}

type Category struct {
	Id   int
	Name string
}

func (i Issue) Title() string {
	return fmt.Sprintf("%s and %s %v", i.StartMonth, i.EndMonth, i.Year)
}

func ReMapCategories(cfg *config.Config, fromCategories []int, toCategory int) error {
	url := cfg.BuildDatabaseUrl()
	apiKey := cfg.CloudflareApiKey

	for _, from := range fromCategories {
		// Update Recipe Table With New Categories
		_, err := sendD1Query(url, apiKey, request{
			Parameters: []interface{}{toCategory, from},
			Sql:        "UPDATE recipe SET categoryId = ? WHERE categoryId = ?",
		})
		if err != nil {
			return err
		}

		// Delete category
		_, err = sendD1Query(url, apiKey, request{
			Parameters: []interface{}{from},
			Sql:        "DELETE FROM category WHERE id = ?",
		})
		if err != nil {
			return err
		}
	}

	return nil
}

func GetAllCategories(cfg *config.Config) ([]Category, error) {
	url := cfg.BuildDatabaseUrl()
	apiKey := cfg.CloudflareApiKey
	var categories []Category

	rows, err := sendD1Query(url, apiKey, request{
		Sql: "SELECT id, name FROM category",
	})

	if err != nil {
		return categories, err
	}

	var catResult categoryResult

	for _, result := range rows.Result[0].Results {
		err = json.Unmarshal(result, &catResult)
		if err != nil {
			return categories, err
		}
		category := Category{
			Id:   catResult.Id,
			Name: catResult.Name,
		}

		categories = append(categories, category)

	}

	return categories, nil
}

func allRecipes(cfg *config.Config) ([]Recipe, error) {
	url := cfg.BuildDatabaseUrl()
	apiKey := cfg.CloudflareApiKey
	var recipes []Recipe

	rows, err := sendD1Query(url, apiKey, request{
		Sql: "SELECT r.id,r.titleFrontCover,r.titleBackCover,r.page,r.notes,i.number, i.startMonth, i.endMonth,i.year, c.name FROM recipe r INNER JOIN issue i ON r.issueId = i.id INNER JOIN category c ON r.categoryId = c.id",
	})

	if err != nil {
		return recipes, err
	}

	for _, result := range rows.Result[0].Results {
		var recipeResult recipeResult

		err = json.Unmarshal(result, &recipeResult)
		if err != nil {
			return recipes, err
		}

		recipe := Recipe{
			RecipeId:        recipeResult.Id,
			FrontCoverTitle: recipeResult.TitleFrontCover,
			BackCoverTitle:  recipeResult.TitleBackCover,
			Page:            recipeResult.Page,
			Notes:           recipeResult.Notes,
			Issue: Issue{
				IssueNumber: recipeResult.Number,
				StartMonth:  recipeResult.StartMonth,
				EndMonth:    recipeResult.EndMonth,
				Year:        recipeResult.Year,
			},
			Category: recipeResult.Name,
		}

		recipes = append(recipes, recipe)
	}

	return recipes, nil
}

func addRecord(cfg *config.Config, issueId int, categoryId int, page int, backCover string, frontCover string) error {
	url := cfg.BuildDatabaseUrl()
	apiKey := cfg.CloudflareApiKey
	_, err := sendD1Query(url, apiKey, request{
		Parameters: []interface{}{frontCover, backCover, page, categoryId, issueId},
		Sql:        "INSERT INTO recipe (titleFrontCover, titleBackCover, page, categoryId, issueId) VALUES (?,?,?,?,?)",
	})

	if err != nil {
		return err
	}

	return nil
}

func getIssueNumber(cfg *config.Config, issueNumber int, startMonth string, endMonth string, year int) (int, error) {
	url := cfg.BuildDatabaseUrl()
	apiKey := cfg.CloudflareApiKey
	rows, err := sendD1Query(url, apiKey, request{
		Parameters: []interface{}{issueNumber},
		Sql:        "SELECT id FROM issue WHERE number = ?",
	})

	var issueId int
	if err != nil {
		return issueId, err
	}

	if len(rows.Result) > 0 && len(rows.Result[0].Results) > 0 {
		var idResult idResult
		err = json.Unmarshal(rows.Result[0].Results[0], &idResult)
		if err != nil {
			return issueId, err
		}
		issueId = idResult.Id
	} else {

		rows, err := sendD1Query(url, apiKey, request{
			Parameters: []interface{}{issueNumber, startMonth, endMonth, year},
			Sql:        "INSERT INTO issue (number, startMonth, endMonth, year) VALUES (?,?,?,?) RETURNING id",
		})
		if err != nil {
			return issueId, err
		}

		var idResult idResult
		err = json.Unmarshal(rows.Result[0].Results[0], &idResult)
		issueId = idResult.Id
		if err != nil {
			return issueId, err
		}
	}

	return issueId, nil
}

func getCategory(cfg *config.Config, categoryName string) (int, error) {
	url := cfg.BuildDatabaseUrl()
	apiKey := cfg.CloudflareApiKey
	var categoryId int

	rows, err := sendD1Query(url, apiKey, request{
		Parameters: []interface{}{strings.ToLower(categoryName)},
		Sql:        "SELECT id FROM category WHERE lower(name) = ?",
	})
	if err != nil {
		return categoryId, err
	}

	if len(rows.Result) > 0 && len(rows.Result[0].Results) > 0 {

		var idResult idResult
		err = json.Unmarshal(rows.Result[0].Results[0], &idResult)
		if err != nil {
			return categoryId, err
		}
		categoryId = idResult.Id

	} else {
		rows, err := sendD1Query(url, apiKey, request{
			Parameters: []interface{}{strings.ToTitle(categoryName)},
			Sql:        "INSERT INTO category (name) VALUES (?) RETURNING id",
		})
		if err != nil {
			return categoryId, err
		}

		var idResult idResult
		err = json.Unmarshal(rows.Result[0].Results[0], &idResult)
		categoryId = idResult.Id
		if err != nil {
			return categoryId, err
		}

	}
	return categoryId, nil
}

func (v Recipe) ToIndex() map[string]interface{} {
	idx := map[string]interface{}{
		"recipeId":   strconv.Itoa(v.RecipeId),
		"issue":      v.IssueNumber,
		"months":     strings.Trim(v.StartMonth, " ") + " - " + strings.Trim(v.EndMonth, " "),
		"year":       v.Year,
		"mainTitle":  v.BackCoverTitle,
		"coverTitle": v.FrontCoverTitle,
		"categories": []string{v.Category},
		"page":       v.Page,
		"notes":      v.Notes,
	}

	return idx
}

func sendD1Query(url string, apiKey string, request request) (response, error) {
	toPost, err := json.Marshal(request)
	if err != nil {
		return response{}, err
	}

	client := &http.Client{}
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(toPost))
	if err != nil {
		return response{}, err
	}
	req.Header.Add("Content-Type", "application/json")
	req.Header.Add("Authorization", "Bearer "+apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return response{}, err
	}

	defer resp.Body.Close()

	var resultingJson response
	err = json.NewDecoder(resp.Body).Decode(&resultingJson)
	return resultingJson, err
}

type request struct {
	Parameters []interface{} `json:"params"`
	Sql        string        `json:"sql"`
}

type response struct {
	Result []result `json:"result"`
}

type result struct {
	Results []json.RawMessage `json:"results"`
}

type categoryResult struct {
	Id   int    `json:"id"`
	Name string `json:"name"`
}

type idResult struct {
	Id int `json:"id"`
}

type recipeResult struct {
	Id              int     `json:"id"`
	TitleFrontCover *string `json:"titleFrontCover"`
	TitleBackCover  *string `json:"titleBackCover"`
	Page            int     `json:"page"`
	Notes           *string `json:"notes"`
	Number          int     `json:"number"`
	StartMonth      string  `json:"startMonth"`
	EndMonth        string  `json:"endMonth"`
	Year            int     `json:"year"`
	Name            string  `json:"name"`
}
