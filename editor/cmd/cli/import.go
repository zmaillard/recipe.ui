package main

import (
	"errors"
	"fmt"
	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/spf13/cobra"
	"os"
	"recipe.editor/pkg/config"
	"recipe.editor/pkg/db"
	"recipe.editor/pkg/util"
	"strconv"
	"strings"
	"time"
)

func init() {
	rootCmd.AddCommand(importCmd)
}

var baseStyle = lipgloss.NewStyle().
	BorderStyle(lipgloss.NormalBorder()).
	BorderForeground(lipgloss.Color("240"))

var importProgram *tea.Program

type importUpdateMsg float64
type errorMsg struct{ err error }

type importModel struct {
	approved    bool
	table       table.Model
	progress    progress.Model
	err         error
	issueNumber int
	records     [][]string
	cfg         *config.Config
}

func finalPause() tea.Cmd {
	return tea.Tick(time.Millisecond*750, func(t time.Time) tea.Msg {
		return nil
	})
}

func importFile(cfg *config.Config, issueNumber int, records [][]string) tea.Cmd {
	return func() tea.Msg {
		err := db.ImportFile(cfg, records, issueNumber, func(current int, total int) {
			importProgram.Send(importUpdateMsg(float64(current) / float64(total)))
		})

		if err != nil {
			return errorMsg{err: err}
		}

		return importUpdateMsg(1.0)
	}

}

func (i importModel) Init() tea.Cmd {
	return nil
}

func (i importModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	if msg, ok := msg.(tea.KeyMsg); ok {
		k := msg.String()
		if k == "q" || k == "ctrl+c" || k == "esc" {
			return i, tea.Quit
		}
	}

	if !i.approved {
		return tableUpdate(i, msg)
	} else {
		return progressUpdate(i, msg)
	}
}

func tableUpdate(i importModel, msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "esc":
			if i.table.Focused() {
				i.table.Blur()
			} else {
				i.table.Focus()
			}
		case "enter":
			i.approved = true
			return i, importFile(i.cfg, i.issueNumber, i.records)
		}
	}

	i.table, cmd = i.table.Update(msg)
	return i, cmd
}

func progressUpdate(i importModel, msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		i.progress.Width = msg.Width - padding*2 - 4
		if i.progress.Width > maxWidth {
			i.progress.Width = maxWidth
		}

		return i, nil
	case updateErrorMsg:
		i.err = msg.err
		return i, tea.Quit
	case importUpdateMsg:
		var cmds []tea.Cmd

		if msg >= 1.0 {
			cmds = append(cmds, tea.Sequence(finalPause(), tea.Quit))
		}

		cmds = append(cmds, i.progress.SetPercent(float64(msg)))
		return i, tea.Batch(cmds...)

	case progress.FrameMsg:
		progressModel, cmd := i.progress.Update(msg)
		i.progress = progressModel.(progress.Model)
		return i, cmd

	default:
		return i, nil
	}
}

func (i importModel) View() string {
	if !i.approved {
		return tableView(i)
	} else {
		return progressView(i)
	}
}

func progressView(i importModel) string {
	pad := strings.Repeat(" ", padding)
	return "\n" + pad + i.progress.View() + "\n\n"
}

func tableView(i importModel) string {
	return baseStyle.Render(i.table.View()) + "\n"
}

var importCmd = &cobra.Command{
	Use:   "import [pathToFile] [issueNumber]",
	Short: "Import New Cooks Illustrated Issue",
	Long:  "Import New Cooks Illustrated Issue",
	Args: func(cmd *cobra.Command, args []string) error {
		if len(args) != 2 {
			return errors.New("2 Arguments Are Required")
		}
		if !fileExists(args[0]) {
			return fmt.Errorf("%s Does Not Exist", args[0])
		}

		issueNumber, err := strconv.Atoi(args[1])
		if err != nil || (issueNumber <= 92) {
			return fmt.Errorf("%s Needs To Be A Number Greater Than 92", args[0])
		}

		return nil
	},
	Run: func(cmd *cobra.Command, args []string) {
		issueNumber, _ := strconv.Atoi(args[1])
		cfg, err := config.LoadConfig(".")
		if err != nil {
			fmt.Println("Unable To Load Configuration", err.Error())
			os.Exit(1)
		}

		records, err := util.ReadCsv(args[0])
		columns := []table.Column{
			{Title: "Category", Width: 10},
			{Title: "Back Cover", Width: 20},
			{Title: "Page", Width: 5},
			{Title: "Front Cover", Width: 20},
		}

		var rows []table.Row
		for _, record := range records {
			rows = append(rows, record)
		}

		t := table.New(
			table.WithColumns(columns),
			table.WithRows(rows),
			table.WithFocused(true),
			table.WithHeight(15),
		)

		s := table.DefaultStyles()
		s.Header = s.Header.
			BorderStyle(lipgloss.NormalBorder()).
			BorderForeground(lipgloss.Color("240")).
			BorderBottom(true).
			Bold(false)
		s.Selected = s.Selected.
			Foreground(lipgloss.Color("229")).
			Background(lipgloss.Color("57")).
			Bold(false)
		t.SetStyles(s)

		if err != nil {
			fmt.Println("Unable To Read File: %s", err.Error())
			os.Exit(1)
		}

		m := importModel{
			table:       t,
			progress:    progress.New(progress.WithDefaultGradient()),
			approved:    false,
			cfg:         cfg,
			issueNumber: issueNumber,
			records:     records,
		}

		importProgram = tea.NewProgram(m)

		if _, err = importProgram.Run(); err != nil {
			fmt.Println("Error Running Program: %s", err.Error())
			os.Exit(1)
		}

	},
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return !errors.Is(err, os.ErrNotExist)
}
