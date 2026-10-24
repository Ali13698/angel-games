package main

import "errors"

type State struct {
	Board [9]int   `json:"board"` // 0 empty, 1 p1, 2 p2
	Turn  int      `json:"turn"`
	Seats []string `json:"seats"` // ✅ اضافه شدن صندلی‌ها برای چک کردن نوبت
}

type Event struct { Type string `json:"type"`; Payload any `json:"payload"` }
type Intent struct { From string `json:"from"`; Cmd struct { Type string `json:"type"`; Payload map[string]any `json:"payload"` } `json:"cmd"` }

func ApplyCommand(s State, from string, cmdType string, payload map[string]any) (State, []Event, error) {
	if cmdType != "move" { return s, nil, errors.New("unknown cmd") }
	
	// ✅ چک کردن اینکه آیا این کاربر واقعاً در بازی هست و نوبتش هست یا نه
	seat := -1
	for i, u := range s.Seats { if u == from { seat = i; break } }
	if seat == -1 { return s, nil, errors.New("not seated") }
	if seat != s.Turn { return s, nil, errors.New("not your turn") }

	cellFloat, ok := payload["cell"].(float64)
	if !ok { return s, nil, errors.New("bad cell") }
	cell := int(cellFloat)
	if cell < 0 || cell > 8 || s.Board[cell] != 0 { return s, nil, errors.New("invalid move") }

	pNum := 1
	if s.Turn == 1 { pNum = 2 }
	s.Board[cell] = pNum
	s.Turn = (s.Turn + 1) % 2

	events := []Event{
		{Type: "game.moved", Payload: map[string]any{"cell": cell, "player": pNum}},
		{Type: "turn_changed", Payload: map[string]any{"turn": s.Turn, "seat": s.Turn}},
	}
	return s, events, nil
}
