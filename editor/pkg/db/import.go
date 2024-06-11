package db

import (
	"fmt"
	"recipe.editor/pkg/config"
	"strconv"
	"strings"
)

func ImportFile(cfg *config.Config, records [][]string, issueNumber int, status func(int, int)) error {

	startMonth, endMonth, err := calculateMonthRange(issueNumber)
	year := calculateYear(issueNumber)
	if err != nil {
		return err
	}

	issueId, err := getIssueNumber(cfg, issueNumber, startMonth, endMonth, year)
	if err != nil {
		return err
	}

	insertCount := 0
	total := len(records)
	status(insertCount, total)

	for _, record := range records {

		category := strings.TrimSpace(record[0])
		categoryId, err := getCategory(cfg, category)
		if err != nil {
			return err
		}

		backCover := strings.TrimSpace(record[1])
		page := strings.TrimSpace(record[2])
		frontCover := strings.TrimSpace(record[3])

		iPage, err := strconv.Atoi(page)
		if err != nil {
			return err
		}

		err = addRecord(cfg, issueId, categoryId, iPage, backCover, frontCover)
		if err != nil {
			return err
		}

		insertCount++
		status(insertCount, total)
	}

	status(total, total)

	return nil
}

func calculateYear(issueNumber int) int {
	return (issueNumber / 6) + 1993
}

func calculateMonthRange(issueNumber int) (string, string, error) {
	switch issueNumber % 6 {
	case 0:
		return "January", "February", nil
	case 1:
		return "March", "April", nil
	case 2:
		return "May", "June", nil
	case 3:
		return "July", "August", nil
	case 4:
		return "September", "October", nil
	case 5:
		return "November", "December", nil
	}

	return "", "", fmt.Errorf("invalid Issue Number")
}
