package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (s *Store) CreateNotification(ctx context.Context, params CreateNotificationParams) (Notification, error) {
	notification := Notification{
		ID:        uuid.New(),
		UserID:    params.UserID,
		Type:      params.Type,
		Category:  params.Category,
		Title:     params.Title,
		Message:   params.Message,
		ActionURL: params.ActionURL,
		CreatedAt: time.Now().UTC(),
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO notifications (id, user_id, type, category, title, message, action_url, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, notification.ID, notification.UserID, notification.Type, notification.Category, notification.Title, notification.Message, notification.ActionURL, notification.CreatedAt)
	if err != nil {
		return Notification{}, fmt.Errorf("create notification: %w", err)
	}
	return notification, nil
}

func (s *Store) ListNotifications(ctx context.Context, userID uuid.UUID) ([]Notification, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, user_id, type, category, title, message, action_url, read_at, created_at
		FROM notifications
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list notifications: %w", err)
	}
	defer rows.Close()

	notifications := make([]Notification, 0)
	for rows.Next() {
		var notification Notification
		if err := rows.Scan(&notification.ID, &notification.UserID, &notification.Type, &notification.Category, &notification.Title, &notification.Message, &notification.ActionURL, &notification.ReadAt, &notification.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan notification: %w", err)
		}
		notifications = append(notifications, notification)
	}
	return notifications, rows.Err()
}

func (s *Store) MarkNotificationRead(ctx context.Context, userID, notificationID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE notifications
		SET read_at = COALESCE(read_at, NOW())
		WHERE id = $1 AND user_id = $2
	`, notificationID, userID)
	if err != nil {
		return fmt.Errorf("mark notification read: %w", err)
	}
	return nil
}

func (s *Store) MarkAllNotificationsRead(ctx context.Context, userID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE notifications
		SET read_at = COALESCE(read_at, NOW())
		WHERE user_id = $1
	`, userID)
	if err != nil {
		return fmt.Errorf("mark all notifications read: %w", err)
	}
	return nil
}

func (s *Store) DeleteNotification(ctx context.Context, userID, notificationID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `
		DELETE FROM notifications
		WHERE id = $1 AND user_id = $2
	`, notificationID, userID)
	if err != nil {
		return fmt.Errorf("delete notification: %w", err)
	}
	return nil
}

func (s *Store) GetNotificationPreferences(ctx context.Context, userID uuid.UUID) (NotificationPreferences, error) {
	var emailJSON []byte
	var pushJSON []byte
	err := s.pool.QueryRow(ctx, `
		SELECT email, push
		FROM notification_preferences
		WHERE user_id = $1
	`, userID).Scan(&emailJSON, &pushJSON)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return defaultNotificationPreferences(), nil
		}
		return NotificationPreferences{}, fmt.Errorf("get notification preferences: %w", err)
	}

	prefs := NotificationPreferences{}
	if err := json.Unmarshal(emailJSON, &prefs.Email); err != nil {
		return NotificationPreferences{}, fmt.Errorf("decode email preferences: %w", err)
	}
	if err := json.Unmarshal(pushJSON, &prefs.Push); err != nil {
		return NotificationPreferences{}, fmt.Errorf("decode push preferences: %w", err)
	}
	return prefs, nil
}

func (s *Store) UpdateNotificationPreferences(ctx context.Context, userID uuid.UUID, prefs NotificationPreferences) (NotificationPreferences, error) {
	emailJSON, err := json.Marshal(prefs.Email)
	if err != nil {
		return NotificationPreferences{}, fmt.Errorf("marshal email preferences: %w", err)
	}
	pushJSON, err := json.Marshal(prefs.Push)
	if err != nil {
		return NotificationPreferences{}, fmt.Errorf("marshal push preferences: %w", err)
	}

	_, err = s.pool.Exec(ctx, `
		INSERT INTO notification_preferences (user_id, email, push, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			email = EXCLUDED.email,
			push = EXCLUDED.push,
			updated_at = NOW()
	`, userID, emailJSON, pushJSON)
	if err != nil {
		return NotificationPreferences{}, fmt.Errorf("upsert notification preferences: %w", err)
	}
	return prefs, nil
}

func defaultNotificationPreferences() NotificationPreferences {
	return NotificationPreferences{
		Email: map[string]bool{
			"deployment":  true,
			"backup":      true,
			"security":    true,
			"billing":     true,
			"updates":     false,
			"performance": true,
		},
		Push: map[string]bool{
			"deployment":  true,
			"backup":      false,
			"security":    true,
			"billing":     true,
			"updates":     false,
			"performance": false,
		},
	}
}
