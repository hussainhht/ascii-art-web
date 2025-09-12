package backend

import (
	"fmt"
	"net/http"
)

func PrintLine(Input string, FileSplit []string) (string, int) {
	characters := make([][]string, len(Input))
	for i := range characters {
		characters[i] = make([]string, 9)
	}
	for i, ch := range Input {
		if !(ch >= ' ' && ch <= '~') {
			fmt.Println("Input included non-ascii character", ch)
			return "", http.StatusBadRequest
		}

		FileLine := (int(ch)-31)*9 - 8
		for in := 0; in < 9; in++ {
			if (FileLine >= 0 && FileLine < len(FileSplit)) {
				characters[i][in] = FileSplit[FileLine]
				FileLine++
			}
		}
	}

	str := ""
	for j := 0; j < 8; j++ {
		for i := 0; i < len(characters); i++ {
			str += characters[i][j]
		}
		str += "\n"
	}
	return str, http.StatusOK
}
