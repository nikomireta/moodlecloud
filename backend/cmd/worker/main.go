package main

import (
	"context"
	"log"

	"github.com/hibiken/asynq"

	"moodlecloud/backend/internal/config"
	"moodlecloud/backend/internal/mail"
	"moodlecloud/backend/internal/provisioning"
	"moodlecloud/backend/internal/store"
)

func main() {
	ctx := context.Background()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	st, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("open store: %v", err)
	}
	defer st.Close()

	runtime, err := provisioning.NewRuntime(cfg)
	if err != nil {
		log.Fatalf("create provisioning runtime: %v", err)
	}

	handler := provisioning.Handler{
		Store:             st,
		Mailer:            mail.NewSMTPMailer(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPFrom, cfg.FrontendOrigin),
		Runtime:           runtime,
		SiteRuntimeSecret: cfg.SiteRuntimeSecret,
	}

	srv := asynq.NewServer(asynq.RedisClientOpt{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
	}, asynq.Config{
		Concurrency: 10,
		Queues: map[string]int{
			"default": 1,
		},
	})

	mux := asynq.NewServeMux()
	mux.HandleFunc(provisioning.TaskTypeProvisionSite, handler.HandleProvisionSiteTask)

	log.Println("worker listening")
	if err := srv.Run(mux); err != nil {
		log.Fatalf("run worker: %v", err)
	}
}
