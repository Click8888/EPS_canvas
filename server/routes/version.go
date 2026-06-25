package routes

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// Координаты репозитория на GitHub. Меняются здесь, если переедет.
const (
	ghOwner  = "Click8888"
	ghRepo   = "EPS_canvas"
	ghBranch = "main"
)

// versionInfo — описание версии (коммита GitHub).
type versionInfo struct {
	SHA     string `json:"sha"`
	Short   string `json:"short"`
	Date    string `json:"date"`
	Subject string `json:"subject"`
}

var httpClient = &http.Client{Timeout: 60 * time.Second}

// projectRoot — корень проекта (каталог, где рядом лежат client/ и server/).
func projectRoot() string {
	cwd, err := os.Getwd()
	if err != nil {
		return "."
	}
	dir := cwd
	for i := 0; i < 6; i++ {
		_, e1 := os.Stat(filepath.Join(dir, "client"))
		_, e2 := os.Stat(filepath.Join(dir, "server"))
		if e1 == nil && e2 == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return filepath.Dir(cwd) // фолбэк: родитель текущего каталога (обычно server/)
}

func installedFilePath() string {
	return filepath.Join(projectRoot(), ".installed_version")
}

// installedVersion — версия, установленная на этой машине (или пустая, если ещё нет).
func installedVersion() versionInfo {
	var v versionInfo
	data, err := os.ReadFile(installedFilePath())
	if err != nil {
		return versionInfo{}
	}
	_ = json.Unmarshal(data, &v)
	return v
}

func saveInstalledVersion(v versionInfo) error {
	data, _ := json.MarshalIndent(v, "", "  ")
	return os.WriteFile(installedFilePath(), data, 0644)
}

func shortSHA(sha string) string {
	if len(sha) > 7 {
		return sha[:7]
	}
	return sha
}

// latestVersion — последний коммит ветки на GitHub (через публичный API).
func latestVersion() (versionInfo, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/commits/%s", ghOwner, ghRepo, ghBranch)
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("User-Agent", "EPS-updater")
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return versionInfo{}, fmt.Errorf("не удалось связаться с GitHub: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 300))
		return versionInfo{}, fmt.Errorf("GitHub вернул статус %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var payload struct {
		SHA    string `json:"sha"`
		Commit struct {
			Message string `json:"message"`
			Author  struct {
				Date string `json:"date"`
			} `json:"author"`
		} `json:"commit"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return versionInfo{}, fmt.Errorf("не удалось разобрать ответ GitHub: %w", err)
	}

	subject := payload.Commit.Message
	if i := strings.IndexByte(subject, '\n'); i >= 0 {
		subject = subject[:i]
	}
	date := payload.Commit.Author.Date
	if t, err := time.Parse(time.RFC3339, date); err == nil {
		date = t.Local().Format("2006-01-02 15:04")
	}

	return versionInfo{
		SHA:     payload.SHA,
		Short:   shortSHA(payload.SHA),
		Date:    date,
		Subject: strings.TrimSpace(subject),
	}, nil
}

// GetVersion — GET /api/version
// Возвращает версию, установленную на этой машине.
func GetVersion(c *gin.Context) {
	v := installedVersion()
	c.JSON(http.StatusOK, gin.H{
		"installed":      v,
		"installedKnown": v.SHA != "",
	})
}

// CheckUpdate — GET /api/check-update
// Сравнивает установленную версию с последней на GitHub.
func CheckUpdate(c *gin.Context) {
	installed := installedVersion()
	latest, err := latestVersion()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"installed":      installed,
			"installedKnown": installed.SHA != "",
			"error":          err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"installed":       installed,
		"installedKnown":  installed.SHA != "",
		"latest":          latest,
		"updateAvailable": installed.SHA != latest.SHA,
	})
}

// PerformUpdate — POST /api/update
// Скачивает свежую версию проекта с GitHub (zip), распаковывает поверх файлов
// и перезапускает бэкенд.
func PerformUpdate(c *gin.Context) {
	latest, err := latestVersion()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	root := projectRoot()
	if err := downloadAndApply(root); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Не удалось установить обновление: " + err.Error(),
		})
		return
	}

	if err := saveInstalledVersion(latest); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Файлы обновлены, но не удалось записать версию: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"restarting": true,
		"message":    "Обновление установлено. Бэкенд перезапускается…",
		"version":    latest,
	})

	// Ответ уже отправлен. Ставим флаг для run.bat и завершаем процесс,
	// чтобы он поднялся заново с новым кодом.
	go func() {
		time.Sleep(1500 * time.Millisecond)
		_ = os.WriteFile("restart.flag", []byte("update"), 0644)
		os.Exit(0)
	}()
}

// skipPath — пути из архива, которые обновление НЕ трогает.
func skipPath(rel string) bool {
	rel = filepath.ToSlash(rel)
	prefixes := []string{
		"node_modules/",
		"client/node_modules/",
		"go/",            // Go SDK — большой, не нужен в обновлении
		".git/",
		"client/build/",  // сборка фронта, в dev-режиме не используется
		"server/tmp/",
	}
	for _, p := range prefixes {
		if rel == strings.TrimSuffix(p, "/") || strings.HasPrefix(rel, p) {
			return true
		}
	}
	switch filepath.Base(rel) {
	case ".installed_version", "restart.flag", "run.bat":
		// run.bat сейчас выполняется cmd.exe — перезаписывать его на лету нельзя.
		return true
	}
	return false
}

// downloadAndApply — скачивает zip ветки и распаковывает исходники поверх проекта.
func downloadAndApply(root string) error {
	url := fmt.Sprintf("https://codeload.github.com/%s/%s/zip/refs/heads/%s", ghOwner, ghRepo, ghBranch)
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("User-Agent", "EPS-updater")

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("скачивание не удалось: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("GitHub вернул статус %d при скачивании архива", resp.StatusCode)
	}

	// Сохраняем во временный файл — zip.Reader требует io.ReaderAt.
	tmp, err := os.CreateTemp("", "eps-update-*.zip")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)

	if _, err := io.Copy(tmp, resp.Body); err != nil {
		tmp.Close()
		return fmt.Errorf("не удалось сохранить архив: %w", err)
	}
	tmp.Close()

	zr, err := zip.OpenReader(tmpName)
	if err != nil {
		return fmt.Errorf("повреждённый архив: %w", err)
	}
	defer zr.Close()

	for _, f := range zr.File {
		// Убираем верхнюю папку архива ("EPS_canvas-main/...").
		rel := f.Name
		if i := strings.IndexByte(rel, '/'); i >= 0 {
			rel = rel[i+1:]
		} else {
			continue
		}
		if rel == "" || skipPath(rel) {
			continue
		}

		target := filepath.Join(root, filepath.FromSlash(rel))
		if !withinRoot(root, target) { // защита от zip-slip
			continue
		}

		if f.FileInfo().IsDir() {
			os.MkdirAll(target, 0755)
			continue
		}
		if err := writeZipEntry(f, target); err != nil {
			return fmt.Errorf("файл %s: %w", rel, err)
		}
	}
	return nil
}

// withinRoot — true, если target лежит внутри root (защита от выхода за пределы).
func withinRoot(root, target string) bool {
	rootAbs, err1 := filepath.Abs(root)
	targetAbs, err2 := filepath.Abs(target)
	if err1 != nil || err2 != nil {
		return false
	}
	rel, err := filepath.Rel(rootAbs, targetAbs)
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator))
}

func writeZipEntry(f *zip.File, target string) error {
	if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		return err
	}
	rc, err := f.Open()
	if err != nil {
		return err
	}
	defer rc.Close()

	out, err := os.Create(target)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, rc)
	return err
}
