package main

import "errors"

type State struct {
	Board [9]int `json:"board"` // 0 empty, 1 p1, 2 p2
	Turn  int    `json:"turn"`
}

type Event struct { Type string `json:"type"`; Payload any `json:"payload"` }
type Intent struct { From string `json:"from"`; Cmd struct { Type string `json:"type"`; Payload map[string]any `json:"payload"` } `json:"cmd"` }

func ApplyCommand(s State, from string, cmdType string, payload map[string]any) (State, []Event, error) {
	if cmdType != "move" { return s, nil, errors.New("unknown cmd") }
	
	cellFloat, ok := payload["cell"].(float64)
	if !ok { return s, nil, errors.New("bad cell") }
	cell := int(cellFloat)
	if cell < 0 || cell > 8 || s.Board[cell] != 0 { return s, nil, errors.New("invalid move") }

	// فرض می‌کنیم بازیکن ۱ (id=1001) و بازیکن ۲ (id=bot_1)
	pNum := 1
	if s.Turn == 1 { pNum = 2 }
	s.Board[cell] = pNum
	s.Turn = (s.Turn + 1) % 2

	events := []Event{
		{Type: "game.moved", Payload: map[string]any{"cell": cell, "player": pNum}},
		{Type: "turn_changed", Payload: map[string]any{"turn": s.Turn}},
	}
	return s, events, nil
}
