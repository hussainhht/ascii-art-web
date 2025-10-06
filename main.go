package main

import (
	"ascii-art/backend"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type PageData struct {
	Input     string
	Output    string
	Banner    string
	Style     string
	CoinCount int
	StartTime string
}

var themeTemplates = map[string]string{
	"mario":    "templates/index.html",
	"homepage": "templates/homepage.html",
	"terminal": "templates/terminal.html",
	"normal":   "templates/normal.html",
	"dark":     "templates/dark.html",
}

func main() {
	http.Handle("/css/", http.StripPrefix("/css/", http.FileServer(http.Dir("frontend/css"))))
	http.Handle("/Assets/", http.StripPrefix("/Assets/", http.FileServer(http.Dir("frontend/Assets"))))

	// Serve favicon to avoid 404 on initial browser request
	http.HandleFunc("/favicon.ico", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		http.ServeFile(w, r, "frontend/Assets/favicon.png")
	})

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		if r.URL.Path == "/" {
			renderTheme(w, r, "homepage", defaultPageData(r))
			return
		}
		// Any other unknown path -> 404
		fallback := "homepage"
		backend.ErrorHandler(w, r, http.StatusNotFound, &fallback)
	})

	http.HandleFunc("/mario", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			renderTheme(w, r, "mario", defaultPageData(r))
		case http.MethodPost:
			handleThemePost("mario")(w, r)
		default:
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		}
	})

	http.HandleFunc("/terminal", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			renderTheme(w, r, "terminal", defaultPageData(r))
		case http.MethodPost:
			handleThemePost("terminal")(w, r)
		default:
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		}
	})

	http.HandleFunc("/normal", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			renderTheme(w, r, "normal", defaultPageData(r))
		case http.MethodPost:
			handleThemePost("normal")(w, r)
		default:
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		}
	})

	http.HandleFunc("/dark", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			renderTheme(w, r, "dark", defaultPageData(r))
		case http.MethodPost:
			handleThemePost("dark")(w, r)
		default:
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		}
	})

	// Theme-scoped ASCII routes so URL shows /<theme>/ascii-art after a banner is chosen
	http.HandleFunc("/mario/ascii-art", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			renderTheme(w, r, "mario", defaultPageData(r))
		case http.MethodPost:
			handleThemePost("mario")(w, r)
		default:
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		}
	})
	http.HandleFunc("/terminal/ascii-art", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			renderTheme(w, r, "terminal", defaultPageData(r))
		case http.MethodPost:
			handleThemePost("terminal")(w, r)
		default:
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		}
	})
	http.HandleFunc("/normal/ascii-art", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			renderTheme(w, r, "normal", defaultPageData(r))
		case http.MethodPost:
			handleThemePost("normal")(w, r)
		default:
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		}
	})
	http.HandleFunc("/dark/ascii-art", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			renderTheme(w, r, "dark", defaultPageData(r))
		case http.MethodPost:
			handleThemePost("dark")(w, r)
		default:
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		}
	})

	http.HandleFunc("/ascii-art", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			// Render a theme without generation, based on query param
			style := r.URL.Query().Get("style")
			th := "homepage"
			if style != "" {
				th = normalizeTheme(style)
			}
			renderTheme(w, r, th, defaultPageData(r))
			return

		case http.MethodPost:
			if err := r.ParseForm(); err != nil {
				http.Error(w, "Unable to parse form", http.StatusBadRequest)
				return
			}

			input := r.FormValue("inputText")
			banner := r.FormValue("banner")
			style := r.FormValue("style")

			// If no banner chosen, only render the requested theme (no generation)
			if banner == "" {
				th := "homepage"
				if style != "" {
					th = normalizeTheme(style)
				}
				renderTheme(w, r, th, defaultPageData(r))
				return
			}

			// Validate banner before generation to avoid invalid font file lookups
			if !isValidBanner(banner) {
				th := "homepage"
				if style != "" {
					th = normalizeTheme(style)
				}
				backend.ErrorHandler(w, r, http.StatusBadRequest, &th)
				return
			}

			// Attempt ASCII generation
			output, status := backend.ASCIIArt(input, banner)

			// Increment coin on attempted generation
			coin := getCoinCount(r) + 1
			http.SetCookie(w, &http.Cookie{
				Name:  "coinCount",
				Value: strconv.Itoa(coin),
				Path:  "/",
			})

			if status != http.StatusOK {
				th := normalizeTheme(style)
				if th == "" {
					th = "homepage"
				}
				backend.ErrorHandler(w, r, status, &th)
				return
			}

			data := PageData{
				Input:     input,
				Output:    output,
				Banner:    banner,
				Style:     style,
				CoinCount: coin,
				StartTime: time.Now().Format("15:04:05"),
			}

			renderTheme(w, r, normalizeTheme(style), data)
			return

		default:
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
	})

	// Export endpoint
	http.HandleFunc("/export", ExportHandler)

	fmt.Println("Server running at http://localhost:8081")
	if err := http.ListenAndServe(":8081", nil); err != nil {
		fmt.Println("Error starting server:", err)
	}
}

func defaultPageData(r *http.Request) PageData {
	return PageData{
		CoinCount: getCoinCount(r),
		StartTime: time.Now().Format("15:04:05"),
	}
}

func getCoinCount(r *http.Request) int {
	if c, err := r.Cookie("coinCount"); err == nil {
		if v, err := strconv.Atoi(c.Value); err == nil {
			return v
		}
	}
	return 0
}

func normalizeTheme(th string) string {
	if _, ok := themeTemplates[th]; ok {
		return th
	}
	return "mario"
}

// allowedBanners lists the supported ASCII art banners.
var allowedBanners = map[string]struct{}{
	"standard":   {},
	"shadow":     {},
	"thinkertoy": {},
	"bigmoney":   {},
}

// isValidBanner returns true if the provided banner is supported.
func isValidBanner(b string) bool {
	_, ok := allowedBanners[b]
	return ok
}

func renderTheme(w http.ResponseWriter, r *http.Request, theme string, data PageData) {
	tplPath, ok := themeTemplates[theme]
	if !ok {
		theme = "homepage"
		tplPath = themeTemplates[theme]
	}

	tpl, err := template.ParseFiles(tplPath)
	if err != nil {
		fmt.Println("template parse error:", err)
		backend.ErrorHandler(w, r, http.StatusInternalServerError, &theme)
		return
	}

	if err := tpl.Execute(w, data); err != nil {
		fmt.Println("template execute error:", err)
		backend.ErrorHandler(w, r, http.StatusInternalServerError, &theme)
		return
	}
}

// handleThemePost processes banner submissions on theme routes so the URL stays on /<theme>.
func handleThemePost(theme string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		if err := r.ParseForm(); err != nil {
			http.Error(w, "Unable to parse form", http.StatusBadRequest)
			return
		}

		input := r.FormValue("inputText")
		banner := r.FormValue("banner")

		// If no banner chosen, just show the theme without generation
		if banner == "" {
			renderTheme(w, r, theme, defaultPageData(r))
			return
		}

		output, status := backend.ASCIIArt(input, banner)

		// Increment coin for attempted generation
		coin := getCoinCount(r) + 1
		http.SetCookie(w, &http.Cookie{
			Name:     "coinCount",
			Value:    strconv.Itoa(coin),
			Path:     "/",
			MaxAge:   86400 * 365,
			HttpOnly: false,
			Secure:   false,
			SameSite: http.SameSiteLaxMode,
		})

		if status != http.StatusOK {
			backend.ErrorHandler(w, r, status, &theme)
			return
		}

		data := PageData{
			Input:     input,
			Output:    output,
			Banner:    banner,
			Style:     theme,
			CoinCount: coin,
			StartTime: time.Now().Format("15:04:05"),
		}
		renderTheme(w, r, theme, data)
	}
}

// ? ExportHandler handles exporting generated ASCII art as a downloadable file.
// ? Supports optional format=zip to package the txt inside a zip file.
func ExportHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	// Limit body size (20KB raw form data)
	r.Body = http.MaxBytesReader(w, r.Body, 20*1024)
	
	if err := r.ParseForm(); err != nil {
		log.Printf("export parse error: %v", err)
		backend.ErrorHandler(w, r, http.StatusBadRequest, nil)
		return
	}

	text := r.FormValue("inputText")
	banner := r.FormValue("banner")
	style := r.FormValue("style")

	// Normalize CRLF -> LF
	text = strings.ReplaceAll(text, "\r", "")

	if banner == "" || !isValidBanner(banner) {
		log.Printf("export invalid banner: %q", banner)
		backend.ErrorHandler(w, r, http.StatusBadRequest, &style)
		return
	}

	ascii, status := backend.ASCIIArt(text, banner)
	if status != http.StatusOK {
		log.Printf("export generation failed status=%d", status)
		backend.ErrorHandler(w, r, status, &style)
		return
	}

	timestamp := time.Now().Format("20060102-150405")
	baseName := fmt.Sprintf("ascii-art-%s.txt", timestamp)

	payload := []byte(ascii)

	
	w.Header().Set("Content-Type", "text/plain; charset=ASCII")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", baseName))
	w.Header().Set("Content-Length", strconv.Itoa(len(payload)))

	if _, err := w.Write(payload); err != nil {
		log.Printf("export write error: %v", err)
	}
}
