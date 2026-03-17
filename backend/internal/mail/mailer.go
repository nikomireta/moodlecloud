package mail

import (
	"fmt"
	"log"
	"net/smtp"
	"net/url"
	"strings"

	"moodlepilot/backend/internal/store"
)

type Mailer interface {
	SendVerificationCode(user store.User, code string) error
	SendPasswordReset(user store.User, token string) error
	SendSiteReady(site store.Site, initialPassword string) error
}

type SMTPMailer struct {
	host           string
	port           int
	from           string
	frontendOrigin string
}

func NewSMTPMailer(host string, port int, from, frontendOrigin string) *SMTPMailer {
	return &SMTPMailer{
		host:           host,
		port:           port,
		from:           from,
		frontendOrigin: strings.TrimRight(frontendOrigin, "/"),
	}
}

func (m *SMTPMailer) SendVerificationCode(user store.User, code string) error {
	subject := "Verifikasi email Moodlepilot"
	body := fmt.Sprintf("Halo %s,\n\nKode verifikasi Anda adalah: %s\n\nKode ini berlaku beberapa menit.\n", user.Name, code)
	return m.send(user.Email, subject, body)
}

func (m *SMTPMailer) SendPasswordReset(user store.User, token string) error {
	subject := "Reset kata sandi Moodlepilot"
	body := fmt.Sprintf(
		"Halo %s,\n\nGunakan tautan berikut untuk mengganti kata sandi akun Anda:\n%s\n\nTautan ini berlaku beberapa menit.\n",
		user.Name,
		m.passwordResetURL(token),
	)
	return m.send(user.Email, subject, body)
}

func (m *SMTPMailer) SendSiteReady(site store.Site, initialPassword string) error {
	subject := "Situs Moodle Anda siap"
	body := fmt.Sprintf(
		"Halo %s,\n\nSitus %s sudah siap digunakan.\nURL: %s\nAdmin: %s\nUsername: %s\nPassword awal: %s\n\nDemi keamanan, segera ganti password setelah login pertama kali.\n",
		site.AdminName,
		site.Name,
		site.SiteURL,
		site.AdminURL,
		site.MoodleUsername,
		initialPassword,
	)
	return m.send(site.AdminEmail, subject, body)
}

func (m *SMTPMailer) send(to, subject, body string) error {
	if m.host == "" || m.port == 0 {
		log.Printf("mail disabled: to=%s subject=%s", to, subject)
		return nil
	}

	addr := fmt.Sprintf("%s:%d", m.host, m.port)
	message := []byte(fmt.Sprintf("To: %s\r\nSubject: %s\r\n\r\n%s", to, subject, body))
	if err := smtp.SendMail(addr, nil, m.from, []string{to}, message); err != nil {
		return fmt.Errorf("send email via smtp: %w", err)
	}
	return nil
}

func (m *SMTPMailer) passwordResetURL(token string) string {
	baseURL := m.frontendOrigin
	if baseURL == "" {
		baseURL = "http://localhost:3000"
	}
	return fmt.Sprintf("%s/reset-password?token=%s", baseURL, url.QueryEscape(token))
}
