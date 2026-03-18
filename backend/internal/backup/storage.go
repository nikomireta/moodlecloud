package backup

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
	"sync"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"

	appconfig "moodlepilot/backend/internal/config"
)

var ErrObjectNotFound = errors.New("backup object not found")

type Storage struct {
	client *s3.Client
	bucket string

	mu          sync.Mutex
	bucketReady bool
}

func NewStorage(cfg appconfig.Config) (*Storage, error) {
	region := strings.TrimSpace(cfg.BackupS3Region)
	if region == "" {
		region = "us-east-1"
	}

	awsCfg, err := awsconfig.LoadDefaultConfig(
		context.Background(),
		awsconfig.WithRegion(region),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			strings.TrimSpace(cfg.BackupS3AccessKey),
			strings.TrimSpace(cfg.BackupS3SecretKey),
			"",
		)),
	)
	if err != nil {
		return nil, fmt.Errorf("load backup storage config: %w", err)
	}

	baseEndpoint := normalizeBaseEndpoint(cfg.BackupS3Endpoint, cfg.BackupS3UseTLS)
	client := s3.NewFromConfig(awsCfg, func(options *s3.Options) {
		options.UsePathStyle = cfg.BackupS3UsePathStyle
		if baseEndpoint != "" {
			options.BaseEndpoint = aws.String(baseEndpoint)
		}
	})

	return &Storage{
		client: client,
		bucket: strings.TrimSpace(cfg.BackupS3Bucket),
	}, nil
}

func normalizeBaseEndpoint(endpoint string, useTLS bool) string {
	trimmed := strings.TrimSpace(endpoint)
	if trimmed == "" {
		return ""
	}
	if strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://") {
		return trimmed
	}
	scheme := "http"
	if useTLS {
		scheme = "https"
	}
	return scheme + "://" + trimmed
}

func (s *Storage) EnsureBucket(ctx context.Context) error {
	if strings.TrimSpace(s.bucket) == "" {
		return fmt.Errorf("backup bucket belum dikonfigurasi")
	}

	s.mu.Lock()
	ready := s.bucketReady
	s.mu.Unlock()
	if ready {
		return nil
	}

	if _, err := s.client.HeadBucket(ctx, &s3.HeadBucketInput{
		Bucket: aws.String(s.bucket),
	}); err == nil {
		s.markBucketReady()
		return nil
	} else if !isBucketMissingError(err) {
		return fmt.Errorf("head backup bucket: %w", err)
	}

	if _, err := s.client.CreateBucket(ctx, &s3.CreateBucketInput{
		Bucket: aws.String(s.bucket),
	}); err != nil && !isBucketAlreadyExistsError(err) {
		return fmt.Errorf("create backup bucket: %w", err)
	}

	s.markBucketReady()
	return nil
}

func (s *Storage) PutObject(ctx context.Context, key string, body io.Reader, size int64, contentType string) error {
	if err := s.EnsureBucket(ctx); err != nil {
		return err
	}

	input := &s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(strings.TrimSpace(key)),
		Body:   body,
	}
	if size >= 0 {
		input.ContentLength = aws.Int64(size)
	}
	if trimmed := strings.TrimSpace(contentType); trimmed != "" {
		input.ContentType = aws.String(trimmed)
	}

	if _, err := s.client.PutObject(ctx, input); err != nil {
		return fmt.Errorf("put backup object: %w", err)
	}
	return nil
}

func (s *Storage) GetObject(ctx context.Context, key string) (io.ReadCloser, error) {
	if err := s.EnsureBucket(ctx); err != nil {
		return nil, err
	}

	result, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(strings.TrimSpace(key)),
	})
	if err != nil {
		if isObjectMissingError(err) {
			return nil, ErrObjectNotFound
		}
		return nil, fmt.Errorf("get backup object: %w", err)
	}
	return result.Body, nil
}

func (s *Storage) DeleteObject(ctx context.Context, key string) error {
	if strings.TrimSpace(key) == "" {
		return nil
	}
	if err := s.EnsureBucket(ctx); err != nil {
		return err
	}

	if _, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(strings.TrimSpace(key)),
	}); err != nil && !isObjectMissingError(err) {
		return fmt.Errorf("delete backup object: %w", err)
	}
	return nil
}

func (s *Storage) markBucketReady() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.bucketReady = true
}

func isBucketMissingError(err error) bool {
	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		switch strings.TrimSpace(apiErr.ErrorCode()) {
		case "404", "NotFound", "NoSuchBucket":
			return true
		}
	}
	return false
}

func isBucketAlreadyExistsError(err error) bool {
	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		switch strings.TrimSpace(apiErr.ErrorCode()) {
		case "BucketAlreadyOwnedByYou", "BucketAlreadyExists":
			return true
		}
	}
	return false
}

func isObjectMissingError(err error) bool {
	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		switch strings.TrimSpace(apiErr.ErrorCode()) {
		case "404", "NotFound", "NoSuchKey":
			return true
		}
	}
	return false
}
