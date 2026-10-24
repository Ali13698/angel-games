package main

import (
	"errors"
	"math/rand"
)

type State struct {
	Seats  []string `json:"seats"`
	Tokens [4][4]int `json:"tokens"` // 4 players, 4 tokens. -1 = base
	Turn   int      `json:"turn"`
	Dice   int      `json:"dice"`
}

type Event struct { Type string `json:"type"`; Payload any `json:"payload"` }
type Intent struct { From string `json:"from"`; Cmd struct { Type string `json:"type"`; Payload map[string]any `json:"payload"` } `json:"cmd"` }

func ApplyCommand(s State, from string, cmdType string, payload map[string]any) (State, []Event, error) {
	seat := -1
	for i, u := range s.Seats { if u == from { seat = i; break } }
	if seat == -1 { return s, nil, errors.New("not seated") }
	if seat != s.Turn { return s, nil, errors.New("not your turn") }

	if cmdType == "roll" {
		if s.Dice != 0 { return s, nil, errors.New("already rolled") }
		s.Dice = rand.Intn(6) + 1
		return s, []Event{{Type: "ludo.rolled", Payload: map[string]any{"seat": seat, "die": s.Dice}}}, nil
	}

	if cmdType == "move" {
		if s.Dice == 0 { return s, nil, errors.New("roll first") }
		tok := int(payload["token"].(float64))
		if tok < 0 || tok > 3 { return s, nil, errors.New("bad token") }
		
		// منطق ساده شده حرکت
		if s.Tokens[seat][tok] == -1 && s.Dice != 6 { return s, nil, errors.New("need 6") }
		
		if s.Tokens[seat][tok] == -1 { s.Tokens[seat][tok] = 0 } else { s.Tokens[seat][tok] += s.Dice }
		
		events := []Event{{Type: "ludo.moved", Payload: map[string]any{"seat": seat, "token": tok, "position": s.Tokens[seat][tok]}}}
		
		s.Dice = 0
		s.Turn = (s.Turn + 1) % len(s.Seats)
		events = append(events, Event{Type: "turn_changed", Payload: map[string]any{"seat": s.Turn, "user_id": s.Seats[s.Turn]}})
		return s, events, nil
	}
	return s, nil, errors.New("unknown command")
}
