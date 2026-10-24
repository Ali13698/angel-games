package main

import "errors"

type State struct {
	Board  [9]int   `json:"board"` // 0 empty, 1 p1, 2 p2
	Turn   int      `json:"turn"`
	Seats  []string `json:"seats"`
	Winner int      `json:"winner"` // 0: none, 1: p1, 2: p2, 3: draw
}

type Event struct { Type string `json:"type"`; Payload any `json:"payload"` }
type Intent struct { From string `json:"from"`; Cmd struct { Type string `json:"type"`; Payload map[string]any `json:"payload"` } `json:"cmd"` }

// تابع بررسی برنده شدن
func checkWin(b [9]int, p int) bool {
	lines := [8][3]int{
		{0, 1, 2}, {3, 4, 5}, {6, 7, 8}, // ردیف‌ها
		{0, 3, 6}, {1, 4, 7}, {2, 5, 8}, // ستون‌ها
		{0, 4, 8}, {2, 4, 6},            // اریب‌ها
	}
	for _, l := range lines {
		if b[l[0]] == p && b[l[1]] == p && b[l[2]] == p { return true }
	}
	return false
}

// تابع بررسی پر شدن صفحه (مساوی)
func isFull(b [9]int) bool {
	for _, v := range b { if v == 0 { return false } }
	return true
}

func ApplyCommand(s State, from string, cmdType string, payload map[string]any) (State, []Event, error) {
	if cmdType != "move" { return s, nil, errors.New("unknown cmd") }
	if s.Winner != 0 { return s, nil, errors.New("game is already over") }

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
	events := []Event{{Type: "game.moved", Payload: map[string]any{"cell": cell, "player": pNum}}}

	// ✅ چک کردن برد یا مساوی
	if checkWin(s.Board, pNum) {
		s.Winner = pNum
		events = append(events, Event{Type: "game.over", Payload: map[string]any{"winner": pNum}})
	} else if isFull(s.Board) {
		s.Winner = 3 // 3 یعنی مساوی
		events = append(events, Event{Type: "game.over", Payload: map[string]any{"winner": 3}})
	} else {
		// اگر بازی ادامه داشت، نوبت عوض میشه
		s.Turn = (s.Turn + 1) % 2
		events = append(events, Event{Type: "turn_changed", Payload: map[string]any{"turn": s.Turn}})
	}
	
	return s, events, nil
}
