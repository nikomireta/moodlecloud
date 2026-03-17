package main

import (
	"context"
	"log"

	"github.com/hibiken/asynq"

	"moodlepilot/backend/internal/config"
	"moodlepilot/backend/internal/mail"
	"moodlepilot/backend/internal/provisioning"
	"moodlepilot/backend/internal/store"
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

	// Pre-pull: verify the Moodle Docker image is available locally at
	// startup so we fail fast instead of discovering a missing image during
	// the first provisioning attempt.
	if err := provisioning.PrePullImage(ctx, runtime, cfg); err != nil {
		log.Printf("warning: pre-pull image check failed: %v", err)
	}

	handler := provisioning.Handler{
		Store:             st,
		Mailer:            mail.NewSMTPMailer(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPFrom, cfg.FrontendOrigin),
		Runtime:           runtime,
		SiteDBAdminURL:    cfg.SiteDBAdminURL,
		SiteRuntimeSecret: cfg.SiteRuntimeSecret,
		RedisAddr:         cfg.RedisAddr,
		RedisPassword:     cfg.RedisPassword,
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
	mux.HandleFunc(provisioning.TaskTypeMeterSiteUsageSweep, handler.HandleMeterSiteUsageSweepTask)
	mux.HandleFunc(provisioning.TaskTypeHealthCheckSweep, handler.HandleHealthCheckSweepTask)
	mux.HandleFunc(provisioning.TaskTypeReconcileOrphanedJobs, handler.HandleReconcileOrphanedJobsTask)

	scheduler := asynq.NewScheduler(asynq.RedisClientOpt{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
	}, nil)
	if _, err := scheduler.Register(cfg.UsageMeterSchedule, provisioning.NewMeterSiteUsageSweepTask()); err != nil {
		log.Fatalf("register usage meter schedule: %v", err)
	}
	if _, err := scheduler.Register(cfg.HealthCheckSchedule, provisioning.NewHealthCheckSweepTask()); err != nil {
		log.Fatalf("register health check schedule: %v", err)
	}
	if _, err := scheduler.Register(cfg.ReconcileSchedule, provisioning.NewReconcileOrphanedJobsTask()); err != nil {
		log.Fatalf("register reconcile schedule: %v", err)
	}
	go func() {
		if err := scheduler.Run(); err != nil {
			log.Fatalf("run scheduler: %v", err)
		}
	}()
	defer scheduler.Shutdown()

	log.Println("worker listening")
	if err := srv.Run(mux); err != nil {
		log.Fatalf("run worker: %v", err)
	}
}
