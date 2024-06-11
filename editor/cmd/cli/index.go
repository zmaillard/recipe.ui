package main

import (
	"fmt"
	"github.com/charmbracelet/bubbles/progress"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/spf13/cobra"
	"os"
	"recipe.editor/pkg/config"
	"recipe.editor/pkg/db"
	"strings"
)

const (
	padding  = 2
	maxWidth = 80
)

var helpStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("#626262")).Render

func init() {
	rootCmd.AddCommand(indexCmd)
}

type refreshIndexModel struct {
	progress progress.Model
	err      error
}

var p *tea.Program

type updateMsg float64

type updateErrorMsg struct{ err error }

func (r refreshIndexModel) Init() tea.Cmd {
	return nil
}

func (r refreshIndexModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		return r, tea.Quit
	case tea.WindowSizeMsg:
		r.progress.Width = msg.Width - padding*2 - 4
		if r.progress.Width > maxWidth {
			r.progress.Width = maxWidth
		}

		return r, nil
	case updateErrorMsg:
		r.err = msg.err
		return r, tea.Quit
	case updateMsg:
		var cmds []tea.Cmd

		if msg >= 1.0 {
			cmds = append(cmds, tea.Quit)
		}

		cmds = append(cmds, r.progress.SetPercent(float64(msg)))
		return r, tea.Batch(cmds...)

	case progress.FrameMsg:
		progressModel, cmd := r.progress.Update(msg)
		r.progress = progressModel.(progress.Model)
		return r, cmd

	default:
		return r, nil
	}

}

func (r refreshIndexModel) View() string {
	if r.err != nil {
		return "Error refreshing index: " + r.err.Error() + "\n"
	}

	pad := strings.Repeat(" ", padding)
	return "\n" + pad + r.progress.View() + "\n\n" + helpStyle("Press any key to quit")
}

var indexCmd = &cobra.Command{
	Use:   "index",
	Short: "Rebuild Cooks Illustrated Index",
	Long:  "Rebuild Cooks Illustrated Index",
	Run: func(cmd *cobra.Command, args []string) {

		cfg, err := config.LoadConfig(".")
		if err != nil {
			fmt.Println(err.Error())
			os.Exit(1)
		}

		m := refreshIndexModel{
			progress: progress.New(progress.WithDefaultGradient()),
		}

		p = tea.NewProgram(m)

		go func() {
			err := db.RefreshIndex(cfg, func(cur int, total int) {
				p.Send(updateMsg(float64(cur) / float64(total)))
			})
			if err != nil {
				p.Send(updateErrorMsg{err})
			}
		}()

		if _, err := p.Run(); err != nil {
			fmt.Println("Error updating index:", err)
			os.Exit(1)
		}
	},
}
