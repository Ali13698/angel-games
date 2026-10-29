package main

import "testing"

func TestCaptureAndSafeSquares(t *testing.T) {
	destinations := []int{1, 8, 13, 21, 26, 34, 39, 47}

	for _, destination := range destinations {
		s := initial(t, 2)
		s.Board[0] = destination - 1
		s.Board[4] = (destination - 26 + 52) % 52
		s.Dice = 1

		s = command(t, s, "move", 0, 0)

		if safe(destination) && s.Board[4] == -1 {
			t.Fatal("captured on safe square", destination)
		}

		if !safe(destination) &&
			(s.Board[4] != -1 || s.Turn != 0) {
			t.Fatal("capture or bonus missing", destination)
		}
	}
}

func TestTeamsAndSettings(t *testing.T) {
	s := initial(t, 4)

	s, _, err := ApplyCommand(
		s,
		"a",
		"configure",
		map[string]any{"teams": true},
	)
	if err != nil || !s.Teams {
		t.Fatal(err)
	}

	s.Board[0] = 0
	s.Board[8] = 27
	s.Dice = 1
	s.Started = true

	s = command(t, s, "move", 0, 0)
	if s.Board[8] != 27 {
		t.Fatal("captured teammate")
	}

	if _, _, err = ApplyCommand(
		s,
		"a",
		"configure",
		map[string]any{"teams": false},
	); err == nil {
		t.Fatal("settings changed after start")
	}

	for i := 0; i < 4; i++ {
		s.Board[i] = goal
	}

	s.Turn = 2
	s.Dice = 1

	for i := 8; i < 12; i++ {
		s.Board[i] = goal
	}

	s.Board[8] = goal - 1
	s = command(t, s, "move", 0, 0)

	if s.Winner != 2 {
		t.Fatal("team win missing")
	}
}

func TestSeededGamesTerminate(t *testing.T) {
	seed := uint32(193)

	die := func() int {
		seed = seed*1664525 + 1013904223
		return int(seed%6) + 1
	}

	for players := 2; players <= 4; players++ {
		s := initial(t, players)

		for step := 0; step < 20000 && s.Winner < 0; step++ {
			if s.Dice == 0 {
				s = command(t, s, "roll", 0, die())
			} else {
				s = command(t, s, "move", s.Legal[0], 0)
			}

			for _, pos := range s.Board {
				if pos < -1 || pos > goal {
					t.Fatal("board invariant")
				}
			}
		}

		if s.Winner < 0 {
			t.Fatal("game did not finish", players)
		}
	}
}
