package main

import "errors"

type State struct {
	Board        [9]int   `json:"board"`
	Turn         int      `json:"turn"`
	Seats        []string `json:"seats"`
	Winner       int      `json:"winner"`
	TimeoutCount [2]int   `json:"timeoutCount"`
}

type Event struct { Type string `json:"type"`; Payload any `json:"payload"` }
type Intent struct { From string `json:"from"`; Cmd struct { Type string `json:"type"`; Payload map[string]any `json:"payload"` } `json:"cmd"` }

func checkWin(b [9]int, p int) bool {
	lines := [8][3]int{
		{0, 1, 2}, {3, 4, 5}, {6, 7, 8},
		{0, 3, 6}, {1, 4, 7}, {2, 5, 8},
		{0, 4, 8}, {2, 4, 6},
	}
	for _, l := range lines {
		if b[l[0]] == p && b[l[1]] == p && b[l[2]] == p { return true }
	}
	return false
}

func isFull(b [9]int) bool {
	for _, v := range b { if v == 0 { return false } }
	return true
}

func ApplyCommand(s State, from string, cmdType string, payload map[string]any) (State, []Event, error) {
	if s.Winner != 0 { return s, nil, errors.New("game is already over") }

	// ✅ مدیریت تایم اوت (بدون چک کردن هویت، چون از طرف سرور است)
	if cmdType == "timeout" {
		seat := s.Turn
		s.TimeoutCount[seat]++
		if s.TimeoutCount[seat] >= 2 {
			s.Winner = (seat + 1) % 2 + 1
			return s, []Event{{Type: "game.over", Payload: map[string]any{"winner": s.Winner, "reason": "timeout"}}}, nil
		}
		
		// بار اول: یک خانه خالی را انتخاب کن و بجای بازیکن بگذار
		cell := -1
		for i := 0; i < 9; i++ {
			if s.Board[i] == 0 { cell = i; break }
		}
		if cell == -1 { return s, nil, errors.New("board full") }
		
		pNum := s.Turn + 1
		s.Board[cell] = pNum
		events := []Event{{Type: "game.moved", Payload: map[string]any{"cell": cell, "player": pNum}}}
		
		if checkWin(s.Board, pNum) {
			s.Winner = pNum
			events = append(events, Event{Type: "game.over", Payload: map[string]any{"winner": pNum}})
		} else if isFull(s.Board) {
			s.Winner = 3
			events = append(events, Event{Type: "game.over", Payload: map[string]any{"winner": 3}})
		} else {
			s.Turn = (s.Turn + 1) % 2
			events = append(events, Event{Type: "turn_changed", Payload: map[string]any{"turn": s.Turn}})
		}
		return s, events, nil
	}

	// حرکات عادی (توسط کاربر)
	if cmdType != "move" { return s, nil, errors.New("unknown cmd") }
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

	if checkWin(s.Board, pNum) {
		s.Winner = pNum
		events = append(events, Event{Type: "game.over", Payload: map[string]any{"winner": pNum}})
	} else if isFull(s.Board) {
		s.Winner = 3
		events = append(events, Event{Type: "game.over", Payload: map[string]any{"winner": 3}})
	} else {
		s.Turn = (s.Turn + 1) % 2
		events = append(events, Event{Type: "turn_changed", Payload: map[string]any{"turn": s.Turn}})
	}
	
	return s, events, nil
}
