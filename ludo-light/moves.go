package main

func legalMoves(s State) []int {
	moves := []int{}
	if s.Dice == 0 || s.Winner >= 0 {
		return moves
	}
	for token := 0; token < 4; token++ {
		pos := s.Board[s.Turn*4+token]
		if (pos == -1 && s.Dice == 6) ||
			(pos >= 0 && pos+s.Dice <= goal) {
			moves = append(moves, token)
		}
	}
	return moves
}

func square(s State, seat, pos int) int {
	return (color(s, seat)*13 + pos) % 52
}

func safe(square int) bool {
	return square%13 == 0 || square%13 == 8
}

func capture(s *State, seat, pos int) []int {
	captured := []int{}
	if pos > 50 {
		return captured
	}

	destination := square(*s, seat, pos)
	if safe(destination) {
		return captured
	}

	for other := range s.Seats {
		if allied(*s, seat, other) {
			continue
		}
		for token := 0; token < 4; token++ {
			index := other*4 + token
			p := s.Board[index]
			if p >= 0 && p <= 50 &&
				square(*s, other, p) == destination {
				s.Board[index] = -1
				captured = append(captured, index)
			}
		}
	}
	return captured
}

func move(s *State, token int) []Event {
	seat := s.Turn
	index := seat*4 + token
	pos := s.Board[index]

	if pos == -1 {
		pos = 0
	} else {
		pos += s.Dice
	}
	s.Board[index] = pos

	captured := capture(s, seat, pos)
	events := []Event{
		{
			"game.moved",
			map[string]int{
				"seat":  seat,
				"token": token,
				"pos":   pos,
			},
		},
	}

	if len(captured) > 0 {
		events = append(events, Event{
			"ludo.captured",
			map[string]any{"tokens": captured},
		})
	}

	won := finished(*s, seat)
	if s.Teams {
		won = won && finished(*s, (seat+2)%4)
	}

	bonus := s.Dice == 6 || pos == goal || len(captured) > 0
	s.Dice = 0

	if won {
		s.Winner = seat
		events = append(events, Event{
			"game.over",
			map[string]int{"winner": seat},
		})
	} else if !bonus || finished(*s, seat) {
		nextTurn(s)
	}

	return events
}
