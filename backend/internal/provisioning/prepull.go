package provisioning

import (
	"context"
	"fmt"
	"log"
	"strings"

	"moodlepilot/backend/internal/config"
	"moodlepilot/backend/internal/store"
)

// PrePullImage verifies that the configured Moodle Docker image is available
// locally. This is called at worker startup to fail fast if the image is
// missing, rather than discovering the problem during the first provisioning
// attempt. For the simulated runtime this is a no-op.
func PrePullImage(ctx context.Context, runtime Runtime, cfg config.Config) error {
	// Build a dummy site just to get the image reference from metadata.
	dummyMetadata := store.SiteRuntimeMetadata{
		ImageRepository: strings.TrimSpace(cfg.MoodleImageRepository),
		ImageTag:        strings.TrimSpace(cfg.MoodleImageTag),
	}

	imageRef := dummyMetadata.ImageRepository
	if dummyMetadata.ImageTag != "" {
		imageRef = dummyMetadata.ImageRepository + ":" + dummyMetadata.ImageTag
	}

	switch r := runtime.(type) {
	case *DockerLocalRuntime:
		log.Printf("prepull: verifying docker image %s is available locally", imageRef)
		if err := r.ensureImage(ctx, dummyMetadata); err != nil {
			return fmt.Errorf("pre-pull image check failed: %w", err)
		}
		log.Printf("prepull: docker image %s is available", imageRef)
		return nil
	default:
		log.Printf("prepull: skipping image check for runtime type %T", r)
		return nil
	}
}
