package main

import (
	"errors"
	"math/rand"
)

type State struct {
	Board  [16]int `json:"board"` // 4 players, 4 tokens. -1=base, 0-52=path, 53-57=home
	Turn   int     `json:"turn"`
	Seats  []string `json:"seats"`
	Dice   int     `json:"dice"`
	Winner int     `json:"winner"`
}

type Event struct { Type string `json:"type"`; Payload any `json:"payload"` }
type Intent struct { From string `json:"from"`; Cmd struct { Type string `json:"type"`; Payload map[string]any `json:"payload"` } `json:"cmd"` }

func ApplyCommand(s State, from string, cmdType string, payload map[string]any) (State, []Event, error) {
	if s.Winner != 0 { return s, nil, errors.New("game over") }
	seat := -1
	for i, u := range s.Seats { if u == from { seat = i; break } }
	if seat == -1 || seat != s.Turn { return s, nil, errors.New("not your turn") }

	if cmdType == "roll" {
		if s.Dice != 0 { return s, nil, errors.New("already rolled") }
		s.Dice = rand.Intn(6) + 1
		return s, []Event{{Type: "game.rolled", Payload: map[string]any{"dice": s.Dice, "seat": seat}}}, nil
	}

	if cmdType == "move" {
		if s.Dice == 0 { return s, nil, errors.New("roll first") }
		tokFloat, ok := payload["token"].(float64)
		if !ok { return s, nil, errors.New("bad token") }
		tok := int(tokFloat)
		if tok < 0 || tok > 3 { return s, nil, errors.New("invalid token") }

		idx := seat*4 + tok
		pos := s.Board[idx]
		
		if pos == -1 && s.Dice != 6 { return s, nil, errors.New("need 6 to exit") }
		
		newPos := pos + s.Dice
		if newPos > 57 { newPos = 57 } // Finish line
		s.Board[idx] = newPos
		
		events := []Event{{Type: "game.moved", Payload: map[string]any{"token": idx, "pos": newPos, "seat": seat}}}
		
		s.Dice = 0
		if newPos != 57 { // If not finished, next turn
			s.Turn = (s.Turn + 1) % len(s.Seats)
			events = append(events, Event{Type: "turn_changed", Payload: map[string]any{"turn": s.Turn}})
		}
		return s, events, nil
	}
	return s, nil, errors.New("unknown cmd")
}
