package main

import (
	"fmt"
	"github.com/charmbracelet/huh"
	"github.com/charmbracelet/huh/spinner"
	"github.com/spf13/cobra"
	"os"
	"recipe.editor/pkg/config"
	"recipe.editor/pkg/db"
	"recipe.editor/pkg/util"
	"sort"
	"strconv"
)

type updateCategory struct {
	FromCategories []string
	ToCategory     string
}

func (u updateCategory) Save(cfg *config.Config, categories map[string]int) error {
	toCategory, ok := categories[u.ToCategory]
	if !ok {
		return fmt.Errorf("Category %s Not Found", u.ToCategory)
	}

	var fromCategories []int
	for _, cat := range u.FromCategories {
		id, ok := categories[cat]
		if !ok {
			return fmt.Errorf("Category %s Not Found", cat)
		}
		fromCategories = append(fromCategories, id)
	}

	err := db.ReMapCategories(cfg, fromCategories, toCategory)
	if err != nil {
		return err
	}

	return nil
}

func init() {
	rootCmd.AddCommand(categoriesCmd)
}

func getCategories(res chan []db.Category, cfg *config.Config) func() {
	return func() {
		var categoryNames []db.Category

		cats, err := db.GetAllCategories(cfg)
		if err != nil {
			res <- categoryNames
			return
		}

		for _, cat := range cats {
			categoryNames = append(categoryNames, cat)
		}

		res <- categoryNames
	}
}

var categoriesCmd = &cobra.Command{
	Use:   "categories",
	Short: "Manage Cooks Illustrated Categories",
	Long:  "Manage Cooks Illustrated Categories",
	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := config.LoadConfig(".")
		if err != nil {
			fmt.Println(err.Error())
			return
		}

		accessible, _ := strconv.ParseBool(os.Getenv("ACCESSIBLE"))
		msg := make(chan []db.Category, 1)
		_ = spinner.New().Title("Loading Categories").Accessible(accessible).Action(getCategories(msg, cfg)).Run()

		model := updateCategory{
			FromCategories: []string{},
			ToCategory:     "",
		}

		categories := <-msg
		catNames := util.Map(categories, func(c db.Category) string {
			return c.Name
		})

		sort.Slice(catNames, func(i, j int) bool {
			return catNames[i] < catNames[j]
		})
		catLookup := util.ToMap(categories, func(c db.Category) (string, int) {
			return c.Name, c.Id
		})

		form := huh.NewForm(huh.NewGroup(huh.NewNote().Title("Manage Categories").Description("Choose Categories To Consolidate")),
			huh.NewGroup(
				huh.NewMultiSelect[string]().
					Title("Choose From Categories").
					Description("Choose A Bunch").
					Options(huh.NewOptions(catNames...)...).
					Validate(func(values []string) error {
						if len(values) <= 0 {
							return fmt.Errorf("At Least One Category Is Required")
						}
						return nil
					}).
					Value(&model.FromCategories).Filterable(true),
				huh.NewSelect[string]().Options(huh.NewOptions(catNames...)...).
					Title("Choose Category To Consolidate To").
					Value(&model.ToCategory),
			)).WithAccessible(accessible)

		err = form.Run()
		if err != nil {
			fmt.Println("Uh oh:", err)
			os.Exit(1)
		}

		err = model.Save(cfg, catLookup)
		if err != nil {
			fmt.Println("Unable To Update Cateories", err)
			os.Exit(1)
		}

		fmt.Println("Categories Updated Successfully")
	}}
