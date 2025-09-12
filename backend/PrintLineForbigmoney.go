package backend

import (
	"fmt"
	"net/http"
)



func PrintLineforbigmoney(Input string, FileSplit []string) (string, int) {
	characters := make([][]string, len(Input))
	for i := range characters {
		characters[i] = make([]string, 12)
	}
	for i, ch := range Input {
		if !(ch >= ' ' && ch <= '~') {
			fmt.Println("Input included non-ascii character", ch)
			return "", http.StatusBadRequest
		}

		FileLine := (int(ch)-31)*11 - 11
		for in := 0; in < 12; in++ {
			if (FileLine >= 0 && FileLine < len(FileSplit)) {
				characters[i][in] = FileSplit[FileLine]
				FileLine++
			}
		}
	}

	str := ""
	for j := 0; j < 11; j++ {
		for i := 0; i < len(characters); i++ {
			str += characters[i][j]
		}
		str += "\n"
	}
	
	return str, http.StatusOK
}
