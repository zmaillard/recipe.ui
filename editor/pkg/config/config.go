package config

import (
	"errors"
	"fmt"
	log "github.com/sirupsen/logrus"
	"github.com/spf13/viper"
	_ "github.com/tursodatabase/libsql-client-go/libsql"
	"os"
	"path/filepath"
)

type Config struct {
	SearchBatchSize   int    `mapstructure:"SEARCH_BATCH_SIZE"`
	SearchHost        string `mapstructure:"SEARCH_HOST"`
	SearchAdminKey    string `mapstructure:"SEARCH_ADMIN_API_KEY"`
	SearchIndex       string `mapstructure:"SEARCH_INDEX"`
	CloudflareAccount string `mapstructure:"D1_ACCOUNT"`
	CloudflareApiKey  string `mapstructure:"D1_API_KEY"`
	DatabaseId        string `mapstructure:"D1_DATABASE_ID"`
}

func (c Config) BuildDatabaseUrl() string {
	return fmt.Sprintf("https://api.cloudflare.com/client/v4/accounts/%s/d1/database/%s/query", c.CloudflareAccount, c.DatabaseId)
}

func LoadConfig(path string) (config *Config, err error) {
	viper.AddConfigPath(path)
	viper.AutomaticEnv()
	_, pathErr := os.Stat(filepath.Join(path, ".env"))
	if !errors.Is(pathErr, os.ErrNotExist) {
		viper.SetConfigFile(".env")
	} else {
		viper.BindEnv("D1_ACCOUNT")
		viper.BindEnv("D1_API_KEY")
		viper.BindEnv("D1_DATABASE_ID")
		viper.BindEnv("SEARCH_BATCH_SIZE")
		viper.BindEnv("SEARCH_INDEX")
		viper.BindEnv("SEARCH_HOST")
		viper.BindEnv("SEARCH_ADMIN_API_KEY")
	}

	err = viper.ReadInConfig()
	err = viper.Unmarshal(&config)

	if err != nil {
		log.Println(err)
	}

	return
}
