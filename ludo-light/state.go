package main

import "errors"

const goal = 56

type State struct {
	Schema  int      `json:"schema"`
	Seats   []string `json:"seats"`
	Board   [16]int  `json:"board"`
	Turn    int      `json:"turn"`
	Dice    int      `json:"dice"`
	Sixes   int      `json:"sixes"`
	Winner  int      `json:"winner"`
	Teams   bool     `json:"teams"`
	Started bool     `json:"started"`
	Legal   []int    `json:"legal"`
}

type Event struct {
	Type    string `json:"type"`
	Payload any    `json:"payload"`
}

type Intent struct {
	From string `json:"from"`
	Cmd  struct {
		Type    string         `json:"type"`
		Payload map[string]any `json:"payload"`
	} `json:"cmd"`
}

func initialize(s State) (State, error) {
	if len(s.Seats) < 2 || len(s.Seats) > 4 {
		return s, errors.New("requires 2 to 4 seats")
	}

	seen := make(map[string]bool)
	for _, id := range s.Seats {
		if id == "" || seen[id] {
			return s, errors.New("invalid seats")
		}
		seen[id] = true
	}

	if s.Schema == 0 {
		s.Schema = 1
		s.Winner = -1
		s.Turn = 0
		s.Dice = 0
		s.Sixes = 0
		s.Started = false
		s.Teams = false

		for i := range s.Board {
			s.Board[i] = -1
		}

		s.Legal = []int{}
	} else if s.Schema != 1 {
		return s, errors.New("unsupported schema")
	}

	return s, nil
}

func color(s State, seat int) int {
	if len(s.Seats) == 2 {
		return seat * 2
	}
	return seat
}

func allied(s State, a, b int) bool {
	return a == b || (s.Teams && a%2 == b%2)
}

func finished(s State, seat int) bool {
	for token := 0; token < 4; token++ {
		if s.Board[seat*4+token] != goal {
			return false
		}
	}
	return true
}

func nextTurn(s *State) {
	s.Dice = 0
	s.Sixes = 0

	for i := 0; i < len(s.Seats); i++ {
		s.Turn = (s.Turn + 1) % len(s.Seats)
		if !finished(*s, s.Turn) {
			break
		}
	}
}
