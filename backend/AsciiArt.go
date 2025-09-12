package backend

import (
	"net/http"
	"os"
	"strings"
)

func ASCIIArt(input, banner string) (string, int) {
	InputSplit := strings.Split(strings.ReplaceAll(string(input), "\r", ""), "\n")

	fontFile := "fonts/" + banner + ".txt"
	if banner == ""{
		return "", http.StatusBadRequest
	}

	file, fileReadErr := os.ReadFile(fontFile)
	if fileReadErr != nil {
		return "", http.StatusInternalServerError
	}

	FileSplit := strings.Split(strings.ReplaceAll(string(file), "\r", ""), "\n")

	var str string
	first := true
	for i := 0; i < len(InputSplit); i++ {
		if InputSplit[i] != "" {
			if first && i != 0 {
				str += "\n"
			}
			if banner == "bigmoney" {
				tempstr, printLineErr := PrintLineforbigmoney(InputSplit[i], FileSplit)
				if printLineErr != http.StatusOK {
					return "", printLineErr
				}
				str += tempstr
				continue
			}
			tempstr, printLineErr := PrintLine(InputSplit[i], FileSplit)
			str += tempstr
			if printLineErr != 200 {
				return "", printLineErr
			}
			first = false
		} else if i != 0 {
			str += "\n"
		}
	}
	return str, http.StatusOK
}
