package main

import (
	"context"
	"log"
	"net/http"
	"os/signal"
	"syscall"

	"github.com/hibiken/asynq"

	"log/slog"
	"moodlepilot/backend/internal/ai"
	"moodlepilot/backend/internal/auth"
	"moodlepilot/backend/internal/backup"
	"moodlepilot/backend/internal/config"
	"moodlepilot/backend/internal/coursegen"
	"moodlepilot/backend/internal/httpapi"
	"moodlepilot/backend/internal/mail"
	"moodlepilot/backend/internal/provisioning"
	"moodlepilot/backend/internal/store"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	st, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("open store: %v", err)
	}
	defer st.Close()

	if cfg.RunMigrations {
		if err := store.RunMigrations(ctx, st.Pool()); err != nil {
			log.Fatalf("run migrations: %v", err)
		}
	}
	if err := st.SeedPlans(ctx); err != nil {
		log.Fatalf("seed plans: %v", err)
	}
	if cfg.SeedPlaywrightUser {
		passwordHash, err := auth.HashPassword(cfg.PlaywrightSeedPassword)
		if err != nil {
			log.Fatalf("hash playwright seed password: %v", err)
		}
		if err := st.SeedPlaywrightUser(ctx, store.SeedPlaywrightUserParams{
			Name:         cfg.PlaywrightSeedName,
			Email:        cfg.PlaywrightSeedEmail,
			PasswordHash: passwordHash,
			Company:      cfg.PlaywrightSeedCompany,
			Organization: cfg.PlaywrightSeedOrg,
		}); err != nil {
			log.Fatalf("seed playwright user: %v", err)
		}
	}

	asynqClient := asynq.NewClient(asynq.RedisClientOpt{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
	})
	defer asynqClient.Close()

	runtime, err := provisioning.NewRuntime(cfg)
	if err != nil {
		log.Fatalf("create provisioning runtime: %v", err)
	}

	mailer := mail.NewSMTPMailer(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPFrom, cfg.FrontendOrigin)
	backupStorage, err := backup.NewStorage(cfg)
	if err != nil {
		log.Fatalf("create backup storage: %v", err)
	}

	aiLogger := slog.Default()
	aiClient := ai.NewClient(aiLogger, cfg.AiApiKey, cfg.AiBaseURL, cfg.AiModel)
	courseGen := coursegen.NewGenerator("assets/template.mbz")

	server := httpapi.New(cfg, st, mailer, asynqClient, runtime, backupStorage, aiClient, courseGen)

	httpServer := &http.Server{
		Addr:    cfg.HTTPAddr,
		Handler: server.Router(),
	}

	go func() {
		<-ctx.Done()
		_ = httpServer.Shutdown(context.Background())
	}()

	log.Printf("api listening on %s", cfg.HTTPAddr)
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("listen and serve: %v", err)
	}
}
