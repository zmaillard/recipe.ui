package util

import (
	"encoding/csv"
	"os"
)

func Map[T, U comparable](items []T, selector func(T) U) []U {
	var result []U

	for _, v := range items {
		result = append(result, selector(v))
	}

	return result
}

func ToMap[T, K comparable, V comparable](items []T, selector func(T) (K, V)) map[K]V {
	result := make(map[K]V)

	for _, v := range items {
		k, v := selector(v)
		result[k] = v
	}

	return result
}

func ReadCsv(fileName string) ([][]string, error) {
	f, err := os.Open(fileName)

	if err != nil {
		return [][]string{}, err
	}

	defer f.Close()

	r := csv.NewReader(f)

	if _, err := r.Read(); err != nil {
		return [][]string{}, err
	}

	records, err := r.ReadAll()

	if err != nil {
		return [][]string{}, err
	}

	return records, nil
}
