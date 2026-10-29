package main

import (
	"reflect"
	"testing"
)

func TestRejectedCommandsPreserveInputState(t *testing.T) {
	initial, err := initialize(State{
		Seats: []string{"alice", "bob"},
	})
	if err != nil {
		t.Fatal(err)
	}

	cases := []struct {
		name    string
		from    string
		kind    string
		payload map[string]any
	}{
		{
			name: "outsider",
			from: "mallory",
			kind: "sync",
		},
		{
			name: "wrong turn",
			from: "bob",
			kind: "roll",
		},
		{
			name: "unknown command",
			from: "alice",
			kind: "unknown",
		},
		{
			name: "move before roll",
			from: "alice",
			kind: "move",
			payload: map[string]any{
				"token": float64(0),
			},
		},
		{
			name: "fractional token",
			from: "alice",
			kind: "move",
			payload: map[string]any{
				"token": 1.5,
			},
		},
		{
			name: "non-owner configuration",
			from: "bob",
			kind: "configure",
			payload: map[string]any{
				"teams": false,
			},
		},
		{
			name: "teams with two seats",
			from: "alice",
			kind: "configure",
			payload: map[string]any{
				"teams": true,
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			before := initial
			before.Seats = append([]string{}, initial.Seats...)
			before.Legal = append([]int{}, initial.Legal...)

			calls := 0

			next, events, err := applyWithDie(
				initial,
				tc.from,
				tc.kind,
				tc.payload,
				func() (int, error) {
					calls++
					return 6, nil
				},
			)

			if err == nil {
				t.Fatal("expected rejection")
			}

			if !reflect.DeepEqual(next, before) {
				t.Fatal("rejection changed returned state")
			}

			if !reflect.DeepEqual(initial, before) {
				t.Fatal("rejection mutated input state")
			}

			if len(events) != 0 {
				t.Fatal("rejection emitted events")
			}

			if calls != 0 {
				t.Fatal("rejection consumed randomness")
			}
		})
	}
}
