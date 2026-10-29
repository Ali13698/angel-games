package main

import (
	"errors"
	"reflect"
	"testing"
)

func initial(t *testing.T, count int) State {
	t.Helper()

	s, err := initialize(State{
		Seats: []string{"a", "b", "c", "d"}[:count],
	})
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func command(
	t *testing.T,
	s State,
	kind string,
	token, die int,
) State {
	t.Helper()

	next, _, err := applyWithDie(
		s,
		s.Seats[s.Turn],
		kind,
		map[string]any{"token": float64(token)},
		func() (int, error) { return die, nil },
	)
	if err != nil {
		t.Fatal(err)
	}
	return next
}

func TestBootstrapAndMembership(t *testing.T) {
	s, _, err := ApplyCommand(
		State{Seats: []string{"a", "b"}},
		"b",
		"sync",
		nil,
	)
	if err != nil || s.Winner != -1 ||
		s.Schema != 1 || s.Board[0] != -1 {
		t.Fatal(s, err)
	}

	if _, _, err = ApplyCommand(
		s, "intruder", "sync", nil,
	); err == nil {
		t.Fatal("outsider accepted")
	}

	if _, err = initialize(
		State{Seats: []string{"a", "a"}},
	); err == nil {
		t.Fatal("duplicate seats accepted")
	}
}

func TestRollAndExit(t *testing.T) {
	s := initial(t, 2)
	s = command(t, s, "roll", 0, 2)

	if s.Turn != 1 || s.Dice != 0 {
		t.Fatal("no move should pass turn")
	}

	s = command(t, s, "roll", 0, 6)
	if len(s.Legal) != 4 {
		t.Fatal(s.Legal)
	}

	s = command(t, s, "move", 0, 0)
	if s.Board[4] != 0 || s.Turn != 1 || s.Dice != 0 {
		t.Fatal("six must exit at start and retain turn")
	}
}

func TestThreeSixes(t *testing.T) {
	s := initial(t, 2)

	for i := 0; i < 2; i++ {
		s = command(t, s, "roll", 0, 6)
		s = command(t, s, "move", 0, 0)
	}

	before := s.Board
	s = command(t, s, "roll", 0, 6)

	if s.Turn != 1 || s.Dice != 0 ||
		s.Board != before || s.Sixes != 0 {
		t.Fatal("third six must forfeit without moving")
	}
}

func TestRejectWithoutMutation(t *testing.T) {
	s := initial(t, 2)

	cases := []struct {
		from, kind string
		payload    map[string]any
	}{
		{"b", "roll", nil},
		{"a", "move", map[string]any{"token": 0.5}},
		{"a", "move", map[string]any{"token": float64(0)}},
		{"a", "move", map[string]any{"token": float64(4)}},
		{"a", "unknown", nil},
	}

	for _, c := range cases {
		next, _, err := ApplyCommand(s, c.from, c.kind, c.payload)
		if err == nil || !reflect.DeepEqual(next, s) {
			t.Fatal("rejected command changed state", c)
		}
	}

	_, _, err := applyWithDie(
		s,
		"a",
		"roll",
		nil,
		func() (int, error) {
			return 0, errors.New("entropy unavailable")
		},
	)
	if err == nil {
		t.Fatal("random failure ignored")
	}
}

func TestExactGoalAndWin(t *testing.T) {
	s := initial(t, 2)
	s.Board[0] = 55
	s.Dice = 2

	if len(legalMoves(s)) != 0 {
		t.Fatal("overshoot allowed")
	}

	for i := 1; i < 4; i++ {
		s.Board[i] = goal
	}

	s.Dice = 1
	s = command(t, s, "move", 0, 0)

	if s.Winner != 0 || len(s.Legal) != 0 {
		t.Fatal("seat zero must win")
	}

	if _, _, err := ApplyCommand(
		s, "a", "roll", nil,
	); err == nil {
		t.Fatal("terminal game accepted roll")
	}
}
