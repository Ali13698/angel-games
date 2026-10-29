package main

import (
	"crypto/rand"
	"errors"
	"math/big"
)

func randomDie() (int, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(6))
	if err != nil {
		return 0, err
	}
	return int(n.Int64()) + 1, nil
}

func ApplyCommand(
	s State,
	from, kind string,
	payload map[string]any,
) (State, []Event, error) {
	return applyWithDie(s, from, kind, payload, randomDie)
}

func applyWithDie(
	original State,
	from, kind string,
	payload map[string]any,
	die func() (int, error),
) (State, []Event, error) {
	s, err := initialize(original)
	if err != nil {
		return original, nil, err
	}

	seat := -1
	for i, id := range s.Seats {
		if id == from {
			seat = i
		}
	}

	reject := func(message string) (State, []Event, error) {
		return original, nil, errors.New(message)
	}

	if seat == -1 {
		return reject("not a participant")
	}

	events := []Event{}

	if kind == "sync" {
		return publish(s, events)
	}

	if kind == "configure" {
		teams, ok := payload["teams"].(bool)
		if seat != 0 || s.Started || !ok ||
			(teams && len(s.Seats) != 4) {
			return reject("invalid configuration")
		}
		s.Teams = teams
		return publish(s, events)
	}

	if s.Winner >= 0 || seat != s.Turn {
		return reject("not your turn or game over")
	}

	switch kind {
	case "roll":
		if s.Dice != 0 {
			return reject("move first")
		}

		d, err := die()
		if err != nil || d < 1 || d > 6 {
			return reject("random source failed")
		}

		s.Started = true
		s.Dice = d

		if d == 6 {
			s.Sixes++
		} else {
			s.Sixes = 0
		}

		events = append(events, Event{
			"game.rolled",
			map[string]int{
				"seat": seat,
				"dice": d,
			},
		})

		if s.Sixes == 3 || len(legalMoves(s)) == 0 {
			nextTurn(&s)
		}

	case "move":
		value, ok := payload["token"].(float64)
		if !ok || value < 0 || value > 3 ||
			value != float64(int(value)) {
			return reject("invalid token")
		}

		token := int(value)
		allowed := false

		for _, candidate := range legalMoves(s) {
			if candidate == token {
				allowed = true
			}
		}

		if !allowed {
			return reject("illegal move")
		}

		events = move(&s, token)

	default:
		return reject("unknown command")
	}

	return publish(s, events)
}

func publish(s State, events []Event) (State, []Event, error) {
	s.Legal = legalMoves(s)
	events = append(events, Event{"ludo.snapshot", s})
	return s, events, nil
}
