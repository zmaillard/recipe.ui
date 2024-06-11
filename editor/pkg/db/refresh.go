package db

import (
	"fmt"
	"github.com/meilisearch/meilisearch-go"
	"recipe.editor/pkg/config"
)

type RecipeIndex struct {
	RecipeId   string   `json:"recipeId"`
	Issue      int      `json:"issue"`
	Months     string   `json:"months"`
	Year       int      `json:"year"`
	MainTitle  *string  `json:"mainTitle"`
	CoverTitle *string  `json:"coverTitle"`
	Categories []string `json:"categories"`
	Page       int      `json:"page"`
	Notes      *string  `json:"notes"`
}

func (r RecipeIndex) Title() string {
	if r.MainTitle != nil {
		return *r.MainTitle
	}

	return *r.CoverTitle
}

func (r RecipeIndex) String() string {
	return fmt.Sprintf("%s %s, %v", r.Title(), r.Months, r.Year)
}

func RefreshIndex(cfg *config.Config, update func(int, int)) error {

	var batchSize int
	if cfg.SearchBatchSize == 0 {
		batchSize = 10
	} else {
		batchSize = cfg.SearchBatchSize
	}

	client := meilisearch.NewClient(meilisearch.ClientConfig{
		Host:   cfg.SearchHost,
		APIKey: cfg.SearchAdminKey,
	})

	// An index is where the documents are stored.
	index := client.Index(cfg.SearchIndex)

	totalCount := 0

	var items []map[string]interface{}

	recipes, err := allRecipes(cfg)
	if err != nil {
		return err
	}
	total := len(recipes)

	for _, v := range recipes {
		if v.BackCoverTitle != nil {
			t := *v.BackCoverTitle
			fmt.Println(t)
		}

		items = append(items, v.ToIndex())
		totalCount++
		if totalCount%batchSize == 0 {
			_, err := index.AddDocuments(items)
			if err != nil {
				return err
			}

			items = nil
			update(totalCount, total)
		}
	}

	_, err = index.AddDocuments(items)
	update(total, total)

	return err
}
