package routes

import (
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// repoRoot — корень git-репозитория, вычисляется один раз при старте.
var repoRoot = func() string {
	out, err := exec.Command("git", "rev-parse", "--show-toplevel").Output()
	if err != nil {
		return "."
	}
	return strings.TrimSpace(string(out))
}()

// runGit выполняет git-команду в корне репозитория и возвращает её вывод.
func runGit(args ...string) (string, error) {
	full := append([]string{"-C", repoRoot}, args...)
	out, err := exec.Command("git", full...).CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

// gitReady — проверяет, что git установлен и папка является репозиторием.
func gitReady() bool {
	_, err := runGit("rev-parse", "--is-inside-work-tree")
	return err == nil
}

// currentBranch — текущая ветка (по умолчанию main).
func currentBranch() string {
	b, err := runGit("rev-parse", "--abbrev-ref", "HEAD")
	if err != nil || b == "" || b == "HEAD" {
		return "main"
	}
	return b
}

// commitInfo — сведения о коммите по ссылке (HEAD, origin/main и т.п.).
func commitInfo(ref string) gin.H {
	hash, _ := runGit("log", "-1", "--format=%h", ref)
	full, _ := runGit("log", "-1", "--format=%H", ref)
	date, _ := runGit("log", "-1", "--format=%cd", "--date=format:%Y-%m-%d %H:%M", ref)
	subject, _ := runGit("log", "-1", "--format=%s", ref)
	author, _ := runGit("log", "-1", "--format=%an", ref)
	return gin.H{
		"hash":    hash,
		"full":    full,
		"date":    date,
		"subject": subject,
		"author":  author,
	}
}

func firstLine(s string) string {
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return strings.TrimSpace(s[:i])
	}
	return s
}

// GetVersion — GET /api/version
// Возвращает текущую установленную версию (последний коммит).
func GetVersion(c *gin.Context) {
	if !gitReady() {
		c.JSON(http.StatusOK, gin.H{
			"gitAvailable": false,
			"error":        "git не установлен или это не git-репозиторий — обновление недоступно",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"gitAvailable": true,
		"branch":       currentBranch(),
		"current":      commitInfo("HEAD"),
	})
}

// CheckUpdate — GET /api/check-update
// Спрашивает GitHub, есть ли более свежая версия (рабочие файлы не трогает).
func CheckUpdate(c *gin.Context) {
	if !gitReady() {
		c.JSON(http.StatusOK, gin.H{
			"gitAvailable": false,
			"error":        "git не установлен или это не git-репозиторий",
		})
		return
	}

	branch := currentBranch()

	// Обновляем сведения о ветке с GitHub, форсируя локальную ссылку origin/<branch>.
	refspec := "+" + branch + ":refs/remotes/origin/" + branch
	if out, err := runGit("fetch", "origin", refspec); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"gitAvailable": true,
			"branch":       branch,
			"current":      commitInfo("HEAD"),
			"error":        "Не удалось связаться с GitHub: " + firstLine(out),
		})
		return
	}

	remoteRef := "origin/" + branch
	localHash, _ := runGit("rev-parse", "HEAD")
	remoteHash, _ := runGit("rev-parse", remoteRef)
	behind, _ := runGit("rev-list", "--count", "HEAD.."+remoteRef)

	c.JSON(http.StatusOK, gin.H{
		"gitAvailable":    true,
		"branch":          branch,
		"current":         commitInfo("HEAD"),
		"latest":          commitInfo(remoteRef),
		"updateAvailable": localHash != remoteHash,
		"behind":          behind,
	})
}

// PerformUpdate — POST /api/update
// Скачивает последнюю версию с GitHub и перезапускает бэкенд.
func PerformUpdate(c *gin.Context) {
	if !gitReady() {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "git не установлен или это не git-репозиторий — обновление недоступно",
		})
		return
	}

	branch := currentBranch()

	// Забираем свежие коммиты.
	refspec := "+" + branch + ":refs/remotes/origin/" + branch
	if out, err := runGit("fetch", "origin", refspec); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Не удалось получить обновление с GitHub: " + firstLine(out),
		})
		return
	}

	// Применяем только перемоткой вперёд — чтобы не затереть локальные правки на этой машине.
	if out, err := runGit("merge", "--ff-only", "origin/"+branch); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Не удалось применить обновление. Вероятно, на этой машине есть локальные изменения файлов. Подробнее: " + firstLine(out),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"restarting": true,
		"message":    "Обновление установлено. Бэкенд перезапускается…",
		"version":    commitInfo("HEAD"),
	})

	// Ответ уже ушёл клиенту. Ставим флаг для run.bat и завершаем процесс,
	// чтобы он перезапустился уже с новым кодом.
	go func() {
		time.Sleep(1500 * time.Millisecond)
		_ = os.WriteFile("restart.flag", []byte("update"), 0644)
		os.Exit(0)
	}()
}
