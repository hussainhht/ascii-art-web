package backend

import (
	"fmt"
	"html/template"
	"net/http"
	"strconv"
	"time"
)

type PageData struct {
	Input     string
	Output    string
	Banner    string
	CoinCount int
	StartTime string
}

func Handler(
	w http.ResponseWriter,
	r *http.Request,
	theme string,
) {
	if r.URL.Path != "/" {
		ErrorHandler(w, r, http.StatusNotFound, nil)
		return
	}
	tmpl, tmplErr := template.ParseFiles("templates/index.html")

	if tmplErr != nil {
		ErrorHandler(w, r, http.StatusInternalServerError, nil)
		return
	}

	if r.Method == http.MethodGet {
		if r.FormValue("banner") == "" {
			data := PageData{Input: "", Output: "", Banner: "", CoinCount: 0}
			tmpl.Execute(w, data)
		} else {
			ErrorHandler(w, r, http.StatusMethodNotAllowed, nil)
		}
		return
	}

	if r.Method != http.MethodPost {
		ErrorHandler(w, r, http.StatusMethodNotAllowed, nil)
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "Unable to parse form", http.StatusBadRequest)
		return
	}

	input := r.FormValue("inputText")
	banner := r.FormValue("banner")
	fmt.Printf("DEBUG: Input: '%s', Banner: '%s'\n", input, banner)
	output, outputErr := ASCIIArt(input, banner)

	coinCount := 0
	if cookie, err := r.Cookie("coinCount"); err == nil {
		if val, err := strconv.Atoi(cookie.Value); err == nil {
			coinCount = val
		}
	}
	fmt.Printf("DEBUG: Current coin count: %d\n", coinCount)
	if outputErr != 200 {
		ErrorHandler(w, r, outputErr, nil)
		return
	}

	if banner != "" {
		coinCount++
		fmt.Printf("DEBUG: Incremented coin count to: %d\n", coinCount)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "coinCount",
		Value:    strconv.Itoa(coinCount),
		Path:     "/",
		MaxAge:   86400 * 365, // 1 year
		HttpOnly: false,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
	})
	data := PageData{
		Input:     input,
		Output:    output,
		Banner:    banner,
		CoinCount: coinCount,
		StartTime: time.Now().Format("15:04:05"),
	}

	tmpl.Execute(w, data)
}
