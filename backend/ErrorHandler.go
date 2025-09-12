package backend

import (
	"fmt"
	"html/template"
	"net/http"
	"strconv"
	"strings"
)

type ErrorPageData struct {
	Msg        string
	StatusCode string
	CoinCount  int
}

func ErrorHandler(w http.ResponseWriter, r *http.Request, statusCode int, message *string) {
	w.WriteHeader(statusCode)

	var msg string
	switch statusCode {
	case http.StatusNotFound:
		msg = "The page you're looking for is in another castle."
	case http.StatusBadRequest:
		msg = "Your request spun out like Luigi on a banana peel."
	case http.StatusInternalServerError:
		msg = "The server fell into the lava. Mario's trying to rescue it... again."
	default:
		msg = fmt.Sprintf("%d - Unknown Error", statusCode)
	}
	coinCount := 0
	if cookie, err := r.Cookie("coinCount"); err == nil {
		coinCount, _ = strconv.Atoi(cookie.Value)
	}

	var errTmpl *template.Template
	var errTmplErr error

	// Determine theme preference: explicit message parameter has priority; else infer from URL path
	theme := ""
	if message != nil {
		theme = strings.ToLower(strings.TrimSpace(*message))
	} else {
		path := strings.ToLower(r.URL.Path)
		switch {
		case strings.Contains(path, "terminal"):
			theme = "terminal"
		case strings.Contains(path, "dark"):
			theme = "dark"
		case strings.Contains(path, "normal"):
			theme = "normal"
		case strings.Contains(path, "mario"):
			theme = "mario"
		default:
			theme = "homepage"
		}
	}

	if theme == "mario" || theme == "" {
		errTmpl, errTmplErr = template.ParseFiles("templates/errorPage.html")
	} else {
		errTmpl, errTmplErr = template.ParseFiles("templates/errdefault.html")
	}
	if errTmplErr != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	data := ErrorPageData{Msg: msg, StatusCode: strconv.Itoa(statusCode), CoinCount: coinCount}

	errTmpl.Execute(w, data)
}
