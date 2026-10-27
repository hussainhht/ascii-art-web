// Generates fixtures with the untouched original backend. Run from the repo root.
package main

import (
	"ascii-art/backend"
	"encoding/json"
	"fmt"
	"os"
)

type fixture struct {
	Banner string `json:"banner"`
	Input  string `json:"input"`
	Output string `json:"output"`
	Status int    `json:"status"`
}

func main() {
	inputs := []string{"Hello", "ASCII", "12345", "Hello World", "AaZz09", " !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~", " ", "   ", " Hello ", "Hello\nWorld", "", "\n", "\n\n", "\nHello", "\n\nHello", "Hello\n", "Hello\n\nWorld\n", "Hello\r\nWorld", "\r\n", "a\rb", "café", "😀", "a\tb", "a\x00b"}
	allASCII := ""
	for c := ' '; c <= '~'; c++ {
		allASCII += string(c)
	}
	inputs = append(inputs, allASCII)
	var fixtures []fixture
	for _, banner := range []string{"standard", "shadow", "thinkertoy", "bigmoney"} {
		for _, input := range inputs {
			output, status := backend.ASCIIArt(input, banner)
			fixtures = append(fixtures, fixture{banner, input, output, status})
		}
	}
	data, err := json.MarshalIndent(fixtures, "", "  ")
	if err != nil {
		panic(err)
	}
	if err := os.WriteFile("tests/golden/outputs.json", append(data, '\n'), 0644); err != nil {
		panic(err)
	}
	fmt.Printf("Captured %d fixtures from backend.ASCIIArt\n", len(fixtures))
}
